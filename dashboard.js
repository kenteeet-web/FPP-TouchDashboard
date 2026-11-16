(function () {
    "use strict";

    const root = document.getElementById("touch-dashboard");
    if (!root) return;
    const settingsStorageKey = "fppTouchDashboard.settings.v1";

    const elements = {
        connection: document.getElementById("connection-state"),
        connectionLabel: document.getElementById("connection-label"),
        showName: document.getElementById("show-name"),
        playbackState: document.getElementById("playback-state"),
        activePlaylist: document.getElementById("active-playlist"),
        activeTrack: document.getElementById("active-track"),
        trackPosition: document.getElementById("track-position"),
        elapsed: document.getElementById("elapsed-time"),
        remaining: document.getElementById("remaining-time"),
        progress: document.getElementById("progress-value"),
        playlist: document.getElementById("playlist-select"),
        volume: document.getElementById("volume-control"),
        volumeValue: document.getElementById("volume-value"),
        message: document.getElementById("control-message"),
        trackCount: document.getElementById("track-count"),
        tracksCurrent: document.getElementById("tracks-current"),
        trackList: document.getElementById("track-list"),
        settingsOpen: document.getElementById("settings-open"),
        settingsDialog: document.getElementById("settings-dialog"),
        settingsForm: document.getElementById("settings-form"),
        settingsClose: document.getElementById("settings-close"),
        settingsCancel: document.getElementById("settings-cancel"),
        settingsShowName: document.getElementById("show-name-input"),
        settingsAddress: document.getElementById("instance-address"),
        settingsMessage: document.getElementById("settings-message")
    };

    let settings = {
        showName: "",
        instanceUrl: window.location.origin
    };
    let playerStatus = null;
    let playlistNames = [];
    let playlistData = null;
    let selectedPlaylist = "";
    let selectedByUser = false;
    let requestInProgress = false;
    let actionInProgress = false;
    let refreshTimer = null;
    let loadingPlaylist = "";
    let loadedPlaylist = "";
    let playlistLoadId = 0;
    let targetVersion = 0;

    function normalizeInstanceAddress(value) {
        const address = String(value || "").trim();
        if (!address) return window.location.origin;

        const candidate = /^https?:\/\//i.test(address)
            ? address
            : window.location.protocol + "//" + address;
        let url;
        try {
            url = new URL(candidate);
        } catch (error) {
            throw new Error("Enter a valid FPP IP address or URL.");
        }

        if ((url.protocol !== "http:" && url.protocol !== "https:")
            || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
            throw new Error("Enter an FPP address with no path, username, or password.");
        }
        if (url.origin !== window.location.origin) {
            throw new Error("FPP only accepts playback controls from the dashboard's origin. Open this dashboard using the target FPP address.");
        }
        return url.origin;
    }

    function showSettingsMessage(message) {
        elements.settingsMessage.textContent = message || "";
    }

    function applySettings() {
        elements.showName.textContent = settings.showName || "FALCON PLAYER";
        elements.settingsShowName.value = settings.showName;
        elements.settingsAddress.value = settings.instanceUrl;
    }

    function loadSettings() {
        try {
            const saved = window.localStorage.getItem(settingsStorageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!parsed || typeof parsed !== "object") {
                    throw new Error("Saved dashboard settings are not valid.");
                }
                settings.showName = typeof parsed.showName === "string" ? parsed.showName.trim() : "";
                settings.instanceUrl = normalizeInstanceAddress(parsed.instanceUrl || window.location.origin);
            }
        } catch (error) {
            setMessage("Could not load saved dashboard settings: " + error.message, true);
        }
        applySettings();
    }

    async function api(path, options) {
        const response = await fetch(settings.instanceUrl + "/api" + path, Object.assign({
            cache: "no-store",
            headers: { "Accept": "application/json" }
        }, options || {}));
        const body = await response.text();
        let data = body;

        if (body) {
            try {
                data = JSON.parse(body);
            } catch (error) {
                data = body;
            }
        }

        if (!response.ok) {
            const detail = data && typeof data === "object" && (data.Message || data.message);
            throw new Error(detail || "FPP returned HTTP " + response.status);
        }

        if (data && typeof data === "object" && String(data.Status || "").toLowerCase() === "error") {
            throw new Error(data.Message || "FPP could not complete the request.");
        }
        return data;
    }

    function formatTime(value) {
        const seconds = Math.max(0, Math.floor(Number(value) || 0));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;
        const clock = [minutes, remainder].map(function (part) {
            return String(part).padStart(2, "0");
        }).join(":");
        return hours > 0 ? String(hours) + ":" + clock : clock;
    }

    function displayTime(status, field, fallback) {
        return status && status[field] ? String(status[field]) : formatTime(fallback);
    }

    function currentPlaylistName(status) {
        return status && status.current_playlist && status.current_playlist.playlist
            ? String(status.current_playlist.playlist)
            : "";
    }

    function isPlaying(status) {
        const name = String(status && status.status_name || "").toLowerCase();
        return name.includes("play") || name === "running";
    }

    function isPaused(status) {
        return String(status && status.status_name || "").toLowerCase().includes("pause");
    }

    function setConnection(connected, message) {
        elements.connection.classList.toggle("is-connected", connected);
        elements.connection.classList.toggle("is-error", !connected);
        elements.connectionLabel.textContent = message;
    }

    function setMessage(message, isError) {
        elements.message.textContent = message || "";
        elements.message.classList.toggle("is-error", Boolean(isError));
    }

    function trackTitle(entry) {
        if (!entry || typeof entry !== "object") return "Playlist item";
        const names = [
            entry.sequenceName,
            entry.mediaName,
            entry.name,
            entry.scriptName,
            entry.command,
            entry.imagePath,
            entry.url
        ];
        const title = names.find(function (name) {
            return typeof name === "string" && name.trim() !== "";
        });
        if (title) return title;
        return entry.type ? String(entry.type).replace(/^\w/, function (letter) {
            return letter.toUpperCase();
        }) : "Playlist item";
    }

    function playlistTracks(data) {
        if (!data || typeof data !== "object") return [];
        return ["leadIn", "mainPlaylist", "leadOut"].reduce(function (all, section) {
            if (Array.isArray(data[section])) {
                data[section].forEach(function (entry) {
                    if (entry) {
                        all.push(entry);
                    }
                });
            }
            return all;
        }, []);
    }

    function currentTrackIndex(tracks, status, activePlaylist) {
        if (!tracks.length || !status || activePlaylist !== selectedPlaylist) return -1;
        const currentNames = [status.current_sequence, status.current_song]
            .filter(Boolean)
            .map(function (name) { return String(name).toLowerCase(); });

        if (currentNames.length) {
            const matchingIndex = tracks.findIndex(function (entry) {
                const title = trackTitle(entry).toLowerCase();
                return currentNames.some(function (name) {
                    return title === name || title.endsWith(name) || name.endsWith(title);
                });
            });
            if (matchingIndex >= 0) return matchingIndex;
        }

        const rawIndex = Number(status.current_playlist && status.current_playlist.index);
        return Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < tracks.length ? rawIndex : -1;
    }

    function renderTracks() {
        const tracks = playlistTracks(playlistData);
        const activePlaylist = currentPlaylistName(playerStatus);
        const activeIndex = currentTrackIndex(tracks, playerStatus, activePlaylist);

        elements.trackCount.textContent = tracks.length + (tracks.length === 1 ? " track" : " tracks");
        elements.trackList.replaceChildren();

        if (!selectedPlaylist || !playlistData) {
            elements.tracksCurrent.textContent = "Choose a playlist to view its tracks.";
            const empty = document.createElement("li");
            empty.className = "empty-tracks";
            empty.textContent = "No playlist selected";
            elements.trackList.appendChild(empty);
            return;
        }

        if (activePlaylist === selectedPlaylist && activeIndex >= 0) {
            elements.tracksCurrent.textContent = "Now playing track " + (activeIndex + 1) + " of " + tracks.length;
        } else if (activePlaylist) {
            elements.tracksCurrent.textContent = "Currently playing: " + activePlaylist;
        } else {
            elements.tracksCurrent.textContent = "Selected playlist: " + selectedPlaylist;
        }

        if (!tracks.length) {
            const empty = document.createElement("li");
            empty.className = "empty-tracks";
            empty.textContent = "This playlist has no tracks.";
            elements.trackList.appendChild(empty);
            return;
        }

        tracks.forEach(function (entry, index) {
            const row = document.createElement("li");
            row.className = "track-row" + (index === activeIndex ? " is-current" : "");

            const position = document.createElement("span");
            position.className = "track-index";
            position.textContent = String(index + 1).padStart(2, "0");

            const title = document.createElement("span");
            title.className = "track-title";
            title.textContent = trackTitle(entry);
            title.title = title.textContent;

            const duration = document.createElement("span");
            duration.className = "track-duration";
            duration.textContent = entry.duration ? formatTime(entry.duration) : "";

            row.append(position, title, duration);
            elements.trackList.appendChild(row);
        });
    }

    function renderStatus(status) {
        playerStatus = status || {};
        const activePlaylist = currentPlaylistName(playerStatus);
        const playing = isPlaying(playerStatus);
        const paused = isPaused(playerStatus);
        const state = paused ? "Paused" : playing ? "Playing" : (playerStatus.status_name || "Idle");
        const sequence = playerStatus.current_sequence || playerStatus.current_song || "";
        const elapsed = Number(playerStatus.seconds_played) || 0;
        const remaining = Number(playerStatus.seconds_remaining) || 0;
        const total = elapsed + remaining;
        const percentage = total > 0 ? Math.min(100, Math.max(0, elapsed / total * 100)) : 0;
        const volume = Number(playerStatus.volume);

        elements.playbackState.textContent = String(state).toUpperCase();
        elements.playbackState.className = "playback-state " + (playing ? "state-playing" : paused ? "state-paused" : "state-idle");
        elements.activePlaylist.textContent = activePlaylist || "No playlist playing";
        elements.activeTrack.textContent = sequence || (playing ? "Playback in progress" : "Nothing is playing");
        elements.trackPosition.textContent = activePlaylist
            ? "Playlist progress  ·  " + displayTime(playerStatus, "time_elapsed", elapsed) + " elapsed"
            : "Select a playlist to start playback";
        elements.elapsed.textContent = displayTime(playerStatus, "time_elapsed", elapsed);
        elements.remaining.textContent = displayTime(playerStatus, "time_remaining", remaining);
        elements.progress.style.width = percentage + "%";

        if (Number.isFinite(volume)) {
            const normalizedVolume = Math.max(0, Math.min(100, volume));
            if (document.activeElement !== elements.volume) {
                elements.volume.value = String(normalizedVolume);
            }
            elements.volumeValue.textContent = Math.round(normalizedVolume) + "%";
        }

        if (!selectedByUser && activePlaylist && playlistNames.includes(activePlaylist)) {
            selectPlaylist(activePlaylist, false);
        } else if (!selectedPlaylist && playlistNames.length) {
            selectPlaylist(playlistNames[0], false);
        }
        renderTracks();
    }

    async function loadPlaylist(name) {
        if (!name) {
            playlistLoadId += 1;
            playlistData = null;
            loadingPlaylist = "";
            loadedPlaylist = "";
            renderTracks();
            return;
        }
        if (loadedPlaylist === name || loadingPlaylist === name) return;
        const requestId = ++playlistLoadId;
        const requestTargetVersion = targetVersion;
        loadingPlaylist = name;
        try {
            const data = await api("/playlist/" + encodeURIComponent(name) + "?mergeSubs=1");
            if (requestId !== playlistLoadId || requestTargetVersion !== targetVersion || selectedPlaylist !== name) return;
            playlistData = data;
            loadedPlaylist = name;
            renderTracks();
        } finally {
            if (requestId === playlistLoadId) loadingPlaylist = "";
        }
    }

    function selectPlaylist(name, fromUser) {
        const changed = selectedPlaylist !== name;
        if (changed) {
            playlistData = null;
            loadedPlaylist = "";
        }
        selectedPlaylist = name;
        if (fromUser) selectedByUser = true;
        elements.playlist.value = name;
        if (!changed && (loadedPlaylist === name || loadingPlaylist === name)) return;
        const requestTargetVersion = targetVersion;
        loadPlaylist(name).catch(function (error) {
            if (requestTargetVersion !== targetVersion) return;
            playlistData = null;
            loadedPlaylist = "";
            renderTracks();
            setMessage("Could not load playlist: " + error.message, true);
        });
    }

    async function refresh() {
        if (requestInProgress) return;
        if (refreshTimer) {
            window.clearTimeout(refreshTimer);
            refreshTimer = null;
        }
        requestInProgress = true;
        const requestTargetVersion = targetVersion;
        try {
            const results = await Promise.all([
                api("/fppd/status"),
                api("/playlists")
            ]);
            if (requestTargetVersion !== targetVersion) return;
            playlistNames = Array.isArray(results[1]) ? results[1] : [];
            const previousSelection = selectedPlaylist;
            const optionsChanged = elements.playlist.options.length !== Math.max(1, playlistNames.length)
                || (playlistNames.length
                    ? playlistNames.some(function (name, index) {
                        return !elements.playlist.options[index] || elements.playlist.options[index].value !== name;
                    })
                    : elements.playlist.options[0].textContent !== "No playlists found");
            if (optionsChanged) {
                elements.playlist.replaceChildren();
                if (!playlistNames.length) {
                    const option = document.createElement("option");
                    option.value = "";
                    option.textContent = "No playlists found";
                    elements.playlist.appendChild(option);
                } else {
                    playlistNames.forEach(function (name) {
                        const option = document.createElement("option");
                        option.value = name;
                        option.textContent = name;
                        elements.playlist.appendChild(option);
                    });
                }
            }

            if (selectedPlaylist && !playlistNames.includes(selectedPlaylist)) {
                selectedPlaylist = "";
                playlistData = null;
                loadedPlaylist = "";
            }

            if (previousSelection && playlistNames.includes(previousSelection)) {
                elements.playlist.value = previousSelection;
            }
            renderStatus(results[0]);
            setConnection(true, "Connected");
        } catch (error) {
            if (requestTargetVersion === targetVersion) {
                setConnection(false, "FPP connection error");
                setMessage("Unable to refresh player: " + error.message, true);
            }
        } finally {
            requestInProgress = false;
            refreshTimer = window.setTimeout(refresh, requestTargetVersion === targetVersion ? 3000 : 0);
        }
    }

    async function post(path, body) {
        return api(path, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body === undefined ? {} : body)
        });
    }

    async function runAction(action) {
        if (actionInProgress) return;
        actionInProgress = true;
        const buttons = root.querySelectorAll("[data-action]");
        buttons.forEach(function (button) { button.disabled = true; });
        setMessage("Sending " + action.replace("-", " ") + " command…", false);

        try {
            if (action === "play") {
                if (!selectedPlaylist) throw new Error("Select a playlist first.");
                if (isPaused(playerStatus)) {
                    await post("/playlists/resume");
                } else {
                    await post("/playlist/" + encodeURIComponent(selectedPlaylist) + "/start");
                }
            } else if (action === "pause") {
                await post("/playlists/pause");
            } else if (action === "stop") {
                await post("/playlists/stop");
            } else if (action === "stop-gracefully") {
                await post("/playlists/stopgracefully");
            } else if (action === "next") {
                await post("/command/Next%20Playlist%20Item", []);
            } else if (action === "previous") {
                await post("/command/Previous%20Playlist%20Item", []);
            }
            setMessage("Command sent.", false);
            await refresh();
        } catch (error) {
            setMessage(error.message, true);
        } finally {
            actionInProgress = false;
            buttons.forEach(function (button) { button.disabled = false; });
        }
    }

    elements.playlist.addEventListener("change", function (event) {
        selectPlaylist(event.target.value, true);
    });

    root.querySelectorAll("[data-action]").forEach(function (button) {
        button.addEventListener("click", function () {
            runAction(button.dataset.action);
        });
    });

    elements.volume.addEventListener("input", function () {
        elements.volumeValue.textContent = elements.volume.value + "%";
    });

    elements.volume.addEventListener("change", function () {
        const volume = Number(elements.volume.value);
        setMessage("Setting volume to " + volume + "%…", false);
        post("/system/volume", { volume: volume }).then(function () {
            setMessage("Volume set to " + volume + "%.", false);
        }).catch(function (error) {
            setMessage(error.message, true);
        });
    });

    elements.settingsOpen.addEventListener("click", function () {
        showSettingsMessage("");
        elements.settingsDialog.showModal();
    });

    elements.settingsClose.addEventListener("click", function () {
        elements.settingsDialog.close();
    });

    elements.settingsCancel.addEventListener("click", function () {
        elements.settingsDialog.close();
    });

    elements.settingsForm.addEventListener("submit", function (event) {
        event.preventDefault();
        let instanceUrl;
        try {
            instanceUrl = normalizeInstanceAddress(elements.settingsAddress.value);
            const nextSettings = {
                showName: elements.settingsShowName.value.trim(),
                instanceUrl: instanceUrl
            };
            window.localStorage.setItem(settingsStorageKey, JSON.stringify(nextSettings));

            const targetChanged = instanceUrl !== settings.instanceUrl;
            settings = nextSettings;
            applySettings();
            elements.settingsDialog.close();

            if (targetChanged) {
                targetVersion += 1;
                playerStatus = null;
                playlistNames = [];
                playlistData = null;
                selectedPlaylist = "";
                selectedByUser = false;
                loadedPlaylist = "";
                loadingPlaylist = "";
                playlistLoadId += 1;
                const connectingOption = document.createElement("option");
                connectingOption.value = "";
                connectingOption.textContent = "Connecting to FPP...";
                elements.playlist.replaceChildren(connectingOption);
                elements.volume.value = "0";
                elements.volumeValue.textContent = "--%";
                renderStatus({});
                setConnection(false, "Connecting to FPP");
                setMessage("Settings saved. Connecting to the selected player…", false);
                refresh();
            } else {
                setMessage("Settings saved.", false);
            }
        } catch (error) {
            showSettingsMessage(error.message);
        }
    });

    loadSettings();
    refresh();
})();

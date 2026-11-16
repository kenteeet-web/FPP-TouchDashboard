(function () {
    "use strict";

    const root = document.getElementById("touch-dashboard");
    if (!root) return;
    document.body.classList.add("fpp-touch-dashboard-fullscreen");
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement("meta");
        viewport.name = "viewport";
        viewport.content = "width=device-width, initial-scale=1";
        document.head.appendChild(viewport);
    }
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
        scheduleTimeLabel: document.getElementById("schedule-time-label"),
        scheduleTimeNote: document.getElementById("schedule-time-note"),
        scheduleTimeValue: document.getElementById("schedule-time-value"),
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
        settingsMessage: document.getElementById("settings-message"),
        screenTabs: root.querySelector(".screen-tabs"),
        scheduleList: document.getElementById("schedule-list"),
        scheduleMessage: document.getElementById("schedule-message"),
        playlistBrowser: document.getElementById("playlist-browser"),
        playlistsMessage: document.getElementById("playlists-message"),
        multisyncList: document.getElementById("multisync-list"),
        multisyncMessage: document.getElementById("multisync-message"),
        fppSettingsList: document.getElementById("fpp-settings-list"),
        fppSettingsMessage: document.getElementById("fpp-settings-message")
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
    let activeScreen = "status";
    let scheduleEntries = [];
    let scheduleLoaded = false;
    let scheduleLoading = false;
    let scheduleLoadError = "";
    let scheduleDirty = false;
    let playlistDetailsCache = Object.create(null);
    let fppSettingMetadata = Object.create(null);

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
        elements.showName.textContent = settings.showName || "Falcon Player";
        elements.showName.href = settings.instanceUrl;
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

        if (data && typeof data === "object" && String(data.Status || data.status || "").toLowerCase() === "error") {
            throw new Error(data.Message || data.message || "FPP could not complete the request.");
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

    function scheduleDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (date.getFullYear() !== Number(match[1])
            || date.getMonth() !== Number(match[2]) - 1
            || date.getDate() !== Number(match[3])) return null;
        return date;
    }

    function calendarDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function addCalendarDays(date, days) {
        const result = calendarDate(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function scheduleRunsOnDate(entry, date) {
        const day = Number(entry.day == null ? 7 : entry.day);
        const weekday = date.getDay();
        if (day >= 65536) return Boolean((day - 65536) & (0x4000 >> weekday));
        if (day >= 0 && day <= 6) return weekday === day;
        if (day === 7) return true;
        if (day === 8) return weekday >= 1 && weekday <= 5;
        if (day === 9) return weekday === 0 || weekday === 6;
        if (day === 10) return weekday === 1 || weekday === 3 || weekday === 5;
        if (day === 11) return weekday === 2 || weekday === 4;
        if (day === 12) return weekday >= 0 && weekday <= 4;
        if (day === 13) return weekday === 5 || weekday === 6;
        if (day === 14) return date.getDate() % 2 === 1;
        if (day === 15) return date.getDate() % 2 === 0;
        return false;
    }

    function scheduleClock(value) {
        const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || "").trim());
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        const seconds = Number(match[3] || 0);
        if (hours > 23 || minutes > 59 || seconds > 59) return null;
        return { hours: hours, minutes: minutes, seconds: seconds };
    }

    function scheduleOccurrence(entry, date) {
        if (!(entry.enabled === true || String(entry.enabled) === "1")) return null;
        const startLimit = scheduleDate(entry.startDate);
        const endLimit = scheduleDate(entry.endDate);
        const occurrenceDate = calendarDate(date);
        if ((startLimit && occurrenceDate < startLimit)
            || (endLimit && occurrenceDate > endLimit)
            || !scheduleRunsOnDate(entry, occurrenceDate)) return null;

        const startClock = scheduleClock(entry.startTime);
        const endClock = scheduleClock(entry.endTime);
        if (!startClock || !endClock) return null;
        const start = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), occurrenceDate.getDate(),
            startClock.hours, startClock.minutes, startClock.seconds);
        const end = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), occurrenceDate.getDate(),
            endClock.hours, endClock.minutes, endClock.seconds);
        if (end <= start) end.setDate(end.getDate() + 1);
        return { entry: entry, start: start, end: end };
    }

    function activeScheduleOccurrence(now) {
        if (!isPlaying(playerStatus) && !isPaused(playerStatus)) return null;
        const today = calendarDate(now);
        const currentPlaylist = currentPlaylistName(playerStatus).trim().toLowerCase();
        if (!currentPlaylist) return null;
        const active = [];
        [addCalendarDays(today, -1), today].forEach(function (date) {
            scheduleEntries.forEach(function (entry) {
                const occurrence = scheduleOccurrence(entry, date);
                if (!occurrence || occurrence.start > now || occurrence.end <= now) return;
                if (String(entry.playlist || "").trim().toLowerCase() === currentPlaylist) {
                    active.push(occurrence);
                }
            });
        });
        active.sort(function (a, b) { return a.end - b.end; });
        return active[0] || null;
    }

    function nextScheduleOccurrence(now) {
        const today = calendarDate(now);
        let next = null;
        scheduleEntries.forEach(function (entry) {
            if (!(entry.enabled === true || String(entry.enabled) === "1")) return;
            const startLimit = scheduleDate(entry.startDate);
            const endLimit = scheduleDate(entry.endDate);
            let firstDate = today;
            if (startLimit && startLimit > firstDate) firstDate = startLimit;
            if (endLimit && endLimit < firstDate) return;

            for (let offset = 0; offset <= 366; offset += 1) {
                const date = addCalendarDays(firstDate, offset);
                if (endLimit && date > endLimit) break;
                if (!scheduleRunsOnDate(entry, date)) continue;
                const occurrence = scheduleOccurrence(entry, date);
                if (!occurrence || occurrence.start <= now) continue;
                if (!next || occurrence.start < next.start) next = occurrence;
                break;
            }
        });
        return next;
    }

    function scheduleDateLabel(date, reference) {
        const dateStamp = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
        const referenceStamp = Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate());
        const dayOffset = Math.round((dateStamp - referenceStamp) / 86400000);
        if (dayOffset === 0) return "Today";
        if (dayOffset === 1) return "Tomorrow";
        return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }

    function renderScheduleStatus() {
        if (!scheduleLoaded) {
            elements.scheduleTimeLabel.textContent = scheduleLoadError ? "SCHEDULE UNAVAILABLE" : "FPP SCHEDULE";
            elements.scheduleTimeNote.textContent = scheduleLoadError
                ? "Could not load schedules: " + scheduleLoadError
                : "Loading schedule information.";
            elements.scheduleTimeValue.textContent = "--:--";
            return;
        }

        const now = new Date();
        const current = activeScheduleOccurrence(now);
        if (current) {
            elements.scheduleTimeLabel.textContent = "CURRENT SCHEDULE ENDS";
            elements.scheduleTimeNote.textContent = scheduleDateLabel(current.end, now);
            elements.scheduleTimeValue.textContent = formatClockTime(current.end);
            return;
        }

        const next = nextScheduleOccurrence(now);
        if (next) {
            elements.scheduleTimeLabel.textContent = "NEXT SCHEDULE STARTS";
            elements.scheduleTimeNote.textContent = scheduleDateLabel(next.start, now);
            elements.scheduleTimeValue.textContent = formatClockTime(next.start);
            return;
        }

        elements.scheduleTimeLabel.textContent = "NEXT SCHEDULE";
        elements.scheduleTimeNote.textContent = "No upcoming schedule with a standard clock time.";
        elements.scheduleTimeValue.textContent = "--:--";
    }

    function formatClockTime(date) {
        return [date.getHours(), date.getMinutes()].map(function (part) {
            return String(part).padStart(2, "0");
        }).join(":");
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

    function setScreenMessage(element, message, isError) {
        element.textContent = message || "";
        element.classList.toggle("is-error", Boolean(isError));
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

    function playlistTracks(data, includeLeadSections) {
        if (!data || typeof data !== "object") return [];
        const sections = includeLeadSections
            ? ["leadIn", "mainPlaylist", "leadOut"]
            : ["mainPlaylist"];
        return sections.reduce(function (all, section) {
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

    function currentTrackIndexForPlaylist(tracks, status, playlistName, indexOffset) {
        if (!tracks.length || !status || currentPlaylistName(status) !== playlistName) return -1;
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

        const rawIndex = Number(status.current_playlist && status.current_playlist.index) - (indexOffset || 0);
        return Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < tracks.length ? rawIndex : -1;
    }

    function currentTrackIndex(tracks, status, activePlaylist, indexOffset) {
        return activePlaylist === selectedPlaylist
            ? currentTrackIndexForPlaylist(tracks, status, activePlaylist, indexOffset)
            : -1;
    }

    function renderTracks() {
        const tracks = playlistTracks(playlistData);
        const activePlaylist = currentPlaylistName(playerStatus);
        const leadInCount = playlistData && Array.isArray(playlistData.leadIn)
            ? playlistData.leadIn.filter(Boolean).length
            : 0;
        const activeIndex = currentTrackIndex(tracks, playerStatus, activePlaylist, leadInCount);

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

    function scheduleField(labelText, input) {
        const field = document.createElement("div");
        field.className = "schedule-field";
        if (input.tagName === "LABEL") {
            field.appendChild(input);
            return field;
        }
        if (input.tagName === "SPAN") {
            const label = document.createElement("span");
            label.className = "schedule-field-caption";
            label.textContent = labelText;
            field.append(label, input);
            return field;
        }
        const label = document.createElement("label");
        label.textContent = labelText;
        label.appendChild(input);
        field.appendChild(label);
        return field;
    }

    function scheduleInput(field, value, type) {
        const input = document.createElement("input");
        input.className = "schedule-input";
        input.type = type;
        input.dataset.scheduleField = field;
        input.value = value == null ? "" : String(value);
        if (field === "startDate" || field === "endDate") input.placeholder = "YYYY-MM-DD";
        if (field === "startTime" || field === "endTime") {
            input.placeholder = "HH:MM:SS (25/26:00:00 = sunrise/sunset)";
            input.inputMode = "numeric";
        }
        return input;
    }

    function renderSchedules() {
        elements.scheduleList.replaceChildren();
        if (!scheduleEntries.length) {
            const empty = document.createElement("p");
            empty.className = "empty-tracks";
            empty.textContent = "No schedules are configured.";
            elements.scheduleList.appendChild(empty);
            return;
        }

        scheduleEntries.forEach(function (entry, index) {
            const card = document.createElement("article");
            card.className = "schedule-card";
            card.dataset.scheduleIndex = String(index);

            const heading = document.createElement("div");
            heading.className = "schedule-card-heading";
            const title = document.createElement("span");
            title.className = "schedule-title";
            title.textContent = "Schedule " + (index + 1);
            const remove = document.createElement("button");
            remove.className = "schedule-remove";
            remove.type = "button";
            remove.dataset.removeSchedule = String(index);
            remove.textContent = "Remove";
            heading.append(title, remove);

            const fields = document.createElement("div");
            fields.className = "schedule-field-grid";
            const enabled = document.createElement("input");
            enabled.type = "checkbox";
            enabled.dataset.scheduleField = "enabled";
            enabled.checked = String(entry.enabled) === "1" || entry.enabled === true;
            const enabledLabel = document.createElement("label");
            enabledLabel.className = "schedule-toggle";
            enabledLabel.append(enabled, document.createTextNode("Enabled"));
            fields.appendChild(scheduleField("Schedule state", enabledLabel));

            const dayOptions = [
                [0, "Sunday"], [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"],
                [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [7, "Every day"],
                [8, "Monday\u2013Friday"], [9, "Saturday\u2013Sunday"], [10, "Monday/Wednesday/Friday"],
                [11, "Tuesday/Thursday"], [12, "Sunday\u2013Thursday"], [13, "Friday/Saturday"],
                [14, "Odd days"], [15, "Even days"], [65536, "Day mask"]
            ];
            const dayContainer = document.createElement("div");
            dayContainer.className = "schedule-field";
            const dayLabel = document.createElement("label");
            dayLabel.textContent = "Day";
            const day = document.createElement("select");
            day.className = "schedule-input";
            day.dataset.scheduleField = "day";
            const rawDay = Number(entry.day == null ? 7 : entry.day);
            const dayValue = rawDay >= 65536 ? "65536" : String(rawDay);
            dayOptions.forEach(function (optionData) {
                const option = document.createElement("option");
                option.value = String(optionData[0]);
                option.textContent = optionData[1];
                day.appendChild(option);
            });
            if (!Array.from(day.options).some(function (option) { return option.value === dayValue; })) {
                const option = document.createElement("option");
                option.value = dayValue;
                option.textContent = "Day " + dayValue;
                day.appendChild(option);
            }
            day.value = dayValue;
            dayLabel.appendChild(day);
            const dayMask = document.createElement("div");
            dayMask.className = "schedule-day-mask";
            dayMask.hidden = dayValue !== "65536";
            [["Sunday", 0x4000], ["Monday", 0x2000], ["Tuesday", 0x1000], ["Wednesday", 0x0800],
                ["Thursday", 0x0400], ["Friday", 0x0200], ["Saturday", 0x0100]].forEach(function (dayData) {
                const maskLabel = document.createElement("label");
                maskLabel.className = "schedule-mask-day";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.dataset.scheduleDayMask = String(dayData[1]);
                checkbox.checked = (rawDay & dayData[1]) !== 0;
                maskLabel.append(checkbox, document.createTextNode(dayData[0].slice(0, 3)));
                dayMask.appendChild(maskLabel);
            });
            dayContainer.append(dayLabel, dayMask);
            fields.appendChild(dayContainer);

            const scheduleType = String(entry.type || (Number(entry.sequence) === 1 ? "sequence" : (entry.command ? "command" : "playlist")));
            if (scheduleType === "command") {
                fields.appendChild(scheduleField("Command", scheduleInput("command", entry.command, "text")));
            } else if (scheduleType === "sequence") {
                fields.appendChild(scheduleField("Sequence", scheduleInput("playlist", entry.playlist, "text")));
            } else {
                const playlist = document.createElement("select");
                playlist.className = "schedule-input";
                playlist.dataset.scheduleField = "playlist";
                const playlistNamesForSelect = playlistNames.slice();
                if (entry.playlist && !playlistNamesForSelect.includes(String(entry.playlist))) {
                    playlistNamesForSelect.unshift(String(entry.playlist));
                }
                if (!playlistNamesForSelect.length) playlistNamesForSelect.push("");
                playlistNamesForSelect.forEach(function (name) {
                    const option = document.createElement("option");
                    option.value = name;
                    option.textContent = name || "No playlists available";
                    playlist.appendChild(option);
                });
                playlist.value = String(entry.playlist || "");
                fields.appendChild(scheduleField("Playlist", playlist));
            }

            fields.appendChild(scheduleField("Start date", scheduleInput("startDate", entry.startDate, "text")));
            fields.appendChild(scheduleField("Start time", scheduleInput("startTime", entry.startTime, "text")));
            fields.appendChild(scheduleField("End date", scheduleInput("endDate", entry.endDate, "text")));
            fields.appendChild(scheduleField("End time", scheduleInput("endTime", entry.endTime, "text")));

            const repeat = document.createElement("input");
            repeat.type = "checkbox";
            repeat.dataset.scheduleField = "repeat";
            repeat.checked = scheduleType !== "command" && (String(entry.repeat) === "1" || entry.repeat === true);
            repeat.disabled = scheduleType === "command";
            const repeatLabel = document.createElement("label");
            repeatLabel.className = "schedule-toggle";
            repeatLabel.append(repeat, document.createTextNode("Repeat playlist"));
            fields.appendChild(scheduleField("Playback", repeatLabel));

            const stopType = document.createElement("select");
            stopType.className = "schedule-input";
            stopType.dataset.scheduleField = "stopType";
            [[0, "Graceful"], [2, "Graceful Loop"], [1, "Hard Stop"]].forEach(function (stopOption) {
                const option = document.createElement("option");
                option.value = String(stopOption[0]);
                option.textContent = stopOption[1];
                stopType.appendChild(option);
            });
            const stopValue = String(entry.stopType == null ? 0 : entry.stopType);
            if (!Array.from(stopType.options).some(function (option) { return option.value === stopValue; })) {
                const option = document.createElement("option");
                option.value = stopValue;
                option.textContent = "FPP value " + stopValue;
                stopType.appendChild(option);
            }
            stopType.value = stopValue;
            fields.appendChild(scheduleField("Stop type", stopType));

            const typeLabel = document.createElement("span");
            typeLabel.className = "schedule-field-value";
            typeLabel.textContent = scheduleType === "sequence" ? "Sequence" : scheduleType === "command" ? "Command" : "Playlist";
            fields.appendChild(scheduleField("Entry type", typeLabel));
            card.append(heading, fields);
            elements.scheduleList.appendChild(card);
        });
    }

    async function loadSchedules(force) {
        if (scheduleLoading) return;
        if (scheduleDirty) {
            if (!force) {
                setScreenMessage(elements.scheduleMessage, "Unsaved schedule edits are being kept. Save them or use Refresh to discard them.", false);
                return;
            }
            if (!window.confirm("Discard unsaved schedule changes and reload from FPP?")) return;
        }
        scheduleLoading = true;
        scheduleLoadError = "";
        renderScheduleStatus();
        ["schedule-refresh", "schedule-add", "schedule-save"].forEach(function (id) {
            document.getElementById(id).disabled = true;
        });
        const requestTargetVersion = targetVersion;
        setScreenMessage(elements.scheduleMessage, "Loading schedules\u2026", false);
        try {
            const data = await api("/schedule");
            if (requestTargetVersion !== targetVersion) return;
            if (!Array.isArray(data)) throw new Error("FPP returned an invalid schedule.");
            scheduleEntries = data.map(function (entry) {
                return entry && typeof entry === "object" ? Object.assign({}, entry) : {};
            });
            scheduleLoaded = true;
            scheduleDirty = false;
            renderSchedules();
            renderScheduleStatus();
            setScreenMessage(elements.scheduleMessage, scheduleEntries.length + (scheduleEntries.length === 1 ? " schedule loaded." : " schedules loaded."), false);
        } catch (error) {
            if (requestTargetVersion === targetVersion) {
                scheduleLoadError = error.message;
                renderScheduleStatus();
                setScreenMessage(elements.scheduleMessage, "Could not load schedules: " + error.message, true);
            }
        } finally {
            scheduleLoading = false;
            ["schedule-refresh", "schedule-add", "schedule-save"].forEach(function (id) {
                document.getElementById(id).disabled = false;
            });
            if (requestTargetVersion !== targetVersion && !scheduleLoaded) loadSchedules(false);
        }
    }

    function addSchedule() {
        if (scheduleLoading || !scheduleLoaded) {
            setScreenMessage(elements.scheduleMessage, "Wait for schedules to finish loading before adding an entry.", true);
            return;
        }
        const today = new Date();
        const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
        scheduleEntries.push({
            day: 7,
            enabled: 0,
            endDate: "2099-12-31",
            endTime: "23:00:00",
            playlist: playlistNames[0] || "",
            repeat: 1,
            sequence: 0,
            startDate: date,
            startTime: "17:00:00",
            stopType: 0,
            type: "playlist"
        });
        scheduleDirty = true;
        renderSchedules();
        setScreenMessage(elements.scheduleMessage, "New schedule added. It is disabled until you enable it.", false);
    }

    async function saveSchedules() {
        if (scheduleLoading || !scheduleLoaded) {
            setScreenMessage(elements.scheduleMessage, "Wait for schedules to finish loading before saving.", true);
            return;
        }
        const button = document.getElementById("schedule-save");
        const rows = Array.from(elements.scheduleList.querySelectorAll(".schedule-card"));
        const nextEntries = rows.map(function (card) {
            const index = Number(card.dataset.scheduleIndex);
            const entry = Object.assign({}, scheduleEntries[index] || {});
            function value(field) {
                return card.querySelector('[data-schedule-field="' + field + '"]');
            }
            entry.day = Number(value("day").value);
            if (entry.day === 65536) {
                entry.day += Array.from(card.querySelectorAll("[data-schedule-day-mask]")).reduce(function (mask, checkbox) {
                    return checkbox.checked ? mask + Number(checkbox.dataset.scheduleDayMask) : mask;
                }, 0);
            }
            entry.enabled = value("enabled").checked ? 1 : 0;
            const type = String(entry.type || (Number(entry.sequence) === 1 ? "sequence" : (entry.command ? "command" : "playlist")));
            entry.type = type;
            if (type === "command") {
                entry.command = value("command").value;
                entry.playlist = "";
                entry.sequence = 0;
            } else {
                entry.playlist = value("playlist").value;
                entry.sequence = type === "sequence" ? 1 : 0;
            }
            entry.startDate = value("startDate").value;
            entry.startTime = value("startTime").value;
            entry.endDate = value("endDate").value;
            entry.endTime = value("endTime").value;
            entry.repeat = type === "command" ? 0 : (value("repeat").checked ? 1 : 0);
            entry.stopType = Number(value("stopType").value || 0);
            return entry;
        });

        if (nextEntries.some(function (entry) {
            const type = String(entry.type || "playlist");
            return !Number.isInteger(entry.day) || entry.day < 0
                || (type === "command" ? !entry.command : !entry.playlist);
        })) {
            setScreenMessage(elements.scheduleMessage, "Choose a valid day and a playlist, sequence, or command for every schedule before saving.", true);
            return;
        }

        button.disabled = true;
        setScreenMessage(elements.scheduleMessage, "Saving schedule\u2026", false);
        try {
            const saved = await post("/schedule", nextEntries);
            if (!Array.isArray(saved)) throw new Error("FPP did not confirm the saved schedule.");
            scheduleEntries = saved;
            scheduleDirty = false;
            scheduleLoadError = "";
            renderSchedules();
            renderScheduleStatus();
            try {
                await post("/schedule/reload");
                setScreenMessage(elements.scheduleMessage, "Schedule saved and reloaded.", false);
            } catch (error) {
                setScreenMessage(elements.scheduleMessage, "Schedule saved, but FPP could not reload it: " + error.message, true);
            }
        } catch (error) {
            setScreenMessage(elements.scheduleMessage, "Could not save schedule: " + error.message, true);
        } finally {
            button.disabled = false;
        }
    }

    function renderPlaylistTracks(container, name, data) {
        container.replaceChildren();
        const tracks = playlistTracks(data, true);
        if (!tracks.length) {
            const empty = document.createElement("p");
            empty.className = "empty-tracks";
            empty.textContent = "This playlist has no tracks.";
            container.appendChild(empty);
            return;
        }

        const activeIndex = currentTrackIndexForPlaylist(tracks, playerStatus, name);
        const list = document.createElement("ol");
        list.className = "track-list";
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
            list.appendChild(row);
        });
        container.appendChild(list);
        if (activeIndex >= 0) {
            const current = document.createElement("p");
            current.className = "tracks-current";
            current.textContent = "Now playing track " + (activeIndex + 1) + " of " + tracks.length;
            container.prepend(current);
        }
    }

    async function loadPlaylistDetails(name, container, details) {
        if (playlistDetailsCache[name]) {
            renderPlaylistTracks(container, name, playlistDetailsCache[name]);
            return;
        }
        const requestTargetVersion = targetVersion;
        const loading = document.createElement("p");
        loading.className = "tracks-current";
        loading.textContent = "Loading tracks\u2026";
        container.replaceChildren(loading);
        try {
            const data = await api("/playlist/" + encodeURIComponent(name) + "?mergeSubs=1");
            if (requestTargetVersion !== targetVersion || !details.open) return;
            playlistDetailsCache[name] = data;
            renderPlaylistTracks(container, name, data);
        } catch (error) {
            if (requestTargetVersion === targetVersion) {
                const message = document.createElement("p");
                message.className = "screen-message is-error";
                message.textContent = "Could not load tracks: " + error.message;
                container.replaceChildren(message);
            }
        }
    }

    function renderPlaylistBrowser() {
        elements.playlistBrowser.replaceChildren();
        if (!playlistNames.length) {
            const empty = document.createElement("p");
            empty.className = "empty-tracks";
            empty.textContent = "No playlists found.";
            elements.playlistBrowser.appendChild(empty);
            return;
        }

        const activePlaylist = currentPlaylistName(playerStatus);
        playlistNames.forEach(function (name) {
            const details = document.createElement("details");
            details.className = "playlist-card";
            const summary = document.createElement("summary");
            const summaryContent = document.createElement("span");
            summaryContent.className = "playlist-summary";
            const title = document.createElement("span");
            title.className = "playlist-name-label";
            title.textContent = name;
            summaryContent.appendChild(title);
            if (name === activePlaylist) {
                const active = document.createElement("span");
                active.className = "playlist-active";
                active.textContent = "NOW PLAYING";
                summaryContent.appendChild(active);
            }
            summary.appendChild(summaryContent);
            const content = document.createElement("div");
            content.className = "playlist-detail";
            details.append(summary, content);
            details.addEventListener("toggle", function () {
                if (details.open) loadPlaylistDetails(name, content, details);
            });
            elements.playlistBrowser.appendChild(details);
        });
    }

    async function loadPlaylistsScreen() {
        const requestTargetVersion = targetVersion;
        setScreenMessage(elements.playlistsMessage, "Loading playlists\u2026", false);
        try {
            const data = await api("/playlists");
            if (requestTargetVersion !== targetVersion) return;
            playlistNames = Array.isArray(data) ? data : [];
            renderPlaylistBrowser();
            setScreenMessage(elements.playlistsMessage, playlistNames.length + (playlistNames.length === 1 ? " playlist found." : " playlists found."), false);
        } catch (error) {
            if (requestTargetVersion === targetVersion) {
                setScreenMessage(elements.playlistsMessage, "Could not load playlists: " + error.message, true);
            }
        }
    }

    function normalizeSystems(data) {
        if (Array.isArray(data)) return data;
        if (!data || typeof data !== "object") return [];
        if (Array.isArray(data.systems)) return data.systems;
        return Object.keys(data).map(function (key) {
            const system = data[key];
            return system && typeof system === "object"
                ? Object.assign({ address: key }, system)
                : { address: key };
        });
    }

    function systemAddress(system) {
        return String(system && (system.ip || system.address) || "").trim().replace(/^\[|\]$/g, "");
    }

    function isLocalSystem(system) {
        return String(system && system.local) === "1" || Boolean(system && system.local === true);
    }

    function isFppSystem(system) {
        const typeId = Number(system.typeId);
        return !Number.isFinite(typeId) || (typeId >= 1 && typeId < 128);
    }

    function isBrowserReachableAddress(address) {
        const normalized = String(address || "").toLowerCase();
        return Boolean(normalized)
            && normalized.indexOf("%") < 0
            && !normalized.startsWith("fe80:")
            && !normalized.startsWith("127.")
            && normalized !== "::1"
            && normalized !== "localhost";
    }

    function isIPv4Address(address) {
        return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address);
    }

    function uniqueReachableSystems(systems) {
        const orderedSystems = systems.filter(function (system) {
            return system && typeof system === "object"
                && isFppSystem(system)
                && isBrowserReachableAddress(systemAddress(system));
        }).slice().sort(function (left, right) {
            return Number(isIPv4Address(systemAddress(right))) - Number(isIPv4Address(systemAddress(left)));
        });
        const seenAddresses = Object.create(null);
        const seenSystems = Object.create(null);
        const uniqueSystems = [];
        orderedSystems.forEach(function (system) {
            const address = systemAddress(system);
            const addressKey = address.toLowerCase();
            const identity = system.uuid || system.mac || system.hostname || system.name;
            const systemKey = identity ? String(identity).trim().toLowerCase() : addressKey;
            if (seenAddresses[addressKey] || seenSystems[systemKey]) return;
            seenAddresses[addressKey] = true;
            seenSystems[systemKey] = true;
            uniqueSystems.push(system);
        });
        return uniqueSystems;
    }

    function statusForAddress(data, address) {
        if (!data || typeof data !== "object") return null;
        if (Array.isArray(data)) {
            return data.find(function (item) {
                return item && (item.address === address || item.ip === address);
            }) || null;
        }
        const source = data.systems && typeof data.systems === "object" ? data.systems : data;
        return source[address] || source[address.replace(/^\[|\]$/g, "")] || null;
    }

    function renderMultisync(systems, statusData) {
        elements.multisyncList.replaceChildren();
        if (!systems.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.className = "multisync-empty";
            cell.colSpan = 5;
            cell.textContent = "No browser-reachable FPP controllers found.";
            row.appendChild(cell);
            elements.multisyncList.appendChild(row);
            return;
        }

        systems.forEach(function (system) {
            const address = systemAddress(system);
            const local = isLocalSystem(system);
            const remoteStatus = local ? playerStatus : statusForAddress(statusData, address);
            const data = remoteStatus && typeof remoteStatus === "object" ? remoteStatus : system;
            const row = document.createElement("tr");
            const hostname = document.createElement("td");
            hostname.className = "multisync-hostname";
            hostname.textContent = String(system.hostname || system.name || "Unknown");
            const ip = document.createElement("td");
            ip.className = "multisync-ip";
            ip.textContent = address;
            const platform = document.createElement("td");
            platform.textContent = String(system.platform || system.type || data.platform || data.type || "FPP");
            const model = system.model || data.model;
            if (model && String(model) !== platform.textContent) {
                const detail = document.createElement("span");
                detail.className = "multisync-platform-detail";
                detail.textContent = String(model);
                platform.appendChild(detail);
            }
            const mode = document.createElement("td");
            mode.textContent = String(system.fppModeString || system.fppMode || data.fppModeString || data.fppMode || "Unknown");
            const status = document.createElement("td");
            const playing = data.current_sequence || data.current_song
                || (data.current_playlist && data.current_playlist.playlist);
            const statusName = String(data.status_name || data.status || (local ? "Online" : "Unreachable"));
            status.textContent = isPlaying(data) && playing
                ? "Playing: " + String(playing)
                : statusName;
            row.append(hostname, ip, platform, mode, status);
            elements.multisyncList.appendChild(row);
        });
    }

    async function loadMultisync() {
        const requestTargetVersion = targetVersion;
        setScreenMessage(elements.multisyncMessage, "Checking MultiSync controllers\u2026", false);
        try {
            const systemData = await api("/fppd/multiSyncSystems");
            if (requestTargetVersion !== targetVersion) return;
            const systems = uniqueReachableSystems(normalizeSystems(systemData));
            const addresses = systems
                .filter(function (system) {
                    return !isLocalSystem(system);
                })
                .map(systemAddress)
                .filter(Boolean);
            let statusData = {};
            if (addresses.length) {
                const query = ["type=FPP"].concat(addresses.map(function (address) {
                    return "ip%5B%5D=" + encodeURIComponent(address);
                })).join("&");
                try {
                    statusData = await api("/system/status?" + query);
                } catch (error) {
                    if (requestTargetVersion === targetVersion) {
                        setScreenMessage(elements.multisyncMessage, "Controllers are listed, but their live status is unavailable: " + error.message, true);
                    }
                }
            }
            if (requestTargetVersion !== targetVersion) return;
            renderMultisync(systems, statusData);
            if (!addresses.length) {
                setScreenMessage(elements.multisyncMessage, "No remote FPP players are currently online.", false);
            } else if (!elements.multisyncMessage.classList.contains("is-error")) {
                setScreenMessage(elements.multisyncMessage, addresses.length + (addresses.length === 1 ? " remote controller online." : " remote controllers online."), false);
            }
        } catch (error) {
            if (requestTargetVersion === targetVersion) {
                elements.multisyncList.replaceChildren();
                setScreenMessage(elements.multisyncMessage, "Could not load MultiSync controllers: " + error.message, true);
            }
        }
    }

    const fppSettingGroups = [
        { label: "Playback", keys: ["generalPlayback"] },
        { label: "Audio/Video Settings", keys: [
            "avModes", "generalAudio", "pipeWireGeneral", "pipeWireAudio", "pipeWireStreams",
            "simplePipeWireAudio", "pipeWireVideo", "simplePipeWireVideo", "hdmiDisplay"
        ] },
        { label: "Input/Output", keys: ["input", "output"] },
        { label: "User Interface", keys: ["ui"] },
        { label: "UI Colors", keys: ["uiColors"] },
        { label: "UI Behavior", keys: ["uiBehavior"] }
    ];

    function settingInput(setting, metadata) {
        const type = String(metadata.type || "text").toLowerCase();
        let input;
        if (type === "checkbox") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.className = "setting-input";
            input.checked = String(metadata.value) === String(metadata.checkedValue || "1")
                || metadata.value === true;
        } else if (type === "select" && metadata.options && typeof metadata.options === "object") {
            input = document.createElement("select");
            input.className = "setting-input";
            Object.keys(metadata.options).forEach(function (label) {
                const option = document.createElement("option");
                option.value = String(metadata.options[label]);
                option.textContent = label;
                input.appendChild(option);
            });
            input.value = metadata.value == null ? "" : String(metadata.value);
        } else {
            input = document.createElement("input");
            input.type = type === "number" ? "number" : (type === "color" ? "color" : "text");
            input.className = "setting-input";
            input.value = metadata.value == null ? "" : String(metadata.value);
            if (metadata.min !== undefined) input.min = String(metadata.min);
            if (metadata.max !== undefined) input.max = String(metadata.max);
            if (metadata.step !== undefined) input.step = String(metadata.step);
            if (type === "color" && !/^#[0-9a-f]{6}$/i.test(input.value)) input.type = "text";
        }
        input.dataset.settingInput = setting;
        input.disabled = type === "password" || type === "file";
        return input;
    }

    function renderFppSettings(groups) {
        elements.fppSettingsList.replaceChildren();
        groups.forEach(function (group) {
            const card = document.createElement("section");
            card.className = "setting-group";
            const heading = document.createElement("h3");
            heading.className = "setting-group-heading";
            heading.textContent = group.label;
            const fields = document.createElement("div");
            fields.className = "setting-fields";

            group.settings.forEach(function (setting) {
                const metadata = fppSettingMetadata[setting];
                if (!metadata || String(metadata.type || "").toLowerCase() === "password") return;
                const field = document.createElement("div");
                field.className = "setting-field";
                const wrap = document.createElement("div");
                wrap.className = "setting-input-wrap";
                const inputId = "fpp-setting-" + setting.replace(/[^a-zA-Z0-9_-]/g, "-");
                const label = document.createElement("label");
                label.htmlFor = inputId;
                label.textContent = metadata.description || setting;
                const input = settingInput(setting, metadata);
                input.id = inputId;
                const hasValue = Object.prototype.hasOwnProperty.call(metadata, "value");
                if (!hasValue) input.disabled = true;
                wrap.append(label, input);
                if (metadata.tip) {
                    const help = document.createElement("p");
                    help.className = "setting-help";
                    help.textContent = metadata.tip;
                    wrap.appendChild(help);
                }
                if (Number(metadata.reboot) > 0 || Number(metadata.restart) > 0) {
                    const warning = document.createElement("p");
                    warning.className = "setting-help";
                    warning.textContent = Number(metadata.reboot) > 0 ? "Changing this may require a reboot." : "Changing this may require FPP to restart.";
                    wrap.appendChild(warning);
                }
                const save = document.createElement("button");
                save.className = "small-button setting-save";
                save.type = "button";
                save.dataset.saveSetting = setting;
                save.textContent = "Save";
                save.disabled = !hasValue;
                const status = document.createElement("span");
                status.className = "setting-status";
                status.dataset.settingStatus = setting;
                if (!hasValue) status.textContent = "This setting is unavailable on this player.";
                field.append(wrap, save, status);
                fields.appendChild(field);
            });

            card.append(heading, fields);
            elements.fppSettingsList.appendChild(card);
        });
    }

    async function loadFppSettings() {
        const requestTargetVersion = targetVersion;
        setScreenMessage(elements.fppSettingsMessage, "Loading FPP settings\u2026", false);
        try {
            const data = await api("/settings");
            if (requestTargetVersion !== targetVersion) return;
            const metadataSettings = data && data.settings ? data.settings : {};
            const groups = fppSettingGroups.map(function (group) {
                const settings = group.keys.reduce(function (all, key) {
                    const settingGroup = data && data.settingGroups && data.settingGroups[key];
                    return all.concat(settingGroup && Array.isArray(settingGroup.settings) ? settingGroup.settings : []);
                }, []);
                return {
                    label: group.label,
                    settings: Array.from(new Set(settings))
                };
            }).filter(function (group) { return group.settings.length > 0; });
            const settingNames = Array.from(new Set(groups.reduce(function (all, group) {
                return all.concat(group.settings);
            }, []))).filter(function (name) {
                const meta = metadataSettings[name] || {};
                return String(meta.type || "").toLowerCase() !== "password";
            });

            const results = await Promise.all(settingNames.map(async function (name) {
                const detail = await api("/settings/" + encodeURIComponent(name));
                return [name, detail];
            }));
            if (requestTargetVersion !== targetVersion) return;
            fppSettingMetadata = Object.create(null);
            results.forEach(function (result) {
                fppSettingMetadata[result[0]] = result[1];
            });
            renderFppSettings(groups);
            setScreenMessage(elements.fppSettingsMessage, settingNames.length + " settings available. Changes are saved individually.", false);
        } catch (error) {
            if (requestTargetVersion === targetVersion) {
                elements.fppSettingsList.replaceChildren();
                setScreenMessage(elements.fppSettingsMessage, "Could not load FPP settings: " + error.message, true);
            }
        }
    }

    async function saveFppSetting(name, button) {
        const input = root.querySelector('[data-setting-input="' + name + '"]');
        const status = root.querySelector('[data-setting-status="' + name + '"]');
        if (!input || !status) return;
        const metadata = fppSettingMetadata[name] || {};
        let value = input.value;
        if (input.type === "checkbox") {
            value = input.checked
                ? (metadata.checkedValue == null ? "1" : String(metadata.checkedValue))
                : (metadata.uncheckedValue == null ? "0" : String(metadata.uncheckedValue));
        }
        if (input.type === "number" && (!input.checkValidity() || value === "")) {
            status.textContent = "Enter a valid value.";
            status.classList.add("is-error");
            return;
        }

        button.disabled = true;
        status.textContent = "Saving\u2026";
        status.classList.remove("is-error");
        try {
            await api("/settings/" + encodeURIComponent(name), {
                method: "PUT",
                headers: { "Accept": "application/json", "Content-Type": "text/plain" },
                body: String(value)
            });
            const updated = await api("/settings/" + encodeURIComponent(name));
            fppSettingMetadata[name] = updated;
            const refreshedInput = settingInput(name, updated);
            refreshedInput.id = input.id;
            input.replaceWith(refreshedInput);
            status.textContent = "Saved.";
            setScreenMessage(elements.fppSettingsMessage, "Saved " + (updated.description || name) + ".", false);
        } catch (error) {
            status.textContent = error.message;
            status.classList.add("is-error");
        } finally {
            button.disabled = false;
        }
    }

    function activateScreen(name) {
        activeScreen = name;
        elements.screenTabs.querySelectorAll("[data-screen]").forEach(function (button) {
            const active = button.dataset.screen === name;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
        });
        root.querySelectorAll("[data-screen-view]").forEach(function (view) {
            const active = view.dataset.screenView === name;
            view.hidden = !active;
            view.classList.toggle("is-active", active);
        });

        if (name === "schedules" && !scheduleLoaded) loadSchedules(false);
        if (name === "playlists") loadPlaylistsScreen();
        if (name === "multisync") loadMultisync();
        if (name === "fpp-settings") loadFppSettings();
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
            ? "Playlist progress  \u00B7  " + displayTime(playerStatus, "time_elapsed", elapsed) + " elapsed"
            : "Select a playlist to start playback";
        elements.elapsed.textContent = displayTime(playerStatus, "time_elapsed", elapsed);
        elements.remaining.textContent = displayTime(playerStatus, "time_remaining", remaining);
        elements.progress.style.width = percentage + "%";
        renderScheduleStatus();

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
        setMessage("Sending " + action.replace("-", " ") + " command\u2026", false);

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

    elements.screenTabs.addEventListener("click", function (event) {
        const button = event.target.closest("[data-screen]");
        if (button) activateScreen(button.dataset.screen);
    });

    document.getElementById("schedule-refresh").addEventListener("click", function () {
        loadSchedules(true);
    });
    document.getElementById("schedule-add").addEventListener("click", addSchedule);
    document.getElementById("schedule-save").addEventListener("click", saveSchedules);
    elements.scheduleList.addEventListener("change", function (event) {
        scheduleDirty = true;
        const daySelect = event.target.closest('[data-schedule-field="day"]');
        if (daySelect) {
            const dayMask = daySelect.closest(".schedule-field").querySelector(".schedule-day-mask");
            dayMask.hidden = daySelect.value !== "65536";
        }
        setScreenMessage(elements.scheduleMessage, "Unsaved schedule edits.", false);
    });
    elements.scheduleList.addEventListener("click", function (event) {
        const button = event.target.closest("[data-remove-schedule]");
        if (!button) return;
        scheduleEntries.splice(Number(button.dataset.removeSchedule), 1);
        scheduleDirty = true;
        renderSchedules();
        setScreenMessage(elements.scheduleMessage, "Schedule removed. Save changes to apply.", false);
    });

    document.getElementById("playlists-refresh").addEventListener("click", loadPlaylistsScreen);
    document.getElementById("multisync-refresh").addEventListener("click", loadMultisync);
    document.getElementById("settings-refresh").addEventListener("click", loadFppSettings);
    elements.fppSettingsList.addEventListener("click", function (event) {
        const button = event.target.closest("[data-save-setting]");
        if (button) saveFppSetting(button.dataset.saveSetting, button);
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
        setMessage("Setting volume to " + volume + "%\u2026", false);
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
                scheduleEntries = [];
                scheduleLoaded = false;
                scheduleLoadError = "";
                scheduleDirty = false;
                playlistDetailsCache = Object.create(null);
                fppSettingMetadata = Object.create(null);
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
                setMessage("Settings saved. Connecting to the selected player\u2026", false);
                refresh();
                loadSchedules(false);
                activateScreen(activeScreen);
            } else {
                setMessage("Settings saved.", false);
            }
        } catch (error) {
            showSettingsMessage(error.message);
        }
    });

    loadSettings();
    refresh();
    loadSchedules(false);
})();

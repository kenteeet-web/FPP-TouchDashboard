<div class="touch-dashboard" id="touch-dashboard">
    <header class="dashboard-header">
        <div>
            <p class="eyebrow" id="show-name">FALCON PLAYER</p>
            <h1>Touch Dashboard</h1>
        </div>
        <div class="dashboard-actions">
            <button class="settings-button" id="settings-open" type="button" aria-label="Dashboard settings" title="Dashboard settings">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9 4.7v-2.4l-2.1-.6a7.1 7.1 0 0 0-.7-1.6l1.1-1.9-1.7-1.7-1.9 1.1a7.1 7.1 0 0 0-1.6-.7L13.5 3h-2.4l-.6 2.1a7.1 7.1 0 0 0-1.6.7L7 4.7 5.3 6.4l1.1 1.9a7.1 7.1 0 0 0-.7 1.6l-2.1.6v2.4l2.1.6a7.1 7.1 0 0 0 .7 1.6l-1.1 1.9L7 19.3l1.9-1.1a7.1 7.1 0 0 0 1.6.7l.6 2.1h2.4l.6-2.1a7.1 7.1 0 0 0 1.6-.7l1.9 1.1 1.7-1.7-1.1-1.9a7.1 7.1 0 0 0 .7-1.6l2.1-.6Z"/>
                </svg>
            </button>
            <div class="connection-state" id="connection-state" role="status" aria-live="polite">
                <span class="state-dot"></span>
                <span id="connection-label">Connecting to FPP</span>
            </div>
        </div>
    </header>

    <main>
        <section class="now-playing panel" aria-labelledby="now-playing-heading">
            <div class="section-heading">
                <div>
                    <p class="eyebrow">PLAYER STATUS</p>
                    <h2 id="now-playing-heading">Now playing</h2>
                </div>
                <span class="playback-state state-idle" id="playback-state">Idle</span>
            </div>
            <div class="playing-content">
                <div class="playing-copy">
                    <p class="playlist-name" id="active-playlist">No playlist playing</p>
                    <h3 id="active-track">Select a playlist to get started</h3>
                    <p class="track-position" id="track-position">Waiting for player status</p>
                </div>
                <div class="time-card">
                    <div class="time-value" id="elapsed-time">00:00</div>
                    <div class="time-caption">ELAPSED</div>
                    <div class="time-divider"></div>
                    <div class="time-value time-remaining" id="remaining-time">--:--</div>
                    <div class="time-caption">REMAINING</div>
                </div>
            </div>
            <div class="progress-track" aria-hidden="true">
                <div class="progress-value" id="progress-value"></div>
            </div>
        </section>

        <section class="dashboard-grid">
            <div class="controls-column panel">
                <label class="field-label" for="playlist-select">Active playlist</label>
                <select id="playlist-select" class="playlist-select" aria-label="Select a playlist">
                    <option value="">Loading playlists...</option>
                </select>

                <div class="volume-heading">
                    <label class="field-label" for="volume-control">Volume</label>
                    <output id="volume-value" for="volume-control">--%</output>
                </div>
                <div class="volume-control">
                    <span class="volume-icon" aria-hidden="true">♪</span>
                    <input id="volume-control" type="range" min="0" max="100" step="1" value="0" aria-label="Player volume">
                </div>

                <p class="field-label playback-label">Playback controls</p>
                <div class="playback-controls">
                    <button class="control-button secondary" type="button" data-action="previous" aria-label="Previous track">
                        <span aria-hidden="true">|◀</span><span>Previous</span>
                    </button>
                    <button class="control-button primary" type="button" data-action="play" aria-label="Play selected playlist">
                        <span aria-hidden="true">▶</span><span>Play</span>
                    </button>
                    <button class="control-button secondary" type="button" data-action="pause" aria-label="Pause playback">
                        <span aria-hidden="true">Ⅱ</span><span>Pause</span>
                    </button>
                    <button class="control-button secondary" type="button" data-action="next" aria-label="Next track">
                        <span aria-hidden="true">▶|</span><span>Next</span>
                    </button>
                    <button class="control-button danger" type="button" data-action="stop" aria-label="Stop playback">
                        <span aria-hidden="true">■</span><span>Stop</span>
                    </button>
                    <button class="control-button danger-outline" type="button" data-action="stop-gracefully" aria-label="Stop gracefully">
                        <span aria-hidden="true">◼</span><span>Stop gracefully</span>
                    </button>
                </div>
                <p class="control-message" id="control-message" role="status" aria-live="polite"></p>
            </div>

            <section class="tracks-column panel" aria-labelledby="tracks-heading">
                <div class="tracks-header">
                    <div>
                        <p class="eyebrow">PLAYLIST QUEUE</p>
                        <h2 id="tracks-heading">Tracks</h2>
                    </div>
                    <span class="track-count" id="track-count">0 tracks</span>
                </div>
                <p class="tracks-current" id="tracks-current">Choose a playlist to view its tracks.</p>
                <ol class="track-list" id="track-list"></ol>
            </section>
        </section>
    </main>
    <dialog class="settings-dialog" id="settings-dialog" aria-labelledby="settings-heading">
        <form id="settings-form">
            <div class="settings-heading">
                <div>
                    <p class="eyebrow">DASHBOARD</p>
                    <h2 id="settings-heading">Settings</h2>
                </div>
                <button class="settings-close" id="settings-close" type="button" aria-label="Close settings">×</button>
            </div>
            <label class="field-label" for="show-name-input">Show name</label>
            <input class="settings-input" id="show-name-input" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Theurer Family Lights">

            <label class="field-label settings-address-label" for="instance-address">Falcon Player IP address or URL</label>
            <input class="settings-input" id="instance-address" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="192.168.1.50">
            <p class="settings-help">The address must match the host used to open this dashboard. To use an IP, open FPP through that IP first, then save it here.</p>
            <p class="settings-message" id="settings-message" role="alert"></p>

            <div class="settings-buttons">
                <button class="control-button secondary" id="settings-cancel" type="button">Cancel</button>
                <button class="control-button primary" type="submit">Save settings</button>
            </div>
        </form>
    </dialog>
</div>

<style>
<?php readfile(__DIR__ . '/dashboard.css'); ?>
</style>
<script>
<?php readfile(__DIR__ . '/dashboard.js'); ?>
</script>

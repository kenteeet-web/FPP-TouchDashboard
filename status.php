<div class="touch-dashboard" id="touch-dashboard" data-season="christmas">
    <div class="festive-lights" aria-hidden="true">
        <span class="bulb-red"></span>
        <span class="bulb-green"></span>
        <span class="bulb-gold"></span>
        <span class="bulb-blue"></span>
        <span class="bulb-purple"></span>
        <span class="bulb-red"></span>
        <span class="bulb-green"></span>
        <span class="bulb-gold"></span>
        <span class="bulb-blue"></span>
        <span class="bulb-purple"></span>
        <span class="bulb-red"></span>
        <span class="bulb-green"></span>
        <span class="bulb-gold"></span>
        <span class="bulb-blue"></span>
        <span class="bulb-purple"></span>
        <span class="bulb-red"></span>
        <span class="bulb-green"></span>
        <span class="bulb-gold"></span>
    </div>
    <header class="dashboard-header">
        <div>
            <h1><a class="dashboard-title-link" id="show-name" href="/" target="_blank" rel="noopener noreferrer" title="Open the full FPP interface in a new tab">Falcon Player</a></h1>
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
            <div class="schedule-time-card" aria-live="polite">
                <div>
                    <p class="schedule-time-label" id="schedule-time-label">FPP SCHEDULE</p>
                    <p class="schedule-time-note" id="schedule-time-note">Loading schedule information.</p>
                </div>
                <time class="schedule-time-value" id="schedule-time-value">--:--</time>
            </div>
            <div class="progress-track" aria-hidden="true">
                <div class="progress-value" id="progress-value"></div>
            </div>
        </section>

        <nav class="screen-tabs" role="tablist" aria-label="Dashboard screens">
            <button class="screen-tab is-active" id="tab-status" type="button" role="tab" aria-selected="true" aria-controls="screen-status" data-screen="status">Status</button>
            <button class="screen-tab" id="tab-schedules" type="button" role="tab" aria-selected="false" aria-controls="screen-schedules" data-screen="schedules">Schedules</button>
            <button class="screen-tab" id="tab-playlists" type="button" role="tab" aria-selected="false" aria-controls="screen-playlists" data-screen="playlists">Playlists</button>
            <button class="screen-tab" id="tab-multisync" type="button" role="tab" aria-selected="false" aria-controls="screen-multisync" data-screen="multisync">MultiSync</button>
            <button class="screen-tab" id="tab-fpp-settings" type="button" role="tab" aria-selected="false" aria-controls="screen-fpp-settings" data-screen="fpp-settings">FPP Settings</button>
        </nav>

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
                    <span class="volume-icon" aria-hidden="true">&#x266A;</span>
                    <input id="volume-control" type="range" min="0" max="100" step="1" value="0" aria-label="Player volume">
                    <label class="repeat-toggle">
                        <input id="repeat-playlist" type="checkbox" aria-label="Repeat playlist">
                        <span>Repeat</span>
                    </label>
                </div>

                <p class="field-label playback-label">Playback controls</p>
                <div class="playback-controls">
                    <button class="control-button primary" type="button" data-action="play" aria-label="Play selected playlist">
                        <span aria-hidden="true">&#x25B6;</span><span>Play</span>
                    </button>
                    <button class="control-button secondary" type="button" data-action="pause" aria-label="Pause playback">
                        <span aria-hidden="true">&#x2016;</span><span>Pause</span>
                    </button>
                    <button class="control-button secondary" type="button" data-action="previous" aria-label="Previous track">
                        <span aria-hidden="true">|&#x25C0;</span><span>Previous</span>
                    </button>
                    <button class="control-button secondary" type="button" data-action="next" aria-label="Next track">
                        <span aria-hidden="true">&#x25B6;|</span><span>Next</span>
                    </button>
                    <button class="control-button danger" type="button" data-action="stop" aria-label="Stop playback">
                        <span aria-hidden="true">&#x25A0;</span><span>Stop</span>
                    </button>
                    <button class="control-button danger-outline" type="button" data-action="stop-gracefully" aria-label="Stop gracefully">
                        <span aria-hidden="true">&#x25FC;</span><span>Stop gracefully</span>
                    </button>
                </div>
                <p class="control-message" id="control-message" role="status" aria-live="polite"></p>
            </div>

            <div class="right-column">
                <section class="right-pane panel" aria-label="Player screens">
                    <div class="screen-content">
                    <section class="screen-view is-active" id="screen-status" role="tabpanel" aria-labelledby="tab-status" data-screen-view="status">
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

                    <section class="screen-view" id="screen-schedules" role="tabpanel" aria-labelledby="tab-schedules" data-screen-view="schedules" hidden>
                        <div class="screen-heading">
                            <div>
                                <p class="eyebrow">AUTOMATION</p>
                                <h2>Schedules</h2>
                            </div>
                            <div class="screen-actions">
                                <button class="small-button" id="schedule-refresh" type="button">Refresh</button>
                                <button class="small-button" id="schedule-add" type="button">Add schedule</button>
                                <button class="small-button primary" id="schedule-save" type="button">Save changes</button>
                            </div>
                        </div>
                        <p class="screen-message" id="schedule-message" role="status" aria-live="polite"></p>
                        <div class="schedule-list" id="schedule-list"></div>
                    </section>

                    <section class="screen-view" id="screen-playlists" role="tabpanel" aria-labelledby="tab-playlists" data-screen-view="playlists" hidden>
                        <div class="screen-heading">
                            <div>
                                <p class="eyebrow">LIBRARY</p>
                                <h2>Playlists</h2>
                            </div>
                            <button class="small-button" id="playlists-refresh" type="button">Refresh</button>
                        </div>
                        <p class="screen-message" id="playlists-message" role="status" aria-live="polite"></p>
                        <div class="playlist-browser" id="playlist-browser"></div>
                    </section>

                    <section class="screen-view" id="screen-multisync" role="tabpanel" aria-labelledby="tab-multisync" data-screen-view="multisync" hidden>
                        <div class="screen-heading">
                            <div>
                                <p class="eyebrow">NETWORK</p>
                                <h2>MultiSync controllers</h2>
                            </div>
                            <button class="small-button" id="multisync-refresh" type="button">Refresh</button>
                        </div>
                        <p class="screen-message" id="multisync-message" role="status" aria-live="polite"></p>
                        <div class="multisync-list" id="multisync-list" role="list" aria-label="MultiSync FPP controllers"></div>
                    </section>

                    <section class="screen-view" id="screen-fpp-settings" role="tabpanel" aria-labelledby="tab-fpp-settings" data-screen-view="fpp-settings" hidden>
                        <div class="screen-heading">
                            <div>
                                <p class="eyebrow">PLAYER CONFIGURATION</p>
                                <h2>FPP Settings</h2>
                            </div>
                            <button class="small-button" id="settings-refresh" type="button">Refresh</button>
                        </div>
                        <p class="screen-message" id="fpp-settings-message" role="status" aria-live="polite">Playback and user interface settings.</p>
                        <div class="fpp-settings-list" id="fpp-settings-list"></div>
                    </section>
                    </div>
                </section>
            </div>
        </section>
    </main>
    <dialog class="settings-dialog" id="settings-dialog" aria-labelledby="settings-heading">
        <form id="settings-form">
            <div class="settings-heading">
                <div>
                    <p class="eyebrow">DASHBOARD</p>
                    <h2 id="settings-heading">Settings</h2>
                </div>
                <button class="settings-close" id="settings-close" type="button" aria-label="Close settings">&times;</button>
            </div>
            <label class="field-label" for="show-name-input">Show name</label>
            <input class="settings-input" id="show-name-input" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Theurer Family Lights">

            <label class="field-label settings-season-label" for="season-select">Season</label>
            <select class="settings-input" id="season-select">
                <option value="christmas">Christmas</option>
                <option value="halloween">Halloween</option>
                <option value="spring">Spring</option>
            </select>

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

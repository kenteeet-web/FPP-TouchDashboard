# FPP Touch Dashboard

A touch-friendly Falcon Player (FPP) plugin for controlling show playback from a phone, tablet, or desktop.

## Features

- Play the selected playlist, resume a paused playlist, pause, stop immediately, or stop gracefully.
- Skip to the next or previous playlist item.
- Adjust the FPP player volume.
- View the current playlist, sequence/song, playback state, elapsed time, and remaining time.
- Use the full-width navigation below Player Status to switch the right pane between Status, Schedules, Playlists, MultiSync, and FPP Settings; on wider screens, the header, player status, navigation, and playback controls stay visible while the right pane scrolls.
- Browse playlists and their tracks, view compact MultiSync controller cards with one reachable IP per FPP system, and edit schedules through FPP's API.
- View and save Playback, Audio/Video, Input/Output, and User Interface settings from the FPP settings API.
- Choose Christmas lights, Halloween ghosts, or spring flowers for the seasonal header decoration.
- See the current schedule end time or the next scheduled start time in 24-hour format.
- Responsive dark dashboard layout for touch screens.

## Install

Install this repository as an FPP plugin using the FPP Plugin Manager's developer/repository install option, or clone it into the FPP plugins directory. The plugin adds **Touch Dashboard** to the FPP status menu and uses FPP's documented `wrap: 0` menu option to display the dashboard without FPP's surrounding header, menu, and footer.

## API

The dashboard calls the local FPP REST API on the same player:

- `GET /api/fppd/status` and `GET /api/playlists` for live state.
- `GET /api/playlist/{name}?mergeSubs=1` for the selected playlist.
- `POST /api/playlist/{name}/start`, `/api/playlists/resume`, `/api/playlists/pause`, `/api/playlists/stop`, and `/api/playlists/stopgracefully` for playback.
- `POST /api/command/{command}` for next/previous playlist item.
- `POST /api/system/volume` for volume.
- `GET /api/schedule`, `POST /api/schedule`, and `POST /api/schedule/reload` for schedule management.
- `GET /api/fppd/multiSyncSystems` and `GET /api/system/status?type=FPP&ip[]=...` for MultiSync discovery and status.
- `GET /api/settings`, `GET /api/settings/{name}`, and `PUT /api/settings/{name}` for Playback, Audio/Video, Input/Output, and User Interface settings.

The settings gear lets the user set a show name and the FPP IP address or URL used to open the dashboard. The show name appears as a link to the full FPP interface, opened in a new tab; if no show name is set, the title is **Falcon Player**. These settings are saved in the current browser's local storage. The address must match the page origin because FPP blocks cross-origin playback commands. The plugin does not use analytics or third-party telemetry.

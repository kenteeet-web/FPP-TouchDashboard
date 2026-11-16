# FPP Touch Dashboard

A touch-friendly Falcon Player (FPP) plugin for controlling show playback from a phone, tablet, or desktop.

## Features

- Play the selected playlist, resume a paused playlist, pause, stop immediately, or stop gracefully.
- Skip to the next or previous playlist item.
- Adjust the FPP player volume.
- View the current playlist, sequence/song, playback state, elapsed time, and remaining time.
- Browse the selected playlist and see which item is currently playing.
- Responsive dark dashboard layout for touch screens.

## Install

Install this repository as an FPP plugin using the FPP Plugin Manager's developer/repository install option, or clone it into the FPP plugins directory. The plugin adds **Touch Dashboard** to the FPP status menu.

## API

The dashboard calls the local FPP REST API on the same player:

- `GET /api/fppd/status` and `GET /api/playlists` for live state.
- `GET /api/playlist/{name}?mergeSubs=1` for the selected playlist.
- `POST /api/playlist/{name}/start`, `/api/playlists/resume`, `/api/playlists/pause`, `/api/playlists/stop`, and `/api/playlists/stopgracefully` for playback.
- `POST /api/command/{command}` for next/previous playlist item.
- `POST /api/system/volume` for volume.

The settings gear lets the user set a show name and the FPP IP address or URL used to open the dashboard. These settings are saved in the current browser's local storage. The address must match the page origin because FPP blocks cross-origin playback commands. The plugin does not use analytics or third-party telemetry.

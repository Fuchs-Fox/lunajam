# LunaJam

Native Jam listening rooms and Discord Listen Together for TIDAL Desktop via [TidaLuna](https://github.com/Inrixia/TidaLuna). Audio and TIDAL credentials stay on each listener's client; only queue state, track identifiers, and playback position sync through the relay.

## Install

1. Open TIDAL Settings -> Plugins -> Plugin Store.
2. Add the store URL:

```text
https://github.com/Fuchs-Fox/lunajam/releases/download/latest/store.json
```

3. Click Install on **LunaJam**.

One-click link on the desktop machine running TIDAL:

```text
tidaluna://settings/store?installfromurl=https://github.com/Fuchs-Fox/lunajam/releases/download/latest/store.json
```

## Features

- **Native TIDAL UI**: Jam button sits in the player utility bar beside Lyrics/Queue; active sessions embed directly above TIDAL's Play Queue with QR/code invite and participant badges on every queued track row.
- **Participant controls**: Click any track avatar or listener avatar to open the mini menu: view their TIDAL profile, toggle their individual `Can add tracks` permission, or `Ban from Jam` (removes their queued tracks and blocks reentry until a new Jam is started).
- **Audio modes**: Guests can switch between synchronized playback on `This device` and remote-control-only `Host speaker` mode.
- **Discord Rich Presence & Listen Together**: Native IPC socket discovery (Windows named pipes, Linux native/Flatpak/Snap Discord/Vesktop/Equibop sockets, and local `arRPC` WebSocket) plus an instant `Listen Together` join button even while listening solo.

## Settings

Configured inside TIDAL Settings -> Plugins -> LunaJam:

- **Discord Rich Presence**: Enable or disable presence updates and `Listen Together` activity links.
- **Listen Together button in Discord**: Share a join link while playing solo or hosting a Jam.
- **Show paused tracks in Discord**: Keep Rich Presence visible when paused.
- **Allow guests to add tracks by default**: Default setting for the `Let others add tracks` room switch.
- **Allow guests to control playback by default**: Default setting for `Let others change what's playing`.
- **Default join audio mode**: Choose `This device` or `Host speaker`.
- **Relay server URL**: Defaults to `https://lunajam.sn0w13.de`.
- **Discord Application ID**: Optional custom Discord client ID.

## Self-hosting the relay

```sh
npm install && npm run build
docker compose up -d
curl -fsS http://127.0.0.1:8642/healthz
```

Or run the bundled Node server directly:

```sh
node server/build/server.mjs
```

Environment variables in `docker-compose.yml`: `LUNAJAM_PORT` (8642), `LUNAJAM_HOST` (0.0.0.0), `LUNAJAM_PUBLIC_URL` (`https://lunajam.sn0w13.de`), `LUNAJAM_MAX_PARTICIPANTS` (32), `LUNAJAM_HOST_GRACE_MS` (20000), `LUNAJAM_ROOM_TTL_MS` (900000), `LUNAJAM_RATE_LIMIT` (60), `LUNAJAM_MAX_CONNECTIONS` (512), `LUNAJAM_IDLE_MS` (90000), `LUNAJAM_MAX_ROOMS` (256), `LUNAJAM_ROOMS_PER_CONN` (2), `LUNAJAM_TLS_CERT`, `LUNAJAM_TLS_KEY`.

## Development

```sh
npm install
npm run lint
npm test
npm run build
npm run dev
```

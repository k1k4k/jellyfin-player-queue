<p align="center">
  <img src="icon.png" width="520" alt="Jellyfin Player Queue">
</p>

<p align="center">
  <a href="https://github.com/k1k4k/jellyfin-player-queue/releases/latest"><img src="https://img.shields.io/github/v/release/k1k4k/jellyfin-player-queue?label=version&color=00a4dc" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Jellyfin-12.x%20%7C%2010.11-00a4dc?logo=jellyfin&logoColor=white" alt="Jellyfin 12.x | 10.11">
  <a href="https://github.com/k1k4k/jellyfin-player-queue/releases"><img src="https://img.shields.io/github/downloads/k1k4k/jellyfin-player-queue/total?color=aa5cc3" alt="Downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/k1k4k/jellyfin-player-queue?color=555" alt="MIT license"></a>
</p>

<p align="center">
  <b>The play queue the Jellyfin web player was missing.</b><br>
  See what's next, switch seasons, reorder, add, remove, without leaving the video.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#features">Features</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="README.fr.md">Version française</a>
</p>

<p align="center"><img src="docs/screenshot.png" width="400" alt="The panel in the player: current season, playing episode highlighted, upcoming episodes in the queue"></p>

## Features

### In the player

A <img src="docs/playlist_play.svg" width="20" height="20" alt="" align="absmiddle"> button next to the settings gear (shortcut `Q`) opens the panel.

- **Netflix-style series view**: the current season, previous episodes included, with `◀ Season N ▶` to switch seasons. The playing episode is highlighted; thumbnails, watched marks and progress just like in the library.
- **Click to play**: an episode already in the queue is played without touching the queue; any other one (previous episode, other season) restarts playback from there to the end of the series.
- **`⋮` menu** on every episode: *Play next*, *Add to end of queue*, *Remove*. A blue check marks what's already coming up.
- **Queue view**: reorder by drag & drop, with a mouse or a finger.

### In the library

- **Pending queue**: *Add to play queue* and *Play next* work even when nothing is playing. Episodes, movies, seasons, series and collections pile up; a badge at the bottom right opens the list, and **Play** starts exactly that selection (200 items max).
- **Collections in chronological order** instead of the order they were added to the library.
- **"Play all from here" on a season** really starts at that season (Jellyfin otherwise restarts from the first episode of the series).

### Everywhere

- **SyncPlay**: every action goes through the group, and the panel follows changes made by other participants.
- Honors Jellyfin's "Play next episode automatically" setting.
- English or French, following the browser language.

<table>
  <tr>
    <td align="center" valign="top"><img src="docs/screen-menu.png" width="240" alt="⋮ menu: Play next, Add to end of queue, Remove"><br><sub><code>⋮</code> menu</sub></td>
    <td align="center" valign="top"><img src="docs/screen-queue.png" width="240" alt="Queue view with drag and drop"><br><sub>Queue view, drag &amp; drop</sub></td>
    <td align="center" valign="top"><img src="docs/screen-pending.png" width="240" alt="Pending queue in the library"><br><sub>Pending queue</sub></td>
  </tr>
</table>

## Installation

### Plugin (recommended)

1. **Dashboard → Plugins → Manage Repositories → `+`**, then the URL matching your Jellyfin:

   | Jellyfin | Repository URL |
   |---|---|
   | 12.x | `https://raw.githubusercontent.com/k1k4k/jellyfin-player-queue/main/manifest.json` |
   | 10.11.x | `https://raw.githubusercontent.com/k1k4k/jellyfin-player-queue/main/manifest-10.11.json` |

2. **Plugins → Available → Jellyfin Player Queue → Install**, then restart Jellyfin.
3. `Ctrl+F5` in the browser.

The plugin injects the script each time the page loads: no Jellyfin file is modified, and nothing needs redoing after a Jellyfin update, Docker included. New versions show up in the dashboard. The plugin settings page can turn the button off without uninstalling.

<details>
<summary><b>Other methods (without the repository, or without a plugin)</b></summary>

#### Plugin, by hand

Download the zip from the [latest release](https://github.com/k1k4k/jellyfin-player-queue/releases/latest) (`_jf12` for Jellyfin 12, `_jf10` for 10.11), unzip it into `<config>/plugins/QueueOsd/` and restart Jellyfin.

#### JavaScript Injector

If you already use [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector): add a script and paste the contents of [`jellyfin-queue-osd.js`](jellyfin-queue-osd.js).

#### Install script

Copies the `.js` into Jellyfin's web folder and adds a `<script>` tag to `index.html` (a backup is made the first time).

> [!WARNING]
> A Jellyfin update replaces `index.html`: run the script again. **With Docker, every image update wipes the install**: use the plugin instead.

```powershell
# Windows
.\install.ps1                                   # auto-detect
.\install.ps1 -WebDir "\\SERVER\jellyfin\web"   # local folder or network share
.\install.ps1 -Uninstall
```

```bash
# Linux
sudo ./install.sh                               # auto-detect
sudo ./install.sh /usr/share/jellyfin/web
```

If `index.html` is read-only but its folder is writable (web folder shared over Samba, file owned by root), `install.ps1` moves the original aside as `index.html.queueosd.orig`; `-Uninstall` restores it.

#### By hand

Copy `jellyfin-queue-osd.js` next to `index.html` in the web folder, and add right before `</head>`:

```html
<script defer="defer" src="jellyfin-queue-osd.js"></script>
```

</details>

## Compatibility

| | |
|---|---|
| **Jellyfin 12.x** | tested (12.1.0) |
| **Jellyfin 10.11** | plugin built, untested |
| **Browser** (desktop, mobile) | yes |
| **Apps that show the web UI** (Jellyfin Media Player, Android app) | should work, untested |
| **Native apps** (Android TV, Swiftfin, Findroid…) | no: they don't use the web player |
| **Remote control / TV mode** | not yet |

The script doesn't patch Jellyfin: it finds the internal player by its content, so it isn't tied to a specific build.

## Coming next

- **More languages**: today the interface is in English and French. More translations are planned, and you'll be able to add your own language file without waiting for a new release.
- **Settings**: server-wide options for the admin (defaults, limits, what users may change) and personal options for each user (panel behavior, display), right from Jellyfin.

Ideas and requests are welcome in the [issues](https://github.com/k1k4k/jellyfin-player-queue/issues).

## Troubleshooting

- **No button in the player**: open the browser console (`F12`). You should see `[PlayerQueue] v… – playbackManager found`. If it says `playbackManager not found`, your Jellyfin version isn't recognized: [open an issue](https://github.com/k1k4k/jellyfin-player-queue/issues) and mention it.
- **Nothing in the console**: the script isn't loaded. Clear the cache (`Ctrl+F5`). With the install script, check the tag in `index.html` and run the install again after each Jellyfin update.
- **"Nothing in the queue"**: a single movie was started, there's nothing after it.
- **The queue shows instead of the seasons**: the console shows `[PlayerQueue] refresh {…}` with `mode: "queue"`. Open an issue with that line.

<details>
<summary><b>Development</b></summary>

#### Client script

`web-dev/` (not versioned) is a copy of jellyfin-web served locally, with `config.json` pointing at a real server: the script is tested without touching the server.

```powershell
python -m http.server 8098 --directory web-dev --bind 127.0.0.1
```

#### Plugin

`Jellyfin.Plugin.QueueOsd/`: one source, two targets, `-p:JellyfinTarget=jf12` (Jellyfin 12, .NET 10, default) and `jf10` (Jellyfin 10.11, .NET 9). `jellyfin-queue-osd.js` is embedded as is. Without a local SDK:

```bash
docker run --rm -v "$PWD:/src" -w /src mcr.microsoft.com/dotnet/sdk:10.0 dotnet build Jellyfin.Plugin.QueueOsd/Jellyfin.Plugin.QueueOsd.csproj -c Release -o out/jf12
```

#### Releasing

1. Bump `VERSION` in `jellyfin-queue-osd.js` and `<Version>` / `<AssemblyVersion>` in the csproj.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`: the **Release** workflow builds both targets, publishes the release and updates the manifests on `main`.

</details>

## License

MIT, see [LICENSE](LICENSE).

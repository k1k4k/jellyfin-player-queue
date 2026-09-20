# Jellyfin Playlist

Une icône **file de lecture** dans le lecteur vidéo web de Jellyfin : pour une série, la saison en cours avec navigation entre saisons « à la Netflix » ; sinon la file de lecture. Un clic lance l'épisode voulu sans quitter le lecteur.

*A "play queue" button for the Jellyfin web video player: for a series, the current season with Netflix-style season navigation; otherwise the play queue. Click any item to play it without leaving the player. English summary at the bottom.*

## Ce que ça fait

- Ajoute un bouton <img src="docs/playlist_play.svg" width="22" height="22" alt="playlist_play" align="absmiddle"> à côté de la roue crantée dans le lecteur vidéo (raccourci clavier : `Q`).
- **Série** (quel que soit le point de départ : série, saison, épisode, « Lire à partir d'ici ») : le panneau affiche la **saison en cours**, épisodes précédents compris, avec `◀ Saison N ▶` et une liste déroulante pour changer de saison. L'épisode en cours est surligné, coche « vu », barre de progression, vignettes.
- Un clic sur un épisode → lecture immédiate. Si l'épisode est déjà dans la file (les suivants), la file est conservée ; sinon (épisode précédent, autre saison) une nouvelle file « à partir d'ici » est construite jusqu'à la fin de la série, **toutes saisons confondues** : la lecture enchaîne bien sur la saison suivante. Le réglage Jellyfin « Lire automatiquement l'épisode suivant » reste respecté.
- Le panneau suit la lecture : quand on passe à la saison suivante, il l'affiche.
- **Autre contenu** (film dans une playlist, musique…) : vue « file de lecture » classique. Un bouton dans l'en-tête permet aussi de basculer sur la file brute pour une série.
- Interface en français ou en anglais selon la langue du navigateur.

## Compatibilité

- Développé et testé sur **Jellyfin 12.1.0** (jellyfin-web 12.x).
- Devrait fonctionner sur 10.10 / 10.11 (même architecture du lecteur), non testé.
- Le script ne modifie pas le bundle Jellyfin : il retrouve le `playbackManager` interne via le runtime webpack en cherchant le module par son contenu, donc il n'est pas lié aux identifiants d'un build précis.
- Navigateurs de bureau et mobile. Pas de navigation clavier/télécommande dans le panneau pour l'instant (layout TV).

## Installation

Quatre méthodes, de la plus simple à la plus manuelle. Dans tous les cas, rechargez la page Jellyfin avec `Ctrl+F5` après l'installation.

### 1. Plugin Jellyfin Playlist (recommandé)

Un vrai plugin Jellyfin : le script est embarqué dans le plugin, servi par le serveur et injecté dans `index.html` **à la volée** (aucune écriture sur le disque, rien à refaire après une mise à jour de Jellyfin, pas de problème de permissions Docker). Mises à jour via le tableau de bord.

1. Tableau de bord → Plugins → Dépôts → « + » et ajoutez l'URL correspondant à votre version de Jellyfin :
   - **Jellyfin 12.x** : `https://raw.githubusercontent.com/k1k4k/jellyfin-playlist/main/manifest.json`
   - **Jellyfin 10.11.x** : `https://raw.githubusercontent.com/k1k4k/jellyfin-playlist/main/manifest-10.11.json`
2. Catalogue → **Jellyfin Playlist** → Installer, puis redémarrez Jellyfin.
3. `Ctrl+F5` dans le navigateur. La page de configuration du plugin (Tableau de bord → Plugins → Jellyfin Playlist) permet de désactiver le bouton sans désinstaller.

Installation manuelle du plugin : téléchargez le zip de la [dernière release](https://github.com/k1k4k/jellyfin-playlist/releases) (`_jf12` pour Jellyfin 12, `_jf10` pour 10.11), dézippez-le dans `<config>/plugins/QueueOsd/` et redémarrez.

### 2. Plugin « JavaScript Injector »

1. Dans Jellyfin → Tableau de bord → Plugins → Dépôts, ajoutez le dépôt de [Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) (voir leur README : il y a une URL de manifeste spécifique pour Jellyfin 12).
2. Installez le plugin **JavaScript Injector** (et idéalement [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation), que l'injecteur utilise pour ne pas toucher à `index.html`). Redémarrez Jellyfin.
3. Dans la configuration du plugin, ajoutez un script, collez le contenu complet de [`jellyfin-queue-osd.js`](jellyfin-queue-osd.js), enregistrez.

### 3. Script d'installation (Windows / Linux / Docker)

Copie le `.js` dans le dossier web de Jellyfin et ajoute une balise `<script>` dans `index.html` (sauvegarde `index.html.queueosd.bak` créée la première fois). Relancer le script après une mise à jour de Jellyfin, qui écrase `index.html`.

Si `index.html` n'est pas réinscriptible mais que le dossier l'est (cas typique : Jellyfin sous Linux, dossier web exposé en partage Samba, `index.html` appartenant à root), `install.ps1` met l'original de côté en `index.html.queueosd.orig` et en crée un nouveau ; `-Uninstall` le restaure.

**Windows (PowerShell)**

```powershell
.\install.ps1
# ou en précisant le dossier (chemin local ou partage réseau) :
.\install.ps1 -WebDir "C:\Program Files\Jellyfin\Server\jellyfin-web"
# désinstaller :
.\install.ps1 -Uninstall
```

**Linux / Docker**

```bash
sudo ./install.sh                         # détection auto (/usr/share/jellyfin/web, …)
sudo ./install.sh /usr/share/jellyfin/web
docker cp jellyfin-queue-osd.js jellyfin:/jellyfin/jellyfin-web/   # image officielle
docker exec jellyfin sh -c 'cd /jellyfin/jellyfin-web && sed -i "s#</head>#<script defer src=\"jellyfin-queue-osd.js\"></script></head>#" index.html'
```

### 4. À la main

1. Copiez `jellyfin-queue-osd.js` dans le dossier web de Jellyfin (celui qui contient `index.html`).
2. Dans `index.html`, juste avant `</head>`, ajoutez :
   ```html
   <script defer="defer" src="jellyfin-queue-osd.js"></script>
   ```

## Utilisation

Lancez une saison, une playlist, ou « Lire à partir d'ici » sur un épisode. Dans le lecteur, cliquez sur l'icône de file de lecture (ou appuyez sur `Q`). Cliquez sur un épisode pour le lire. `Échap`, un clic à côté ou l'icône referment le panneau.

## Dépannage

- **Pas d'icône dans le lecteur** : ouvrez la console du navigateur (F12). Vous devez voir `[JellyfinPlaylist] v… – playbackManager found`. Si vous voyez `playbackManager not found`, la version de jellyfin-web n'est pas reconnue — ouvrez une issue avec votre version.
- **Le script n'est pas chargé du tout** (rien dans la console) : vérifiez que `index.html` contient bien la balise, et videz le cache (`Ctrl+F5`). Après une mise à jour de Jellyfin, relancez l'installation.
- **« Aucun élément dans la file »** : vous avez lancé un film seul (pas de série, pas de playlist).
- **Pas de saisons, juste la file** : la console affiche `[JellyfinPlaylist] refresh {...}` avec `mode: "queue"` — l'élément en cours n'est pas reconnu comme épisode d'une série ; ouvrez une issue avec cette ligne.

## Développement

### Script client

`web-dev/` (non versionné) est une copie du build jellyfin-web servie en local avec `config.json` pointant vers un vrai serveur Jellyfin : le client local parle à l'API distante, le serveur n'est pas modifié.

```powershell
python -m http.server 8098 --directory web-dev --bind 127.0.0.1
```

### Plugin

`Jellyfin.Plugin.QueueOsd/` — .NET, une même source pour deux cibles : `-p:JellyfinTarget=jf12` (Jellyfin 12, .NET 10, défaut) et `jf10` (Jellyfin 10.11, .NET 9). Le fichier `jellyfin-queue-osd.js` à la racine est embarqué tel quel. Sans SDK local, via Docker :

```bash
docker run --rm -v "$PWD:/src" -w /src mcr.microsoft.com/dotnet/sdk:10.0 dotnet build Jellyfin.Plugin.QueueOsd/Jellyfin.Plugin.QueueOsd.csproj -c Release -o out/jf12
```

Pour tester : copier `out/jf12/Jellyfin.Plugin.QueueOsd.dll` dans `<config>/plugins/QueueOsd_x/` d'un Jellyfin 12 jetable (`docker run -p 8097:8096 -v ./test-jellyfin/config:/config jellyfin/jellyfin:12.1`), puis `curl localhost:8097/web/index.html | grep queue-osd`.

### Publier une version

1. Mettre à jour `VERSION` dans `jellyfin-queue-osd.js` et `<Version>`/`<AssemblyVersion>` dans le csproj.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` — le workflow **Release** compile les deux cibles, publie la release GitHub avec les zips, et met à jour `manifest.json` / `manifest-10.11.json` sur `main` (les serveurs qui ont le dépôt voient la mise à jour).

## Licence

MIT — voir [LICENSE](LICENSE).

---

## English

Adds a **play queue** button (`Q`) to the Jellyfin web video player, next to the settings gear. For a series it shows the **current season** (previous episodes included) with `◀ Season N ▶` navigation and a season dropdown; clicking an episode plays it right away. Episodes already in the queue are jumped to in place; others (previous episodes, other seasons) start a new "play from here" queue up to the end of the series, across seasons, so playback continues into the next season. For non-series content it lists the play queue.

Built and tested on Jellyfin **12.1.0**; should work on 10.10+/10.11 (untested). It does not patch the Jellyfin bundle — it locates the internal `playbackManager` through the webpack runtime by module content, so it is not tied to a specific build's module ids.

**Install (plugin, recommended)**: Dashboard → Plugins → Repositories → add `https://raw.githubusercontent.com/k1k4k/jellyfin-playlist/main/manifest.json` (Jellyfin 12) or `.../manifest-10.11.json` (Jellyfin 10.11), install **Jellyfin Playlist** from the catalog, restart Jellyfin, `Ctrl+F5`. The plugin injects the script into `index.html` at request time (no disk writes, survives Jellyfin updates). Alternatives: paste `jellyfin-queue-osd.js` into the [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) plugin, run `install.ps1` / `install.sh`, or add the `<script>` tag by hand.

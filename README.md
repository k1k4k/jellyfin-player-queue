# Jellyfin Queue OSD

Une icône **file de lecture** dans le lecteur vidéo web de Jellyfin : voir les épisodes suivants (ou le contenu de la playlist en cours) et lancer directement celui que vous voulez, sans quitter le lecteur.

*A "play queue" button for the Jellyfin web video player: see what's up next and jump to any item without leaving the player. English summary at the bottom.*

## Ce que ça fait

- Ajoute un bouton ![playlist_play](https://img.shields.io/badge/-%E2%96%B6%20playlist__play-333) à côté de la roue crantée dans le lecteur vidéo (raccourci clavier : `Q`).
- Le panneau liste la file de lecture courante : c'est celle que Jellyfin construit tout seul quand vous lancez une saison, faites « Lire à partir d'ici », lancez une playlist, ou simplement un épisode avec la lecture auto du suivant.
- Élément en cours surligné, éléments déjà vus grisés, coche « vu », barre de progression, vignettes.
- Un clic sur un élément → lecture immédiate, la file reste la même (les suivants s'enchaînent normalement).
- Interface en français ou en anglais selon la langue du navigateur.

## Compatibilité

- Développé et testé sur **Jellyfin 12.1.0** (jellyfin-web 12.x).
- Devrait fonctionner sur 10.10 / 10.11 (même architecture du lecteur), non testé.
- Le script ne modifie pas le bundle Jellyfin : il retrouve le `playbackManager` interne via le runtime webpack en cherchant le module par son contenu, donc il n'est pas lié aux identifiants d'un build précis.
- Navigateurs de bureau et mobile. Pas de navigation clavier/télécommande dans le panneau pour l'instant (layout TV).

## Installation

Trois méthodes, de la plus simple à la plus manuelle. Dans tous les cas, rechargez la page Jellyfin avec `Ctrl+F5` après l'installation.

### 1. Plugin « JavaScript Injector » (recommandé, survit aux mises à jour)

1. Dans Jellyfin → Tableau de bord → Plugins → Dépôts, ajoutez le dépôt de [Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) (voir leur README : il y a une URL de manifeste spécifique pour Jellyfin 12).
2. Installez le plugin **JavaScript Injector** (et idéalement [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation), que l'injecteur utilise pour ne pas toucher à `index.html`). Redémarrez Jellyfin.
3. Dans la configuration du plugin, ajoutez un script, collez le contenu complet de [`jellyfin-queue-osd.js`](jellyfin-queue-osd.js), enregistrez.

### 2. Script d'installation (Windows / Linux / Docker)

Copie le `.js` dans le dossier web de Jellyfin et ajoute une balise `<script>` dans `index.html` (sauvegarde `index.html.queueosd.bak` créée la première fois). Relancer le script après une mise à jour de Jellyfin, qui écrase `index.html`.

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

### 3. À la main

1. Copiez `jellyfin-queue-osd.js` dans le dossier web de Jellyfin (celui qui contient `index.html`).
2. Dans `index.html`, juste avant `</head>`, ajoutez :
   ```html
   <script defer="defer" src="jellyfin-queue-osd.js"></script>
   ```

## Utilisation

Lancez une saison, une playlist, ou « Lire à partir d'ici » sur un épisode. Dans le lecteur, cliquez sur l'icône de file de lecture (ou appuyez sur `Q`). Cliquez sur un épisode pour le lire. `Échap`, un clic à côté ou l'icône referment le panneau.

## Dépannage

- **Pas d'icône dans le lecteur** : ouvrez la console du navigateur (F12). Vous devez voir `[QueueOSD] v… – playbackManager found`. Si vous voyez `playbackManager not found`, la version de jellyfin-web n'est pas reconnue — ouvrez une issue avec votre version.
- **Le script n'est pas chargé du tout** (rien dans la console) : vérifiez que `index.html` contient bien la balise, et videz le cache (`Ctrl+F5`). Après une mise à jour de Jellyfin, relancez l'installation.
- **« Aucun élément dans la file »** : vous avez lancé un film seul, ou un épisode sans lecture auto du suivant. Lancez la saison ou utilisez « Lire à partir d'ici ».

## Développement

`web-dev/` (non versionné) est une copie du build jellyfin-web servie en local avec `config.json` pointant vers un vrai serveur Jellyfin : le client local parle à l'API distante, le serveur n'est pas modifié.

```powershell
python -m http.server 8098 --directory web-dev --bind 127.0.0.1
```

## Licence

MIT — voir [LICENSE](LICENSE).

---

## English

Adds a **play queue** button (`Q`) to the Jellyfin web video player, next to the settings gear. The panel shows the current queue (next episodes when you play a season, "Play from here", a playlist, or a single episode with auto-play next), highlights the current item, and lets you click any item to play it right away without leaving the player.

Built and tested on Jellyfin **12.1.0**; should work on 10.10+/10.11 (untested). It does not patch the Jellyfin bundle — it locates the internal `playbackManager` through the webpack runtime by module content, so it is not tied to a specific build's module ids.

**Install**: either paste the content of `jellyfin-queue-osd.js` into the [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) plugin (recommended, survives updates), or run `install.ps1` / `install.sh` (copies the file into the web folder and adds a `<script>` tag to `index.html`; re-run after a Jellyfin update), or do it by hand. Reload with `Ctrl+F5`.

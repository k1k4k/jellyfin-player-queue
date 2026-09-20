# Jellyfin Queue OSD

Une icône **file de lecture** dans le lecteur vidéo web de Jellyfin : pour une série, la saison en cours avec navigation entre saisons « à la Netflix » ; sinon la file de lecture. Un clic lance l'épisode voulu sans quitter le lecteur.

*A "play queue" button for the Jellyfin web video player: for a series, the current season with Netflix-style season navigation; otherwise the play queue. Click any item to play it without leaving the player. English summary at the bottom.*

## Ce que ça fait

- Ajoute un bouton ![playlist_play](https://img.shields.io/badge/-%E2%96%B6%20playlist__play-333) à côté de la roue crantée dans le lecteur vidéo (raccourci clavier : `Q`).
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

Trois méthodes, de la plus simple à la plus manuelle. Dans tous les cas, rechargez la page Jellyfin avec `Ctrl+F5` après l'installation.

### 1. Plugin « JavaScript Injector » (recommandé, survit aux mises à jour)

1. Dans Jellyfin → Tableau de bord → Plugins → Dépôts, ajoutez le dépôt de [Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) (voir leur README : il y a une URL de manifeste spécifique pour Jellyfin 12).
2. Installez le plugin **JavaScript Injector** (et idéalement [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation), que l'injecteur utilise pour ne pas toucher à `index.html`). Redémarrez Jellyfin.
3. Dans la configuration du plugin, ajoutez un script, collez le contenu complet de [`jellyfin-queue-osd.js`](jellyfin-queue-osd.js), enregistrez.

### 2. Script d'installation (Windows / Linux / Docker)

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
- **« Aucun élément dans la file »** : vous avez lancé un film seul (pas de série, pas de playlist).
- **Pas de saisons, juste la file** : la console affiche `[QueueOSD] refresh {...}` avec `mode: "queue"` — l'élément en cours n'est pas reconnu comme épisode d'une série ; ouvrez une issue avec cette ligne.

## Développement

`web-dev/` (non versionné) est une copie du build jellyfin-web servie en local avec `config.json` pointant vers un vrai serveur Jellyfin : le client local parle à l'API distante, le serveur n'est pas modifié.

```powershell
python -m http.server 8098 --directory web-dev --bind 127.0.0.1
```

## Licence

MIT — voir [LICENSE](LICENSE).

---

## English

Adds a **play queue** button (`Q`) to the Jellyfin web video player, next to the settings gear. For a series it shows the **current season** (previous episodes included) with `◀ Season N ▶` navigation and a season dropdown; clicking an episode plays it right away. Episodes already in the queue are jumped to in place; others (previous episodes, other seasons) start a new "play from here" queue up to the end of the series, across seasons, so playback continues into the next season. For non-series content it lists the play queue.

Built and tested on Jellyfin **12.1.0**; should work on 10.10+/10.11 (untested). It does not patch the Jellyfin bundle — it locates the internal `playbackManager` through the webpack runtime by module content, so it is not tied to a specific build's module ids.

**Install**: either paste the content of `jellyfin-queue-osd.js` into the [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) plugin (recommended, survives updates), or run `install.ps1` / `install.sh` (copies the file into the web folder and adds a `<script>` tag to `index.html`; re-run after a Jellyfin update), or do it by hand. Reload with `Ctrl+F5`.

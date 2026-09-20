#!/usr/bin/env sh
# Installe (ou désinstalle) Jellyfin Playlist dans le dossier web de Jellyfin.
#
#   ./install.sh                      # détection automatique du dossier web
#   ./install.sh /usr/share/jellyfin/web
#   ./install.sh /jellyfin/jellyfin-web --uninstall   # image Docker officielle
#
# Idempotent : relancer le script met simplement à jour le .js.
# Une mise à jour de Jellyfin remplace index.html — relancez ce script ensuite.

set -eu

SCRIPT_NAME="jellyfin-queue-osd.js"
HERE="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$HERE/$SCRIPT_NAME"
WEBDIR=""
UNINSTALL=0

for arg in "$@"; do
    case "$arg" in
        --uninstall|-u) UNINSTALL=1 ;;
        *) WEBDIR="$arg" ;;
    esac
done

if [ -z "$WEBDIR" ]; then
    for c in /usr/share/jellyfin/web /usr/lib/jellyfin/bin/jellyfin-web /jellyfin/jellyfin-web /opt/jellyfin/jellyfin-web /config/jellyfin-web; do
        if [ -f "$c/index.html" ]; then WEBDIR="$c"; break; fi
    done
    if [ -z "$WEBDIR" ]; then
        echo "Dossier web Jellyfin introuvable. Passez-le en argument (il doit contenir index.html)." >&2
        exit 1
    fi
fi

INDEX="$WEBDIR/index.html"
BACKUP="$WEBDIR/index.html.queueosd.bak"
TARGET="$WEBDIR/$SCRIPT_NAME"

[ -f "$INDEX" ] || { echo "index.html introuvable dans $WEBDIR" >&2; exit 1; }

if [ "$UNINSTALL" = 1 ]; then
    if grep -q "$SCRIPT_NAME" "$INDEX"; then
        sed -i.tmp "s#<script[^>]*$SCRIPT_NAME[^>]*></script>##g" "$INDEX" && rm -f "$INDEX.tmp"
        echo "Balise <script> retirée de index.html"
    else
        echo "Aucune balise à retirer dans index.html"
    fi
    rm -f "$TARGET" && echo "Supprimé : $TARGET"
    echo "Désinstallation terminée."
    exit 0
fi

[ -f "$SOURCE" ] || { echo "$SCRIPT_NAME introuvable à côté de install.sh" >&2; exit 1; }

VERSION="$(sed -n 's/.*v\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/p' "$SOURCE" | head -n 1)"
[ -n "$VERSION" ] || VERSION="$(date +%Y%m%d%H%M)"

cp -f "$SOURCE" "$TARGET"
echo "Copié : $TARGET"

TAG="<script defer=\"defer\" src=\"$SCRIPT_NAME?v=$VERSION\"></script>"

if grep -q "$SCRIPT_NAME" "$INDEX"; then
    sed -i.tmp "s#<script[^>]*$SCRIPT_NAME[^>]*></script>#$TAG#" "$INDEX" && rm -f "$INDEX.tmp"
    echo "index.html : balise mise à jour (v$VERSION)"
else
    [ -f "$BACKUP" ] || { cp "$INDEX" "$BACKUP"; echo "Sauvegarde : $BACKUP"; }
    grep -q '</head>' "$INDEX" || { echo "index.html inattendu : pas de </head>" >&2; exit 1; }
    sed -i.tmp "s#</head>#$TAG</head>#" "$INDEX" && rm -f "$INDEX.tmp"
    echo "index.html : balise ajoutée (v$VERSION)"
fi

echo "Installation terminée. Rechargez la page web de Jellyfin (Ctrl+F5)."

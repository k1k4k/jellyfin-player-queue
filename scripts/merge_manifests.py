#!/usr/bin/env python3
"""Fusionne les manifestes des plugins Jellyfin k1k4k en un seul dépôt de plugins.

Chaque plugin publie ses propres manifestes dans son dépôt (manifest.json pour Jellyfin 12,
manifest-10.11.json pour 10.11), mis à jour par son workflow Release. Ce script les réunit.

    # dépôt central (k1k4k/jellyfin-plugins) : reconstruit les manifestes communs
    python scripts/merge_manifests.py build --sources sources.json

    # dépôt d'un plugin (ex. jellyfin-player-queue) : ajoute à ses manifestes les autres
    # plugins du dépôt central, pour que ceux qui ont ajouté son URL les voient aussi
    python scripts/merge_manifests.py sync --own-guid ae203062-4b00-4c07-a7f6-83e69982d951

Règle commune : chaque plugin vient de son propre dépôt (repéré par son GUID), jamais d'une
copie. Un dépôt injoignable ne fait pas disparaître son plugin : l'entrée déjà présente est
gardée. Le fichier n'est réécrit que si son contenu change.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

MANIFESTS = ["manifest.json", "manifest-10.11.json"]
CENTRAL = "https://raw.githubusercontent.com/k1k4k/jellyfin-plugins/main"


def fetch_json(url):
    """Contenu JSON de l'URL, ou None si elle est absente / injoignable / invalide."""
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "k1k4k-manifest-merge"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 - URL raw.githubusercontent.com fixe
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  {url} : HTTP {e.code}", file=sys.stderr)
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        print(f"  {url} : {e}", file=sys.stderr)
    return None


def load_local(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def find(manifest, guid):
    for p in manifest or []:
        if isinstance(p, dict) and p.get("guid") == guid:
            return p
    return None


def write_if_changed(path, manifest):
    text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old == text:
        print(f"{path} : inchangé")
        return False
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(f"{path} : mis à jour ({', '.join(p['name'] for p in manifest)})")
    return True


def sort_plugins(plugins):
    return sorted(plugins, key=lambda p: p.get("name", "").lower())


def build(args):
    with open(args.sources, encoding="utf-8") as f:
        sources = json.load(f)
    for name in MANIFESTS:
        path = os.path.join(args.out, name)
        previous = load_local(path)
        plugins = []
        for src in sources:
            guid, repo = src["guid"], src["repo"]
            url = f"https://raw.githubusercontent.com/{repo}/{src.get('branch', 'main')}/{name}"
            entry = find(fetch_json(url), guid)
            if entry is None:
                entry = find(previous, guid)
                if entry is not None:
                    print(f"  {repo} : {name} indisponible, entrée précédente gardée", file=sys.stderr)
            if entry is not None and entry.get("versions"):
                plugins.append(entry)
        write_if_changed(path, sort_plugins(plugins))


def sync(args):
    for name in MANIFESTS:
        path = os.path.join(args.out, name)
        local = load_local(path)
        own = find(local, args.own_guid)
        central = fetch_json(f"{args.central}/{name}")
        if central is None:
            print(f"{path} : dépôt central injoignable, rien changé", file=sys.stderr)
            continue
        others = [p for p in central if isinstance(p, dict) and p.get("guid") != args.own_guid and p.get("versions")]
        plugins = ([own] if own else []) + others
        write_if_changed(path, sort_plugins(plugins))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="dépôt central : réunit les manifestes de chaque plugin")
    b.add_argument("--sources", default="sources.json")
    b.add_argument("--out", default=".")
    s = sub.add_parser("sync", help="dépôt d'un plugin : ajoute les autres plugins du dépôt central")
    s.add_argument("--own-guid", required=True)
    s.add_argument("--central", default=CENTRAL)
    s.add_argument("--out", default=".")
    args = ap.parse_args()
    build(args) if args.cmd == "build" else sync(args)


if __name__ == "__main__":
    main()

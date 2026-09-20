#!/usr/bin/env python3
"""Empaquète le plugin et met à jour le manifest du dépôt de plugins Jellyfin.

    python scripts/package.py --target jf12 --dll Jellyfin.Plugin.QueueOsd/bin/Release/net10.0/Jellyfin.Plugin.QueueOsd.dll \
        --repo k1k4k/jellyfin-player-queue --tag v0.3.0 [--changelog "..."]

- crée dist/jellyfin-player-queue_<version>_<target>.zip (la DLL à la racine du zip)
- calcule le MD5 attendu par Jellyfin
- ajoute/remplace l'entrée de version dans manifest.json (jf12) ou manifest-10.11.json (jf10)
Le sourceUrl pointe vers l'asset de la release GitHub du tag.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import zipfile

GUID = "ae203062-4b00-4c07-a7f6-83e69982d951"
NAME = "Jellyfin Player Queue"
TARGETS = {
    "jf12": {"manifest": "manifest.json", "targetAbi": "12.0.0.0", "framework": "net10.0"},
    "jf10": {"manifest": "manifest-10.11.json", "targetAbi": "10.11.0.0", "framework": "net9.0"},
}


def read_version(csproj):
    src = open(csproj, encoding="utf-8").read()
    m = re.search(r"<AssemblyVersion>([\d.]+)</AssemblyVersion>", src)
    if not m:
        raise SystemExit("AssemblyVersion introuvable dans " + csproj)
    return m.group(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=TARGETS, required=True)
    ap.add_argument("--dll", required=True)
    ap.add_argument("--repo", required=True, help="owner/name GitHub")
    ap.add_argument("--tag", required=True, help="tag de la release, ex. v0.3.0")
    ap.add_argument("--changelog", default="")
    ap.add_argument("--out", default="dist")
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    t = TARGETS[args.target]
    version = read_version(os.path.join(root, "Jellyfin.Plugin.QueueOsd", "Jellyfin.Plugin.QueueOsd.csproj"))

    os.makedirs(args.out, exist_ok=True)
    zip_name = f"jellyfin-player-queue_{version}_{args.target}.zip"
    zip_path = os.path.join(args.out, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(args.dll, os.path.basename(args.dll))
    md5 = hashlib.md5(open(zip_path, "rb").read()).hexdigest()  # noqa: S324 - format imposé par Jellyfin

    manifest_path = os.path.join(root, t["manifest"])
    if os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path, encoding="utf-8"))
    else:
        manifest = [{
            "guid": GUID,
            "name": NAME,
            "description": "Bouton file de lecture dans le lecteur vidéo web : saison en cours, navigation entre saisons, lecture directe d'un épisode. "
                           "Play queue button in the web video player: current season, season navigation, click-to-play.",
            "overview": "File de lecture / saisons dans le lecteur vidéo. Play queue & seasons in the video player.",
            "owner": args.repo.split("/")[0],
            "category": "General",
            "imageUrl": f"https://raw.githubusercontent.com/{args.repo}/main/icon.png",
            "versions": [],
        }]

    entry = {
        "version": version,
        "changelog": args.changelog or f"https://github.com/{args.repo}/releases/tag/{args.tag}",
        "targetAbi": t["targetAbi"],
        "sourceUrl": f"https://github.com/{args.repo}/releases/download/{args.tag}/{zip_name}",
        "checksum": md5,
        "timestamp": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    versions = [v for v in manifest[0]["versions"] if v["version"] != version]
    versions.insert(0, entry)
    versions.sort(key=lambda v: tuple(int(x) for x in v["version"].split(".")), reverse=True)
    manifest[0]["versions"] = versions

    with open(manifest_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"{zip_path}  md5={md5}  -> {t['manifest']} (targetAbi {t['targetAbi']})")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""ExtracTerre v2.3 — épingle les scripts CDN et ajoute les empreintes SRI dans index.html.

À lancer UNE fois sur un poste connecté à internet, depuis la racine du dépôt :
    python3 tools/compute_sri.py            # écrit index.html
    python3 tools/compute_sri.py --dry-run  # affiche seulement

- Les versions flottantes (ex. @supabase/supabase-js@2) sont résolues en version exacte via l'API jsDelivr.
- Chaque <script src="https://..."> reçoit integrity="sha384-..." et crossorigin="anonymous".
Si un CDN modifie un fichier, le navigateur refusera alors de l'exécuter (protection supply-chain).
"""
import base64, hashlib, json, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ExtracTerre-SRI/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def pin_jsdelivr(url):
    m = re.match(r"https://cdn\.jsdelivr\.net/npm/((?:@[^/]+/)?[^@/]+)@([^/]+)(/.*)$", url)
    if not m or re.fullmatch(r"\d+\.\d+\.\d+", m.group(2)):
        return url
    name, rng, path = m.groups()
    data = json.loads(fetch(f"https://data.jsdelivr.com/v1/package/resolve/npm/{name}@{rng}"))
    version = data.get("version")
    return f"https://cdn.jsdelivr.net/npm/{name}@{version}{path}" if version else url

def main():
    dry = "--dry-run" in sys.argv
    html = INDEX.read_text(encoding="utf-8")
    def repl(m):
        tag = m.group(0)
        src = m.group(1)
        pinned = pin_jsdelivr(src)
        digest = base64.b64encode(hashlib.sha384(fetch(pinned)).digest()).decode()
        tag = tag.replace(src, pinned)
        tag = re.sub(r'\s+integrity="[^"]*"', "", tag)
        tag = re.sub(r'\s+crossorigin="[^"]*"', "", tag)
        tag = tag.replace("<script", f'<script integrity="sha384-{digest}" crossorigin="anonymous"', 1)
        print(f"{pinned}\n  sha384-{digest}")
        return tag
    out = re.sub(r'<script[^>]*\ssrc="(https://[^"]+)"[^>]*></script>', repl, html)
    if not dry:
        INDEX.write_text(out, encoding="utf-8")
        print("index.html mis à jour.")

if __name__ == "__main__":
    main()

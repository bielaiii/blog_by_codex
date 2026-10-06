#!/usr/bin/env python3
"""Refresh browser assets for local/offline use. No Docker or npm downloads."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
ASSETS = {
    "marked/marked.min.js": "https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js",
    "marked/LICENSE.md": "https://cdn.jsdelivr.net/npm/marked@15.0.12/LICENSE.md",
    "highlightjs/highlight.min.js": "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js",
    "highlightjs/github-dark.min.css": "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css",
    "highlightjs/LICENSE": "https://raw.githubusercontent.com/highlightjs/highlight.js/11.11.1/LICENSE",
    "mermaid/mermaid.min.js": "https://cdn.jsdelivr.net/npm/mermaid@10.9.8/dist/mermaid.min.js",
    "mermaid/LICENSE": "https://raw.githubusercontent.com/mermaid-js/mermaid/develop/LICENSE",
    "katex/katex.min.js": "https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.js",
    "katex/katex.min.css": "https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css",
    "katex/auto-render.min.js": "https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/contrib/auto-render.min.js",
    "katex/LICENSE": "https://cdn.jsdelivr.net/npm/katex@0.18.1/LICENSE",
    "fonts/Outfit-OFL.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/OFL.txt",
    "fonts/NotoSerifSC-OFL.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt",
}
FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Outfit:wght@300;400;500;600;700;800&display=swap"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"


def fetch(url):
    try:
        return subprocess.run([
            "curl", "--fail", "--silent", "--show-error", "--location",
            "--retry", "3", "--retry-all-errors", "--connect-timeout", "10",
            "--max-time", "30", "--user-agent", USER_AGENT, url
        ], check=True, capture_output=True).stdout
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"Failed to download {url}: {error.stderr.decode()}") from error


def main():
    with ThreadPoolExecutor(max_workers=8) as pool:
        downloaded = dict(zip(ASSETS, pool.map(fetch, ASSETS.values())))
        css = downloaded["katex/katex.min.css"].decode()
        katex_fonts = set(re.findall(r"url\((fonts/[^)]+)\)", css))
        font_assets = {
            f"katex/{path}": f"https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/{path}"
            for path in sorted(katex_fonts)
        }
        font_css = fetch(FONT_CSS_URL).decode()
        urls = sorted(set(re.findall(r"url\((https://fonts.gstatic.com/[^)]+)\)", font_css)))
        for url in urls:
            filename = "font-" + hashlib.sha256(url.encode()).hexdigest()[:20] + Path(url).suffix
            font_assets[f"fonts/{filename}"] = url
            font_css = font_css.replace(url, filename)
        downloaded.update(zip(font_assets, pool.map(fetch, font_assets.values())))
        downloaded["fonts/fonts.css"] = font_css.encode()

    sources = {**ASSETS, **font_assets, "fonts/fonts.css": FONT_CSS_URL}
    manifest = {}
    for relative_path, data in sorted(downloaded.items()):
        path = ROOT / "vendor" / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        manifest[relative_path] = {"source": sources[relative_path], "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
    (ROOT / "vendor/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Saved {len(downloaded)} browser assets ({sum(map(len, downloaded.values())) / 1024 / 1024:.1f} MiB) to vendor/")


if __name__ == "__main__":
    main()

# Local browser assets

These files are served by the blog itself so navigation, Markdown, code highlighting,
math, diagrams and typography work without CDN access.

- Marked 15.0.12: MIT, `marked/LICENSE.md`
- Highlight.js 11.11.1: BSD-3-Clause, `highlightjs/LICENSE`
- Mermaid 10.9.8: MIT, `mermaid/LICENSE`
- KaTeX 0.18.1: MIT, `katex/LICENSE`
- Outfit and Noto Serif SC: SIL Open Font License, `fonts/*-OFL.txt`

`manifest.json` records the upstream URL, SHA-256 and size of each downloaded file.
Library versions match those used by the page before local vendoring. Google Fonts
CSS and font subsets are captured at refresh time; the manifest records their URLs.

To refresh intentionally, use `python3 scripts/vendor-assets.py` (Python 3 and curl,
with internet access). Normal startup and image creation do not run this script.

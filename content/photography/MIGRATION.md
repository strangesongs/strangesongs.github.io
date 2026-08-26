# Photography → local portfolio migration

Status: **coming soon** on the live page. Flickr gallery removed from the site. Album folders are empty and ready for web-sized JPEGs.

## Goal for the next chat

Build a fully local photography portfolio:

- Images live in git under `content/photography/albums/{slug}/`
- No Flickr CDN, no Flickr API, no `photos.jsonl` bookkeeping
- Build script scans folders → generates whatever the gallery needs
- Watch mode rebuilds when photos are added/changed
- Natural aspect-ratio grid + lightbox (restore UX from prior `photography.js`, but load local files)

## Current repo state (after this prep)

| Path | Role |
|------|------|
| `photography.html` | Placeholder: wordmark + “portfolio coming soon” |
| `photography.css` | Minimal styles for placeholder |
| `content/photography/MIGRATION.md` | This file |
| `content/photography/albums/{slug}/` | Empty folders (`.gitkeep`) — drop JPEGs here |
| `content/photography/albums/_inbox/` | Staging for unsorted exports |

Removed / obsolete for the new system (do not revive Flickr path):

- Runtime Flickr CDN usage
- Generated `photos.json` / `albums.json` / `album-photos/`
- Flickr `photos.jsonl` authoring
- Old `photography.js` gallery client (deleted; rewrite for local files)

## How to sort photos (human steps)

1. Export **web-sized** JPEGs from masters (long edge ~1600–2048px). Do **not** commit full-resolution scans.
2. Drop files into album folders under `content/photography/albums/`. Use `_inbox/` first if unsure.
3. Rename for order if needed (`01.jpg`, `02.jpg`, …) — build should sort by filename.
4. Add/rename/delete album folders freely; slug = folder name.
5. When ready, start a new agent chat with the prompt below.

## Suggested album folders (seeded)

- `_inbox` — unsorted
- `brazil-2024`
- `los-angeles`
- `youngstown`
- `new-orleans`
- `expired`
- `chicago`
- `iphone`
- `ohio`
- `fall-2024`
- `sante-fe`
- `joshua-tree`

Create more folders as needed. Delete unused ones before launch.

## Implementation checklist (next chat)

1. **Build pipeline** — `scripts/build-photography.js` that:
   - Reads `content/photography/albums/*` (skip `_inbox` from public nav, or include — decide and document)
   - Writes a small generated manifest (or embeds album list at build time into static JS/JSON)
   - Records width/height (via `image-size` or similar) for aspect-ratio grid
2. **Gallery page** — restore `photography.html` / CSS / JS with local `src` paths like `content/photography/albums/chicago/01.jpg`
3. **Watch** — extend `npm run watch` to rebuild photography when album images change
4. **CI** — validate that every referenced image exists; smoke-test gallery again
5. **Docs** — update `README.md` + `CLAUDE.md`
6. **Remove** coming-soon placeholder once gallery works
7. **Optional** — Git LFS only if web exports still feel too large; prefer staying under ~100MB total

## Constraints

- Do not reintroduce Flickr API or CDN as a dependency
- Keep the lo-fi / Georgia / link-style visual language unless asked otherwise
- Keep standalone page (no cleve sidebar), hub link from referrer is fine
- Deep links: `#album/{slug}`, optionally `#photo/...` if useful with local filenames

## Copy-paste prompt for the next chat

```text
Repo: strangesongs.github.io
Branch: work from main (or current photography branch).

Read content/photography/MIGRATION.md and implement the local photography portfolio described there.

Context:
- Live page is currently a “portfolio coming soon” placeholder — replace it with a working local gallery once images exist.
- Album folders are at content/photography/albums/{slug}/ (plus _inbox/). I am dropping web-sized JPEGs there.
- Do NOT use Flickr CDN or Flickr API. Site must be fully self-hosted.
- Restore gallery UX (album nav, load more, lightbox, natural aspect ratios, keyboard/swipe) loading local files.
- Add build-photography that scans folders and generates manifests; wire watch + CI.
- Skip empty albums in the nav. Decide whether _inbox is public (prefer: not public).

Acceptance:
- npm run build-photography && npm run build works
- photography.html shows local images
- adding a JPEG to an album folder + rebuild updates the site
- no api.flickr.com or live.staticflickr.com in photography.js
```

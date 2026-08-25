# Photography albums (source of truth)

Edit folders here, then run `npm run build-photography`.

- [`album-order.json`](../album-order.json) — gallery nav order
- `albums/{slug}/album.json` — `{ "title": "…" }` (optional `flickrPhotosetId`)
- `albums/{slug}/photos.jsonl` — one photo JSON object per line

Generated (do not hand-edit): `photos.json`, `albums.json`, `album-photos/`.

Images stay on Flickr CDN. Minimum fields per photo line: `id`, `server`, `secret`. Prefer also `width_c` / `height_c` (and size URLs when you have them).

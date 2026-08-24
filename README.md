# strangesongs site

tracking what i read, watch, and see across each year — plus photography and project links.

## Photography

On-site at `photography.html` (standalone lo-fi gallery, separate from the cleve sidebar layout). Albums are local JSON under `content/photography/`; image bytes stay on Flickr CDN. Hub sidebar still links to it.

```bash
FLICKR_API_KEY=... npm run sync-photography
npm run build
npm run serve   # http://localhost:8090/photography.html
./scripts/smoke-photography.sh
```

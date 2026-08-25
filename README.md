# strangesongs site

tracking what i read, watch, and see across each year — plus photography and project links.

## Photography

On-site at `photography.html` (standalone lo-fi gallery, separate from the cleve sidebar layout). Images still load from Flickr’s CDN; album membership is authored as folders under `content/photography/albums/`.

```bash
# edit content/photography/albums/{slug}/photos.jsonl (and album.json)
npm run build-photography   # regenerates photos.json, albums.json, album-photos/
npm run validate-photography
npm run build
npm run serve               # http://localhost:8090/photography.html
./scripts/smoke-photography.sh
```

To add a photo: append one JSON line to the album’s `photos.jsonl` (and to `albums/all/photos.jsonl` if it should appear in “all”), then run `npm run build-photography`.

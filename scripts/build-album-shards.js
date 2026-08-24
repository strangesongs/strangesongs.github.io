#!/usr/bin/env node
/**
 * Build per-album photo shards from photos.json + albums.json.
 * Run after sync or when manifests change: node scripts/build-album-shards.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content', 'photography');
const PHOTOS_PATH = path.join(ROOT, 'photos.json');
const ALBUMS_PATH = path.join(ROOT, 'albums.json');
const SHARDS_DIR = path.join(ROOT, 'album-photos');

function main() {
    const photos = JSON.parse(fs.readFileSync(PHOTOS_PATH, 'utf8'));
    const albums = JSON.parse(fs.readFileSync(ALBUMS_PATH, 'utf8'));

    if (!Array.isArray(albums)) {
        throw new Error('albums.json must be an array');
    }

    fs.mkdirSync(SHARDS_DIR, { recursive: true });

    let missing = 0;

    for (const album of albums) {
        if (!album.slug || !Array.isArray(album.photoIds)) {
            continue;
        }

        const shard = {};
        for (const id of album.photoIds) {
            const photo = photos[String(id)];
            if (photo) {
                shard[String(id)] = photo;
            } else {
                missing += 1;
            }
        }

        const outPath = path.join(SHARDS_DIR, `${album.slug}.json`);
        fs.writeFileSync(outPath, `${JSON.stringify(shard, null, 2)}\n`);
    }

    console.log(`Wrote ${albums.length} album shards → ${SHARDS_DIR}`);
    if (missing) {
        console.warn(`Warning: ${missing} photoIds in albums.json not found in photos.json`);
    }
}

main();

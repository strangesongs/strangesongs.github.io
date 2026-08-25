#!/usr/bin/env node
/**
 * Build photography manifests from per-album source folders.
 *
 * Source of truth:
 *   content/photography/album-order.json
 *   content/photography/albums/{slug}/album.json
 *   content/photography/albums/{slug}/photos.jsonl
 *
 * Generated (do not hand-edit):
 *   content/photography/photos.json
 *   content/photography/albums.json
 *   content/photography/album-photos/{slug}.json
 *
 * Usage: node scripts/build-photography.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content', 'photography');
const ALBUMS_DIR = path.join(ROOT, 'albums');
const ORDER_PATH = path.join(ROOT, 'album-order.json');
const PHOTOS_OUT = path.join(ROOT, 'photos.json');
const ALBUMS_OUT = path.join(ROOT, 'albums.json');
const SHARDS_DIR = path.join(ROOT, 'album-photos');

// Only synthesize common public sizes when authoring with server+secret alone.
// Do not invent h/k/o URLs — those often 404 for free accounts.
const DEFAULT_URLS = [
    ['z', 'url_z'],
    ['c', 'url_c'],
    ['b', 'url_l']
];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flickrSizedUrl(photo, suffix) {
    return `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_${suffix}.jpg`;
}

function enrichPhoto(raw) {
    if (!raw || !raw.id) {
        throw new Error('photo entry missing id');
    }

    const photo = {
        id: String(raw.id),
        server: raw.server != null ? String(raw.server) : '',
        secret: raw.secret != null ? String(raw.secret) : '',
        title: raw.title != null ? String(raw.title) : '',
        date_taken: raw.date_taken != null ? String(raw.date_taken) : ''
    };

    for (const key of Object.keys(raw)) {
        if (key in photo) continue;
        photo[key] = raw[key];
    }

    if (photo.server && photo.secret) {
        for (const [suffix, urlKey] of DEFAULT_URLS) {
            if (!photo[urlKey]) {
                photo[urlKey] = flickrSizedUrl(photo, suffix);
            }
        }
    }

    return photo;
}

function readPhotosJsonl(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const photos = [];

    text.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        try {
            photos.push(enrichPhoto(JSON.parse(trimmed)));
        } catch (error) {
            throw new Error(`${filePath}:${index + 1} ${error.message}`);
        }
    });

    return photos;
}

function main() {
    if (!fs.existsSync(ORDER_PATH)) {
        throw new Error(`Missing ${ORDER_PATH}`);
    }
    if (!fs.existsSync(ALBUMS_DIR)) {
        throw new Error(`Missing ${ALBUMS_DIR}`);
    }

    const order = readJson(ORDER_PATH);
    if (!Array.isArray(order) || !order.length) {
        throw new Error('album-order.json must be a non-empty array of slugs');
    }

    const photosById = {};
    const albums = [];

    for (const slug of order) {
        const albumDir = path.join(ALBUMS_DIR, slug);
        const metaPath = path.join(albumDir, 'album.json');
        const photosPath = path.join(albumDir, 'photos.jsonl');

        if (!fs.existsSync(metaPath)) {
            throw new Error(`Missing album.json for slug "${slug}"`);
        }
        if (!fs.existsSync(photosPath)) {
            throw new Error(`Missing photos.jsonl for slug "${slug}"`);
        }

        const meta = readJson(metaPath);
        const albumPhotos = readPhotosJsonl(photosPath);
        const photoIds = [];

        for (const photo of albumPhotos) {
            photosById[photo.id] = photo;
            photoIds.push(photo.id);
        }

        const album = {
            slug,
            title: meta.title != null ? String(meta.title) : slug,
            photoIds
        };

        if (meta.flickrPhotosetId) {
            album.flickrPhotosetId = String(meta.flickrPhotosetId);
        }

        albums.push(album);
    }

    if (!albums.some((album) => album.slug === 'all')) {
        throw new Error('album-order.json must include "all"');
    }

    fs.mkdirSync(SHARDS_DIR, { recursive: true });

    for (const album of albums) {
        const shard = {};
        for (const id of album.photoIds) {
            shard[id] = photosById[id];
        }
        fs.writeFileSync(
            path.join(SHARDS_DIR, `${album.slug}.json`),
            `${JSON.stringify(shard, null, 2)}\n`
        );
    }

    // Remove stale shards for deleted albums
    for (const name of fs.readdirSync(SHARDS_DIR)) {
        if (!name.endsWith('.json')) continue;
        const slug = name.slice(0, -'.json'.length);
        if (!albums.some((album) => album.slug === slug)) {
            fs.unlinkSync(path.join(SHARDS_DIR, name));
        }
    }

    fs.writeFileSync(PHOTOS_OUT, `${JSON.stringify(photosById, null, 2)}\n`);
    fs.writeFileSync(ALBUMS_OUT, `${JSON.stringify(albums, null, 2)}\n`);

    console.log(
        `Built ${Object.keys(photosById).length} photos, ${albums.length} albums → ${ROOT}`
    );
}

main();

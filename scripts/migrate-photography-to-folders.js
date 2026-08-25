#!/usr/bin/env node
/**
 * One-time migration: albums.json + photos.json → content/photography/albums/*
 * Safe to re-run; overwrites album source folders from current generated manifests.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content', 'photography');
const PHOTOS_PATH = path.join(ROOT, 'photos.json');
const ALBUMS_PATH = path.join(ROOT, 'albums.json');
const ALBUMS_DIR = path.join(ROOT, 'albums');
const ORDER_PATH = path.join(ROOT, 'album-order.json');

function main() {
    const photos = JSON.parse(fs.readFileSync(PHOTOS_PATH, 'utf8'));
    const albums = JSON.parse(fs.readFileSync(ALBUMS_PATH, 'utf8'));

    if (!Array.isArray(albums)) {
        throw new Error('albums.json must be an array');
    }

    fs.mkdirSync(ALBUMS_DIR, { recursive: true });

    const order = [];

    for (const album of albums) {
        if (!album.slug) continue;
        order.push(album.slug);

        const dir = path.join(ALBUMS_DIR, album.slug);
        fs.mkdirSync(dir, { recursive: true });

        const meta = {
            title: album.title || album.slug
        };
        if (album.flickrPhotosetId) {
            meta.flickrPhotosetId = String(album.flickrPhotosetId);
        }

        fs.writeFileSync(
            path.join(dir, 'album.json'),
            `${JSON.stringify(meta, null, 2)}\n`
        );

        const lines = (album.photoIds || []).map((id) => {
            const photo = photos[String(id)];
            if (!photo) {
                throw new Error(`album "${album.slug}" missing photo ${id}`);
            }
            return JSON.stringify(photo);
        });

        fs.writeFileSync(
            path.join(dir, 'photos.jsonl'),
            `${lines.join('\n')}${lines.length ? '\n' : ''}`
        );

        console.log(`Wrote albums/${album.slug}/ (${lines.length} photos)`);
    }

    fs.writeFileSync(ORDER_PATH, `${JSON.stringify(order, null, 2)}\n`);
    console.log(`Wrote album-order.json (${order.length} albums)`);
}

main();

#!/usr/bin/env node
/**
 * Validate photography JSON manifests. Exit 1 on failure.
 * Usage: node scripts/validate-photography-manifests.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content', 'photography');
const PHOTOS_PATH = path.join(ROOT, 'photos.json');
const ALBUMS_PATH = path.join(ROOT, 'albums.json');
const SHARDS_DIR = path.join(ROOT, 'album-photos');

const errors = [];

function fail(message) {
    errors.push(message);
}

function readJson(filePath, label) {
    if (!fs.existsSync(filePath)) {
        fail(`${label} missing: ${filePath}`);
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        fail(`${label} is not valid JSON: ${error.message}`);
        return null;
    }
}

function main() {
    const photos = readJson(PHOTOS_PATH, 'photos.json');
    const albums = readJson(ALBUMS_PATH, 'albums.json');

    if (!photos || !albums) {
        process.exit(1);
    }

    if (typeof photos !== 'object' || Array.isArray(photos)) {
        fail('photos.json must be an object keyed by photo id');
    }

    if (!Array.isArray(albums)) {
        fail('albums.json must be an array');
        process.exit(1);
    }

    const slugs = new Set();
    let hasAll = false;

    for (const album of albums) {
        if (!album || typeof album !== 'object') {
            fail('album entry must be an object');
            continue;
        }

        if (!album.slug || typeof album.slug !== 'string') {
            fail('each album must have a string slug');
            continue;
        }

        if (slugs.has(album.slug)) {
            fail(`duplicate album slug: ${album.slug}`);
        }
        slugs.add(album.slug);

        if (album.slug === 'all') {
            hasAll = true;
        }

        if (!album.title || typeof album.title !== 'string') {
            fail(`album "${album.slug}" must have a title`);
        }

        if (!Array.isArray(album.photoIds)) {
            fail(`album "${album.slug}" must have a photoIds array`);
            continue;
        }

        for (const id of album.photoIds) {
            if (!photos[String(id)]) {
                fail(`album "${album.slug}" references missing photo id: ${id}`);
            }
        }

        const shardPath = path.join(SHARDS_DIR, `${album.slug}.json`);
        if (!fs.existsSync(shardPath)) {
            fail(`missing album shard: album-photos/${album.slug}.json`);
            continue;
        }

        const shard = readJson(shardPath, `album-photos/${album.slug}.json`);
        if (!shard) {
            continue;
        }

        for (const id of album.photoIds) {
            if (!shard[String(id)]) {
                fail(`shard "${album.slug}" missing photo id: ${id}`);
            }
        }
    }

    if (!hasAll) {
        fail('albums.json must include an "all" album');
    }

    if (errors.length) {
        console.error('Photography manifest validation failed:\n');
        errors.forEach((message) => console.error(`  - ${message}`));
        process.exit(1);
    }

    console.log(`OK: ${Object.keys(photos).length} photos, ${albums.length} albums, ${slugs.size} shards`);
}

main();

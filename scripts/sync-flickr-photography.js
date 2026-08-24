#!/usr/bin/env node
/**
 * Pull public Flickr photos + photosets into local JSON manifests.
 *
 * Usage:
 *   FLICKR_API_KEY=... node scripts/sync-flickr-photography.js
 *
 * Env (optional):
 *   FLICKR_API_KEY   — required (do not commit; use .env or shell)
 *   FLICKR_USER_ID   — default 196014147@N05
 *
 * After sync, edit content/photography/albums.json freely — structure need
 * not match Flickr photosets. Re-running sync merges photo metadata and
 * refreshes album photoIds from Flickr sets (preserving custom albums that
 * are not Flickr-backed is left to manual edits after sync).
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.FLICKR_API_KEY;
const USER_ID = process.env.FLICKR_USER_ID || '196014147@N05';
const API_BASE = 'https://api.flickr.com/services/rest/';
const OUT_DIR = path.join(__dirname, '..', 'content', 'photography');
const PHOTO_EXTRAS = [
    'url_z,url_c,url_l,url_b,url_h,url_k,url_o',
    'width_z,height_z,width_c,height_c,width_l,height_l',
    'width_b,height_b,width_h,height_h,width_k,height_k,width_o,height_o',
    'originalsecret,original_format,date_taken'
].join(',');

if (!API_KEY) {
    console.error('Set FLICKR_API_KEY in the environment before running this script.');
    process.exit(1);
}

function slugify(title) {
    return String(title || 'untitled')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'untitled';
}

function buildUrl(method, params) {
    const query = new URLSearchParams({
        method,
        api_key: API_KEY,
        user_id: USER_ID,
        format: 'json',
        nojsoncallback: '1',
        ...params
    });
    return `${API_BASE}?${query.toString()}`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    const data = await response.json();
    if (data.stat === 'fail') {
        throw new Error(data.message || 'Flickr API error');
    }
    return data;
}

function normalizePhoto(raw) {
    const photo = {
        id: String(raw.id),
        server: String(raw.server),
        secret: String(raw.secret),
        title: raw.title ? String(raw.title) : '',
        date_taken: raw.date_taken || ''
    };

    const sizeKeys = ['z', 'c', 'l', 'b', 'h', 'k', 'o'];
    for (const key of sizeKeys) {
        const urlKey = `url_${key}`;
        const widthKey = `width_${key}`;
        const heightKey = `height_${key}`;
        if (raw[urlKey]) {
            photo[urlKey] = raw[urlKey];
        }
        if (raw[widthKey]) {
            photo[widthKey] = Number(raw[widthKey]);
        }
        if (raw[heightKey]) {
            photo[heightKey] = Number(raw[heightKey]);
        }
    }

    if (raw.originalsecret) {
        photo.originalsecret = String(raw.originalsecret);
    }
    if (raw.original_format) {
        photo.original_format = String(raw.original_format);
    }

    return photo;
}

async function fetchAllPublicPhotos() {
    const photos = [];
    let page = 1;
    let pages = 1;

    while (page <= pages) {
        const data = await fetchJson(buildUrl('flickr.people.getPublicPhotos', {
            per_page: '500',
            page: String(page),
            extras: PHOTO_EXTRAS
        }));
        const batch = data.photos && data.photos.photo ? data.photos.photo : [];
        pages = Number(data.photos.pages || 1);
        photos.push(...batch.map(normalizePhoto));
        console.log(`Public photos: page ${page}/${pages} (+${batch.length})`);
        page += 1;
    }

    return photos;
}

async function fetchPhotosets() {
    const data = await fetchJson(buildUrl('flickr.photosets.getList', {
        per_page: '500'
    }));
    const sets = data.photosets && data.photosets.photoset ? data.photosets.photoset : [];
    return sets.map((set) => ({
        id: String(set.id),
        title: set.title && set.title._content ? set.title._content : 'Untitled album',
        count: Number(set.photos || 0)
    }));
}

async function fetchPhotosetPhotos(photosetId) {
    const photos = [];
    let page = 1;
    let pages = 1;

    while (page <= pages) {
        const data = await fetchJson(buildUrl('flickr.photosets.getPhotos', {
            photoset_id: photosetId,
            per_page: '500',
            page: String(page),
            extras: PHOTO_EXTRAS
        }));
        const batch = data.photoset && data.photoset.photo ? data.photoset.photo : [];
        pages = Number(data.photoset.pages || 1);
        photos.push(...batch.map(normalizePhoto));
        page += 1;
    }

    return photos;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const publicPhotos = await fetchAllPublicPhotos();
    const photosById = {};
    for (const photo of publicPhotos) {
        photosById[photo.id] = photo;
    }

    const sets = await fetchPhotosets();
    const albums = [
        {
            slug: 'all',
            title: 'all',
            photoIds: publicPhotos.map((p) => p.id)
        }
    ];

    const usedSlugs = new Set(['all']);

    for (const set of sets) {
        console.log(`Album: ${set.title} (${set.count})`);
        const setPhotos = await fetchPhotosetPhotos(set.id);
        for (const photo of setPhotos) {
            photosById[photo.id] = photo;
        }

        let slug = slugify(set.title);
        if (usedSlugs.has(slug)) {
            slug = `${slug}-${set.id.slice(-4)}`;
        }
        usedSlugs.add(slug);

        albums.push({
            slug,
            title: set.title.toLowerCase(),
            photoIds: setPhotos.map((p) => p.id),
            flickrPhotosetId: set.id
        });
    }

    const photosPath = path.join(OUT_DIR, 'photos.json');
    const albumsPath = path.join(OUT_DIR, 'albums.json');

    fs.writeFileSync(photosPath, `${JSON.stringify(photosById, null, 2)}\n`);
    fs.writeFileSync(albumsPath, `${JSON.stringify(albums, null, 2)}\n`);

    console.log(`Wrote ${Object.keys(photosById).length} photos → ${photosPath}`);
    console.log(`Wrote ${albums.length} albums → ${albumsPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

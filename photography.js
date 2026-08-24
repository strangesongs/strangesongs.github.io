document.addEventListener('DOMContentLoaded', () => {
    const PAGE_SIZE = 36;
    const ALBUMS_URL = 'content/photography/albums.json';
    const ALBUM_PHOTOS_URL = (slug) => `content/photography/album-photos/${slug}.json`;
    const SWIPE_THRESHOLD = 40;
    const CACHE_ALBUMS_KEY = 'whatwesee.albums.v2';
    const CACHE_SHARD_PREFIX = 'whatwesee.albumPhotos.v2.';
    const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

    const hubLink = document.querySelector('.hub-link');
    if (hubLink) {
        try {
            const ref = document.referrer ? new URL(document.referrer) : null;
            const fromCleve = Boolean(
                ref
                && ref.origin === window.location.origin
                && !/photography\.html$/i.test(ref.pathname)
            );
            if (fromCleve) {
                hubLink.hidden = false;
            }
        } catch (error) {
            // keep hub link hidden
        }
    }

    const galleryEl = document.getElementById('photo-gallery');
    const statusEl = document.getElementById('status');
    const albumNav = document.getElementById('album-nav');
    const galleryMetaEl = document.getElementById('gallery-meta');
    const loadMoreBtn = document.getElementById('load-more');
    const retryLoadBtn = document.getElementById('retry-load');
    const lastUpdatedEl = document.getElementById('last-updated');
    const lightboxEl = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxNav = lightboxEl && lightboxEl.querySelector('.lightbox-nav');

    const lightboxCounter = document.createElement('span');
    lightboxCounter.className = 'lightbox-counter';
    lightboxCounter.setAttribute('aria-live', 'polite');
    if (lightboxNav && lightboxNext) {
        lightboxNav.insertBefore(lightboxCounter, lightboxNext);
    }

    let albums = [];
    let photosById = {};
    let activeAlbumSlug = 'all';
    let visiblePhotos = [];
    let renderedCount = 0;
    let currentPhotoIndex = -1;
    let lightboxLastFocusedEl = null;
    let lightboxLoadToken = 0;
    let applyingHash = false;
    let ignoreHashChange = false;
    let touchStartX = null;
    let touchStartY = null;
    let pendingHashRoute = null;

    function setStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.classList.toggle('is-error', Boolean(isError && message));
    }

    function clearStatus() {
        setStatus('', false);
    }

    function updateRetryButton(show) {
        if (!retryLoadBtn) return;
        retryLoadBtn.hidden = !show;
    }

    function saveToCache(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify({
                savedAt: Date.now(),
                data: value
            }));
        } catch (error) {
            console.warn('Cache write failed', error);
        }
    }

    function readFromCache(key) {
        try {
            const rawValue = localStorage.getItem(key);
            if (!rawValue) return null;

            const parsed = JSON.parse(rawValue);
            if (!parsed || !Number.isFinite(parsed.savedAt)) return null;
            if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
                localStorage.removeItem(key);
                return null;
            }

            return parsed.data;
        } catch (error) {
            console.warn('Cache read failed', error);
            return null;
        }
    }

    if (albumNav) albumNav.hidden = true;
    if (galleryMetaEl) {
        galleryMetaEl.hidden = true;
        galleryMetaEl.textContent = '';
    }
    setStatus('loading…');

    function formatPhotoDate(photo) {
        if (!photo || !photo.date_taken) return '';

        const parsed = new Date(photo.date_taken);
        if (Number.isNaN(parsed.getTime())) {
            return photo.date_taken.split(' ')[0] || '';
        }

        return parsed.toISOString().slice(0, 10);
    }

    function updateLastUpdated() {
        if (!lastUpdatedEl) return;

        let newest = null;
        Object.values(photosById).forEach((photo) => {
            const label = formatPhotoDate(photo);
            if (!label || (newest && label <= newest)) return;
            newest = label;
        });

        lastUpdatedEl.textContent = newest ? `last updated: ${newest}` : '';
    }

    function findAlbum(slug) {
        return albums.find((album) => album.slug === slug) || null;
    }

    function photosForAlbum(slug) {
        const album = findAlbum(slug) || findAlbum('all');
        if (!album || !Array.isArray(album.photoIds)) return [];

        return album.photoIds
            .map((id) => photosById[String(id)])
            .filter(Boolean);
    }

    function setLocationHash(nextHash) {
        if (applyingHash) return;
        const target = nextHash ? `#${nextHash}` : '';
        if (window.location.hash === target) return;
        ignoreHashChange = true;
        if (nextHash) {
            window.location.hash = nextHash;
        } else {
            history.pushState(null, '', window.location.pathname + window.location.search);
        }
        queueMicrotask(() => {
            ignoreHashChange = false;
        });
    }

    function updateAlbumHash() {
        if (activeAlbumSlug === 'all') {
            setLocationHash('album/all');
        } else {
            setLocationHash(`album/${activeAlbumSlug}`);
        }
    }

    function parseLocationHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) {
            return { albumSlug: null, photoId: null };
        }

        const photoMatch = hash.match(/^photo\/(.+)$/);
        if (photoMatch) {
            return { albumSlug: null, photoId: photoMatch[1] };
        }

        const albumMatch = hash.match(/^album\/(.+)$/);
        if (albumMatch) {
            return { albumSlug: albumMatch[1], photoId: null };
        }

        return { albumSlug: null, photoId: null };
    }

    function flickrSizedUrl(photo, sizeSuffix) {
        return `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_${sizeSuffix}.jpg`;
    }

    function flickrOriginalUrl(photo) {
        if (photo.url_o) return photo.url_o;
        if (photo.originalsecret) {
            const format = photo.original_format || 'jpg';
            return `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.originalsecret}_o.${format}`;
        }
        return null;
    }

    function photoSourceFromKeys(photo, sizeKeys) {
        for (const [urlKey, widthKey, heightKey] of sizeKeys) {
            if (photo[urlKey]) {
                return {
                    url: photo[urlKey],
                    width: photo[widthKey] || null,
                    height: photo[heightKey] || null
                };
            }
        }
        return null;
    }

    const THUMB_KEYS = [
        ['url_c', 'width_c', 'height_c'],
        ['url_z', 'width_z', 'height_z']
    ];

    const LARGE_KEYS = [
        ['url_o', 'width_o', 'height_o'],
        ['url_k', 'width_k', 'height_k'],
        ['url_h', 'width_h', 'height_h'],
        ['url_b', 'width_b', 'height_b'],
        ['url_l', 'width_l', 'height_l'],
        ['url_c', 'width_c', 'height_c'],
        ['url_z', 'width_z', 'height_z']
    ];

    function thumbSource(photo) {
        return photoSourceFromKeys(photo, THUMB_KEYS)
            || { url: flickrSizedUrl(photo, 'z'), width: null, height: null };
    }

    function photoAspectRatio(photo) {
        const source = thumbSource(photo);
        const w = Number(source.width);
        const h = Number(source.height);

        if (w > 0 && h > 0) {
            return `${w} / ${h}`;
        }

        return null;
    }

    function thumbSrcset(photo) {
        const parts = [];
        if (photo.url_z) parts.push(`${photo.url_z} 640w`);
        if (photo.url_c) parts.push(`${photo.url_c} 800w`);
        return parts.join(', ');
    }

    function lightboxCandidates(photo) {
        const seen = new Set();
        const list = [];

        function add(url, width, height, verified) {
            if (!url || seen.has(url)) return;
            seen.add(url);
            list.push({
                url,
                width: Number(width) || 0,
                height: Number(height) || 0,
                verified: Boolean(verified)
            });
        }

        for (const [urlKey, widthKey, heightKey] of LARGE_KEYS) {
            if (photo[urlKey]) {
                add(photo[urlKey], photo[widthKey], photo[heightKey], true);
            }
        }

        add(flickrOriginalUrl(photo), photo.width_o, photo.height_o, Boolean(photo.url_o || photo.originalsecret));
        ['k', 'h', 'b', 'l', 'c', 'z'].forEach((suffix) => {
            add(flickrSizedUrl(photo, suffix), null, null, false);
        });

        return list;
    }

    function lightboxDisplayTarget() {
        const dpr = window.devicePixelRatio || 1;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

        return {
            width: Math.ceil(window.innerWidth * 0.96 * dpr),
            height: Math.ceil(Math.max(viewportHeight - 48, 0) * dpr)
        };
    }

    function pickLightboxCandidate(photo, candidates) {
        if (!candidates.length) {
            return { url: flickrSizedUrl(photo, 'z'), width: 640, height: 0 };
        }

        const target = lightboxDisplayTarget();
        const verified = candidates.filter((candidate) => candidate.verified);
        const pool = verified.length ? verified : candidates;
        const sorted = pool.slice().sort((a, b) => b.width - a.width);
        const adequate = sorted.find((candidate) => (
            candidate.width >= target.width || candidate.height >= target.height
        ));

        return adequate || sorted[0];
    }

    function currentRenderedPhotos() {
        return visiblePhotos.slice(0, renderedCount);
    }

    function updateGalleryMeta() {
        if (!galleryMetaEl) return;
        galleryMetaEl.hidden = true;
        galleryMetaEl.textContent = '';
    }

    function updateLoadMoreButton() {
        if (!loadMoreBtn) return;
        loadMoreBtn.hidden = renderedCount >= visiblePhotos.length;
    }

    function updateLightboxCounter() {
        const photos = currentRenderedPhotos();
        if (currentPhotoIndex < 0 || !photos.length) {
            lightboxCounter.textContent = '';
            return;
        }
        lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${photos.length}`;
    }

    function lightboxFocusables() {
        return [lightboxPrev, lightboxClose, lightboxNext].filter(
            (el) => el && !el.disabled
        );
    }

    function renderAlbumNav() {
        if (!albumNav) return;
        albumNav.innerHTML = '';

        albums.forEach((album, index) => {
            if (index > 0) {
                const sep = document.createElement('span');
                sep.className = 'album-sep';
                sep.setAttribute('aria-hidden', 'true');
                sep.textContent = ' | ';
                albumNav.appendChild(sep);
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'album-link';
            button.textContent = album.title;
            button.setAttribute('data-album-slug', album.slug);

            if (album.slug === activeAlbumSlug) {
                button.classList.add('is-active');
                button.setAttribute('aria-current', 'true');
            }

            button.addEventListener('click', () => {
                if (album.slug !== activeAlbumSlug) {
                    loadAlbum(album.slug);
                }
            });

            albumNav.appendChild(button);
        });

        albumNav.hidden = false;
    }

    function renderGallery() {
        if (!galleryEl) return;
        galleryEl.innerHTML = '';

        const photos = currentRenderedPhotos();
        if (!photos.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'No photos in this album yet.';
            galleryEl.appendChild(empty);
            return;
        }

        photos.forEach((photo, index) => {
            const entry = document.createElement('div');
            entry.className = 'photo-entry';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'photo-card';
            button.setAttribute('data-photo-id', photo.id);
            button.setAttribute('aria-label', photo.title || 'Open photo');

            const img = document.createElement('img');
            const source = thumbSource(photo);
            const srcset = thumbSrcset(photo);
            img.src = source.url;
            if (srcset) {
                img.srcset = srcset;
                img.sizes = '(max-width: 520px) 100vw, 360px';
            }
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';

            const ratio = photoAspectRatio(photo);
            if (ratio) {
                button.style.aspectRatio = ratio;
            }

            button.appendChild(img);
            button.addEventListener('click', () => openLightbox(index));

            entry.appendChild(button);

            const dateLabel = formatPhotoDate(photo);
            if (dateLabel) {
                const caption = document.createElement('p');
                caption.className = 'photo-caption';
                caption.textContent = dateLabel;
                entry.appendChild(caption);
            }

            galleryEl.appendChild(entry);
        });
    }

    function setVisiblePhotos(photos, options) {
        const opts = options || {};
        visiblePhotos = photos.slice();
        renderedCount = Math.min(PAGE_SIZE, visiblePhotos.length);
        updateGalleryMeta();
        updateLoadMoreButton();
        renderGallery();
        updateLastUpdated();

        if (opts.updateHash !== false) {
            updateAlbumHash();
        }
    }

    function fetchAlbumShard(slug) {
        const url = ALBUM_PHOTOS_URL(slug);
        return fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(`album photos ${response.status}`);
            }
            return response.json();
        }).then((data) => {
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('invalid album shard');
            }
            saveToCache(`${CACHE_SHARD_PREFIX}${slug}`, data);
            return data;
        });
    }

    function loadAlbumShard(slug) {
        const cached = readFromCache(`${CACHE_SHARD_PREFIX}${slug}`);
        if (cached && typeof cached === 'object') {
            return Promise.resolve(cached);
        }
        return fetchAlbumShard(slug);
    }

    function loadAlbum(slug, options) {
        const opts = options || {};
        const album = findAlbum(slug) || findAlbum('all');
        const targetSlug = album ? album.slug : 'all';

        if (!opts.skipLoadingState) {
            setStatus('loading…');
            updateRetryButton(false);
        }

        activeAlbumSlug = targetSlug;

        return loadAlbumShard(targetSlug)
            .then((shard) => {
                photosById = shard;
                renderAlbumNav();
                setVisiblePhotos(photosForAlbum(targetSlug), {
                    updateHash: opts.updateHash !== false
                });
                clearStatus();
                updateRetryButton(false);

                if (pendingHashRoute) {
                    const route = pendingHashRoute;
                    pendingHashRoute = null;
                    return applyHashRoute(route);
                }

                return null;
            })
            .catch((error) => {
                console.error(error);

                const cached = readFromCache(`${CACHE_SHARD_PREFIX}${targetSlug}`);
                if (cached && typeof cached === 'object') {
                    photosById = cached;
                    renderAlbumNav();
                    setVisiblePhotos(photosForAlbum(targetSlug), {
                        updateHash: opts.updateHash !== false
                    });
                    setStatus('Live data is unavailable. Showing your last loaded gallery.', false);
                    updateRetryButton(true);
                    return null;
                }

                setStatus('Could not load the photography gallery.', true);
                updateRetryButton(true);
                throw error;
            });
    }

    function ensurePhotoRendered(photoId) {
        const index = visiblePhotos.findIndex((photo) => String(photo.id) === String(photoId));
        if (index === -1) return -1;

        if (index >= renderedCount) {
            renderedCount = index + 1;
            updateGalleryMeta();
            updateLoadMoreButton();
            renderGallery();
        }

        return currentRenderedPhotos().findIndex((photo) => String(photo.id) === String(photoId));
    }

    function albumSlugForPhoto(photoId) {
        for (const album of albums) {
            if (album.slug === 'all') continue;
            if (album.photoIds && album.photoIds.map(String).includes(String(photoId))) {
                return album.slug;
            }
        }
        return 'all';
    }

    function loadLightboxImage(photo) {
        const token = ++lightboxLoadToken;
        const candidates = lightboxCandidates(photo);
        const preferred = pickLightboxCandidate(photo, candidates);
        const fallbackOrder = [preferred];
        const sortedDesc = candidates.slice().sort((a, b) => b.width - a.width);

        sortedDesc.forEach((candidate) => {
            if (candidate.url !== preferred.url) {
                fallbackOrder.push(candidate);
            }
        });

        let fallbackIndex = 0;

        function tryUpgrade(remaining) {
            if (token !== lightboxLoadToken || !remaining.length) return;

            const candidate = remaining[0];
            const rest = remaining.slice(1);
            const probe = new Image();

            probe.onload = () => {
                if (token !== lightboxLoadToken) return;
                lightboxImage.src = candidate.url;
                tryUpgrade(rest.filter((item) => item.width > candidate.width));
            };

            probe.onerror = () => {
                if (token !== lightboxLoadToken) return;
                tryUpgrade(rest);
            };

            probe.src = candidate.url;
        }

        function showNextCandidate() {
            if (token !== lightboxLoadToken || fallbackIndex >= fallbackOrder.length) return;

            const candidate = fallbackOrder[fallbackIndex++];
            lightboxImage.onload = () => {
                if (token !== lightboxLoadToken) return;
                const upgrades = sortedDesc.filter((item) => item.width > candidate.width);
                tryUpgrade(upgrades);
            };
            lightboxImage.onerror = showNextCandidate;
            lightboxImage.src = candidate.url;
        }

        showNextCandidate();
    }

    function openLightbox(index) {
        const photos = currentRenderedPhotos();
        if (index < 0 || index >= photos.length) return;

        currentPhotoIndex = index;
        const photo = photos[index];
        lightboxImage.alt = photo.title || 'Photo';
        loadLightboxImage(photo);

        lightboxPrev.disabled = currentPhotoIndex <= 0;
        lightboxNext.disabled = currentPhotoIndex >= photos.length - 1;
        updateLightboxCounter();

        lightboxLastFocusedEl = document.activeElement;
        lightboxEl.classList.add('is-open');
        lightboxEl.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');
        lightboxClose.focus();
        setLocationHash(`photo/${photo.id}`);
    }

    function closeLightbox() {
        lightboxEl.classList.remove('is-open');
        lightboxEl.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
        lightboxLoadToken += 1;
        lightboxImage.removeAttribute('src');
        currentPhotoIndex = -1;
        lightboxCounter.textContent = '';
        updateAlbumHash();

        if (lightboxLastFocusedEl && typeof lightboxLastFocusedEl.focus === 'function') {
            lightboxLastFocusedEl.focus();
        }
    }

    function stepLightbox(step) {
        const photos = currentRenderedPhotos();
        const nextIndex = currentPhotoIndex + step;
        if (nextIndex < 0 || nextIndex >= photos.length) return;
        openLightbox(nextIndex);
    }

    function applyHashRoute(route) {
        applyingHash = true;
        const { albumSlug, photoId } = route || parseLocationHash();

        try {
            if (photoId) {
                if (!photosById[String(photoId)]) {
                    const targetAlbum = albumSlugForPhoto(photoId);
                    if (targetAlbum !== activeAlbumSlug) {
                        pendingHashRoute = { albumSlug: null, photoId };
                        return loadAlbum(targetAlbum, { updateHash: false, skipLoadingState: true });
                    }
                    setStatus('That photo is not in this gallery.');
                    return Promise.resolve();
                }

                const targetAlbum = albumSlugForPhoto(photoId);
                if (targetAlbum !== activeAlbumSlug) {
                    pendingHashRoute = { albumSlug: null, photoId };
                    return loadAlbum(targetAlbum, { updateHash: false, skipLoadingState: true });
                }

                const renderedIndex = ensurePhotoRendered(photoId);
                if (renderedIndex !== -1) {
                    openLightbox(renderedIndex);
                } else {
                    setStatus('That photo is not in this gallery.');
                }
                return Promise.resolve();
            }

            if (lightboxEl.classList.contains('is-open')) {
                lightboxEl.classList.remove('is-open');
                lightboxEl.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('no-scroll');
                lightboxCounter.textContent = '';
                currentPhotoIndex = -1;
            }

            if (albumSlug && findAlbum(albumSlug)) {
                if (albumSlug !== activeAlbumSlug) {
                    return loadAlbum(albumSlug, { updateHash: false, skipLoadingState: true });
                }
                return Promise.resolve();
            }

            if (!albumSlug) {
                if (activeAlbumSlug !== 'all') {
                    return loadAlbum('all', { updateHash: false, skipLoadingState: true });
                }
                return Promise.resolve();
            }

            return loadAlbum('all', { updateHash: false, skipLoadingState: true })
                .then(() => {
                    setStatus('Unknown album; showing all.');
                });
        } finally {
            applyingHash = false;
        }
    }

    function loadMore() {
        renderedCount = Math.min(renderedCount + PAGE_SIZE, visiblePhotos.length);
        updateGalleryMeta();
        updateLoadMoreButton();
        renderGallery();
    }

    function fetchAlbums() {
        return fetch(ALBUMS_URL).then((response) => {
            if (!response.ok) throw new Error(`albums ${response.status}`);
            return response.json();
        }).then((data) => {
            albums = Array.isArray(data) ? data : [];
            saveToCache(CACHE_ALBUMS_KEY, albums);
            return albums;
        });
    }

    function bootstrapGallery() {
        setStatus('loading…');
        updateRetryButton(false);

        return fetchAlbums()
            .then((albumData) => {
                if (!albumData.length) {
                    setStatus('No albums found.', true);
                    updateRetryButton(true);
                    return null;
                }

                const { albumSlug, photoId } = parseLocationHash();
                const initialSlug = (albumSlug && findAlbum(albumSlug))
                    ? albumSlug
                    : (photoId ? albumSlugForPhoto(photoId) : 'all');

                if (photoId || albumSlug) {
                    pendingHashRoute = { albumSlug, photoId };
                }

                return loadAlbum(initialSlug, { updateHash: !photoId && !albumSlug });
            })
            .catch((error) => {
                console.error(error);

                const cachedAlbums = readFromCache(CACHE_ALBUMS_KEY);
                if (Array.isArray(cachedAlbums) && cachedAlbums.length) {
                    albums = cachedAlbums;
                    const { albumSlug, photoId } = parseLocationHash();
                    const initialSlug = (albumSlug && findAlbum(albumSlug))
                        ? albumSlug
                        : (photoId ? albumSlugForPhoto(photoId) : 'all');

                    if (photoId || albumSlug) {
                        pendingHashRoute = { albumSlug, photoId };
                    }

                    return loadAlbum(initialSlug, { updateHash: !photoId && !albumSlug })
                        .then(() => {
                            setStatus('Live data is unavailable. Showing your last loaded gallery.', false);
                            updateRetryButton(true);
                        })
                        .catch(() => {
                            setStatus('Could not load the photography gallery.', true);
                            updateRetryButton(true);
                        });
                }

                setStatus('Could not load the photography gallery.', true);
                updateRetryButton(true);
            });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMore);
    }

    if (retryLoadBtn) {
        retryLoadBtn.addEventListener('click', () => {
            bootstrapGallery();
        });
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => stepLightbox(-1));
    lightboxNext.addEventListener('click', () => stepLightbox(1));
    lightboxEl.addEventListener('click', (event) => {
        if (event.target === lightboxEl) closeLightbox();
    });

    lightboxEl.addEventListener('touchstart', (event) => {
        if (!lightboxEl.classList.contains('is-open')) return;
        if (event.changedTouches.length !== 1) return;
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
    }, { passive: true });

    lightboxEl.addEventListener('touchend', (event) => {
        if (!lightboxEl.classList.contains('is-open')) return;
        if (touchStartX == null || event.changedTouches.length !== 1) {
            touchStartX = null;
            touchStartY = null;
            return;
        }

        const dx = event.changedTouches[0].clientX - touchStartX;
        const dy = event.changedTouches[0].clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;

        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) {
            stepLightbox(1);
        } else {
            stepLightbox(-1);
        }
    }, { passive: true });

    window.addEventListener('offline', () => {
        setStatus('You appear to be offline. Some actions may fail until connection returns.', true);
    });

    window.addEventListener('online', () => {
        if (statusEl && statusEl.classList.contains('is-error')) {
            setStatus('Connection restored.', false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (!lightboxEl.classList.contains('is-open')) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeLightbox();
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            stepLightbox(-1);
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            stepLightbox(1);
            return;
        }

        if (event.key === 'Tab') {
            const focusables = lightboxFocusables();
            if (!focusables.length) return;
            event.preventDefault();

            const current = focusables.indexOf(document.activeElement);
            let nextIndex;
            if (event.shiftKey) {
                nextIndex = current <= 0 ? focusables.length - 1 : current - 1;
            } else {
                nextIndex = current >= focusables.length - 1 || current === -1
                    ? 0
                    : current + 1;
            }
            focusables[nextIndex].focus();
        }
    });

    window.addEventListener('hashchange', () => {
        if (ignoreHashChange) return;
        applyHashRoute(parseLocationHash());
    });

    bootstrapGallery();
});

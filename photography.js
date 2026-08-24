document.addEventListener('DOMContentLoaded', () => {
    const PAGE_SIZE = 36;
    const ALBUMS_URL = 'content/photography/albums.json';
    const PHOTOS_URL = 'content/photography/photos.json';

    const galleryEl = document.getElementById('photo-gallery');
    const statusEl = document.getElementById('status');
    const albumNav = document.getElementById('album-nav');
    const galleryMetaEl = document.getElementById('gallery-meta');
    const loadMoreBtn = document.getElementById('load-more');
    const lightboxEl = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

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

    function setStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.classList.toggle('is-error', Boolean(isError && message));
    }

    function clearStatus() {
        setStatus('', false);
    }

    function findAlbum(slug) {
        return albums.find((album) => album.slug === slug) || null;
    }

    function photosForAlbum(slug) {
        const album = findAlbum(slug) || findAlbum('all');
        if (!album || !Array.isArray(album.photoIds)) {
            return [];
        }
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

    function lightboxCandidates(photo) {
        const seen = new Set();
        const list = [];

        function add(url, width, height) {
            if (!url || seen.has(url)) return;
            seen.add(url);
            list.push({ url, width, height });
        }

        for (const [urlKey, widthKey, heightKey] of LARGE_KEYS) {
            if (photo[urlKey]) {
                add(photo[urlKey], photo[widthKey], photo[heightKey]);
            }
        }

        add(flickrOriginalUrl(photo), photo.width_o, photo.height_o);
        ['k', 'h', 'b', 'l', 'c', 'z'].forEach((suffix) => {
            add(flickrSizedUrl(photo, suffix), null, null);
        });

        return list;
    }

    function currentRenderedPhotos() {
        return visiblePhotos.slice(0, renderedCount);
    }

    function updateGalleryMeta() {
        if (!galleryMetaEl) return;
        const total = visiblePhotos.length;
        if (!total) {
            galleryMetaEl.textContent = '';
            return;
        }
        galleryMetaEl.textContent = `showing ${Math.min(renderedCount, total)} of ${total}`;
    }

    function updateLoadMoreButton() {
        if (!loadMoreBtn) return;
        const hasMore = renderedCount < visiblePhotos.length;
        loadMoreBtn.hidden = !hasMore;
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
                    selectAlbum(album.slug);
                }
            });

            albumNav.appendChild(button);
        });
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

            const img = document.createElement('img');
            const source = thumbSource(photo);
            img.src = source.url;
            img.alt = '';
            img.loading = 'lazy';

            button.appendChild(img);
            button.addEventListener('click', () => openLightbox(index));

            entry.appendChild(button);
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

        if (opts.updateHash !== false) {
            updateAlbumHash();
        }
    }

    function selectAlbum(slug, options) {
        const opts = options || {};
        const album = findAlbum(slug) || findAlbum('all');
        activeAlbumSlug = album ? album.slug : 'all';
        renderAlbumNav();
        setVisiblePhotos(photosForAlbum(activeAlbumSlug), {
            updateHash: opts.updateHash !== false
        });
        clearStatus();
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
        let index = 0;

        function tryNext() {
            if (token !== lightboxLoadToken || index >= candidates.length) return;
            const candidate = candidates[index++];
            const probe = new Image();
            probe.onload = () => {
                if (token !== lightboxLoadToken) return;
                lightboxImage.src = candidate.url;
            };
            probe.onerror = tryNext;
            probe.src = candidate.url;
        }

        tryNext();
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

    function applyHashRoute() {
        applyingHash = true;
        const { albumSlug, photoId } = parseLocationHash();

        try {
            if (photoId) {
                const targetAlbum = albumSlugForPhoto(photoId);
                if (targetAlbum !== activeAlbumSlug) {
                    selectAlbum(targetAlbum, { updateHash: false });
                }
                const renderedIndex = ensurePhotoRendered(photoId);
                if (renderedIndex !== -1) {
                    openLightbox(renderedIndex);
                } else {
                    setStatus('Photo not found in the local gallery.', true);
                }
                return;
            }

            if (lightboxEl.classList.contains('is-open')) {
                lightboxEl.classList.remove('is-open');
                lightboxEl.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('no-scroll');
            }

            if (albumSlug && findAlbum(albumSlug)) {
                selectAlbum(albumSlug, { updateHash: false });
            } else if (!albumSlug) {
                selectAlbum(activeAlbumSlug || 'all', { updateHash: false });
            } else {
                selectAlbum('all', { updateHash: false });
            }
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

    Promise.all([
        fetch(ALBUMS_URL).then((r) => {
            if (!r.ok) throw new Error(`albums ${r.status}`);
            return r.json();
        }),
        fetch(PHOTOS_URL).then((r) => {
            if (!r.ok) throw new Error(`photos ${r.status}`);
            return r.json();
        })
    ])
        .then(([albumData, photoData]) => {
            albums = Array.isArray(albumData) ? albumData : [];
            photosById = photoData && typeof photoData === 'object' ? photoData : {};

            if (!albums.length) {
                setStatus('No albums found.', true);
                return;
            }

            const { albumSlug, photoId } = parseLocationHash();
            if (photoId || albumSlug) {
                applyHashRoute();
            } else {
                selectAlbum('all');
            }
        })
        .catch((error) => {
            console.error(error);
            setStatus('Could not load the photography gallery.', true);
        });

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMore);
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => stepLightbox(-1));
    lightboxNext.addEventListener('click', () => stepLightbox(1));
    lightboxEl.addEventListener('click', (event) => {
        if (event.target === lightboxEl) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
        if (!lightboxEl.classList.contains('is-open')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeLightbox();
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            stepLightbox(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            stepLightbox(1);
        }
    });

    window.addEventListener('hashchange', () => {
        if (ignoreHashChange) return;
        applyHashRoute();
    });
});

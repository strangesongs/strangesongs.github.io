// Year pages hold every section (books, films, shows) on one page. Show the
// one named in the URL hash (default: the first) and keep the year label,
// page title and the totals line under the year in sync. Without JavaScript
// every section simply shows, one after another.
function updateYearPageView({ scrollToTop = false } = {}) {
    const yearLabel = document.querySelector('.year-label');
    const sections = Array.from(document.querySelectorAll('main > section.log[id]'));
    if (!yearLabel || sections.length === 0) return;

    const year = yearLabel.dataset.year || '';
    const shown = sections.find(section => section.id === window.location.hash.slice(1)) || sections[0];
    sections.forEach(section => { section.hidden = section !== shown; });

    const title = shown.dataset.sectionTitle || shown.id;
    yearLabel.textContent = `${year} (${title})`;
    document.title = `cleve - ${title} ${year}`;
    document.querySelectorAll('.year-totals a').forEach(link => {
        link.classList.toggle('is-active', link.hash === `#${shown.id}`);
    });

    if (scrollToTop) window.scrollTo(0, 0);
}

// Email links ship pointing at the about page; build the real address here
// so it never appears in the HTML for scrapers.
function setupEmailLinks() {
    document.querySelectorAll('a.email-link[data-user][data-domain]').forEach(link => {
        link.href = `mailto:${link.dataset.user}@${link.dataset.domain}`;
    });
}

// Homepage "on this day": films and shows from earlier years on today's
// date (the visitor's date, so it changes daily without a rebuild), plus
// links to any photographs taken on that date on the photo site. Only
// today's exact date counts; when nothing matches, the section stays hidden.
const MONTH_WORDS = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

async function setupOnThisDay() {
    const box = document.getElementById('on-this-day');
    if (!box) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const sameDay = (y, m, d) => y < year && m === month && d === day;

    const getJson = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const photoSite = box.dataset.photos || '';
    const [entries, photoData] = await Promise.all([
        getJson('onthisday.json'),
        photoSite ? getJson(photoSite + 'photos.json') : null
    ]);

    const logged = (entries || []).filter(e => sameDay(e.y, e.m, e.d));
    const albums = new Map(((photoData && photoData.albums) || []).map(a => [a.slug, a.title]));
    const photos = ((photoData && photoData.photos) || []).flatMap(p => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.date || '');
        return m && sameDay(Number(m[1]), Number(m[2]), Number(m[3])) ? [{ ...p, y: Number(m[1]) }] : [];
    });
    if (!logged.length && !photos.length) return;

    const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const items = [
        ...logged.map(e => ({ y: e.y, html: `<a href="${e.y}.html#${e.s}">${e.t}</a>`
            + `${e.w ? `<span class="entry-where">${e.w}</span>` : ''}` })),
        // A photograph is a text link to it on the photo site, with its albums under it.
        ...photos.map(p => {
            const where = (p.tags || []).filter(t => t !== 'cover').map(t => albums.get(t) || t).join(' · ');
            return { y: p.y, html: `<a href="${photoSite}#photo/${encodeURIComponent(p.file)}">photograph</a>`
                + `<span class="entry-where">${escape(['whatwesee', where].filter(Boolean).join(' · '))}</span>` };
        })
    ].sort((a, b) => b.y - a.y);

    box.querySelector('.otd-date').textContent = `${MONTH_WORDS[month - 1]} ${day}`;
    box.querySelector('.otd-list').innerHTML = items.map(item =>
        `<li class="dated"><span class="entry-date">${item.y}</span><span class="entry-body">${item.html}</span></li>`).join('');
    box.hidden = false;
}

window.addEventListener('hashchange', () => updateYearPageView({ scrollToTop: true }));
window.addEventListener('DOMContentLoaded', () => {
    updateYearPageView();
    setupEmailLinks();
    setupOnThisDay();
});

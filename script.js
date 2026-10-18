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

window.addEventListener('hashchange', () => updateYearPageView({ scrollToTop: true }));
window.addEventListener('DOMContentLoaded', () => {
    updateYearPageView();
    setupEmailLinks();
});

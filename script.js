function updateYearPageView(options = {}) {
    const { scrollToTop = false } = options;
    const yearLabel = document.querySelector('.year-label');
    const sections = Array.from(document.querySelectorAll('main .content section, main > section, .content > section')).filter(
        section => section.id
    );

    if (!yearLabel || sections.length === 0) {
        return;
    }

    const currentYear = (yearLabel.textContent.match(/\d{4}/) || [''])[0];
    const requestedId = window.location.hash.replace('#', '');
    const shownSection = sections.find(section => section.id === requestedId) || sections[0];

    sections.forEach(section => {
        section.style.display = section === shownSection ? 'block' : 'none';
    });

    if (currentYear) {
        const sectionTitle = shownSection.dataset.sectionTitle || shownSection.id;
        yearLabel.textContent = `${currentYear} (${sectionTitle})`;
        document.title = `cleve - ${sectionTitle} ${currentYear}`;
    }

    document.querySelectorAll('.rwl-sections a').forEach(link => {
        link.classList.toggle('is-active', link.hash === `#${shownSection.id}` && link.pathname.endsWith(`${currentYear}.html`));
    });

    if (scrollToTop) {
        window.scrollTo(0, 0);
    }
}

function setupSectionNavNoJump() {
    const sectionLinks = Array.from(document.querySelectorAll('.rwl-sections a, .mnav-sections a')).filter(
        link => link.hash
    );

    if (sectionLinks.length === 0) {
        return;
    }

    sectionLinks.forEach(link => {
        link.addEventListener('click', event => {
            const targetUrl = new URL(link.href, window.location.href);
            const samePage = targetUrl.pathname === window.location.pathname;

            if (!samePage) {
                return;
            }

            event.preventDefault();

            if (window.location.hash !== targetUrl.hash) {
                history.pushState(null, '', targetUrl.hash);
            }

            updateYearPageView({ scrollToTop: true });
        });
    });
}

function setupYearAccordion() {
    const yearDetails = Array.from(document.querySelectorAll('.rwl-year-item > details'));

    if (yearDetails.length === 0) {
        return;
    }

    const opened = yearDetails.filter(detail => detail.open);
    if (opened.length > 1) {
        opened.slice(1).forEach(detail => {
            detail.open = false;
        });
    }

    yearDetails.forEach(detail => {
        detail.addEventListener('toggle', () => {
            if (!detail.open) {
                return;
            }

            yearDetails.forEach(other => {
                if (other !== detail) {
                    other.open = false;
                }
            });
        });
    });
}

function setupMobileNav() {
    const rwlLink = document.querySelector('.mnav-rwl-link');
    const yearsRow = document.querySelector('.mnav-years');
    const sectionsRow = document.querySelector('.mnav-sections');
    if (!rwlLink || !yearsRow || !sectionsRow) return;

    const pageName = window.location.pathname.split('/').pop() || '';
    const isRwlPage = pageName === 'rwl.html';
    const yearMatch = pageName.match(/^(20\d{2})\.html$/);
    const currentYear = yearMatch ? yearMatch[1] : '';
    const isYearPage = Boolean(currentYear);

    const setActiveYear = year => {
        yearsRow.querySelectorAll('a').forEach(a => {
            a.classList.toggle('is-active', a.dataset.year === year);
        });
    };

    const renderSectionsForYear = year => {
        const yearLink = yearsRow.querySelector(`a[data-year="${year}"]`);
        if (!yearLink) {
            sectionsRow.innerHTML = '';
            sectionsRow.hidden = true;
            return;
        }

        const sections = (yearLink.dataset.sections || '').split(',').filter(Boolean);
        sectionsRow.innerHTML = sections.map(section => `<a href="${year}.html#${section}">${section}</a>`).join('');
        sectionsRow.hidden = sections.length === 0;
    };

    yearsRow.hidden = !(isRwlPage || isYearPage);
    rwlLink.classList.toggle('is-open', !yearsRow.hidden);

    if (isYearPage) {
        setActiveYear(currentYear);
        renderSectionsForYear(currentYear);
    } else {
        sectionsRow.hidden = true;
    }

    rwlLink.addEventListener('click', e => {
        // From about/index pages this remains a normal navigation link.
        if (!isRwlPage && !isYearPage) return;

        // On rwl/year pages, clicking toggles years visibility.
        e.preventDefault();
        const opening = yearsRow.hidden;
        yearsRow.hidden = !opening;

        if (!opening) {
            sectionsRow.hidden = true;
            yearsRow.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
        }

        rwlLink.classList.toggle('is-open', opening);
    });

    yearsRow.querySelectorAll('a[data-year]').forEach(yearLink => {
        yearLink.addEventListener('click', e => {
            e.preventDefault();
            const year = yearLink.dataset.year;
            setActiveYear(year);
            renderSectionsForYear(year);
        });
    });
}

window.addEventListener('hashchange', () => {
    updateYearPageView({ scrollToTop: true });
});
window.addEventListener('DOMContentLoaded', () => {
    setupYearAccordion();
    setupSectionNavNoJump();
    updateYearPageView({ scrollToTop: true });
    setupMobileNav();
});

const RWL_NAV_KEY = 'cleve-rwl-nav';

function saveRwlNavState() {
    const nav = document.querySelector('.cleanui-nav');
    if (!nav) {
        return;
    }

    const openYear = nav.querySelector('.rwl-year.is-open .rwl-year-toggle')?.dataset.year || '';
    try {
        sessionStorage.setItem(RWL_NAV_KEY, JSON.stringify({
            open: nav.classList.contains('is-rwl-open'),
            year: openYear
        }));
    } catch (error) {
        // Storage can be unavailable (private mode, blocked site data); nav still works.
    }
}

function restoreRwlNavState() {
    const nav = document.querySelector('.cleanui-nav');
    if (!nav || document.querySelector('.year-label')) {
        return;
    }

    try {
        const stored = JSON.parse(sessionStorage.getItem(RWL_NAV_KEY) || '{}');
        const rootToggle = nav.querySelector('.rwl-root-toggle');

        if (stored.open) {
            nav.classList.add('is-rwl-open');
            if (rootToggle) {
                rootToggle.setAttribute('aria-expanded', 'true');
            }
        }

        if (stored.year) {
            const toggle = nav.querySelector(`.rwl-year-toggle[data-year="${stored.year}"]`);
            const yearItem = toggle ? toggle.closest('.rwl-year') : null;
            if (yearItem) {
                yearItem.classList.add('is-open');
                toggle.setAttribute('aria-expanded', 'true');
                nav.querySelectorAll(`.rwl-section[data-year="${stored.year}"]`).forEach(item => {
                    item.classList.add('is-visible');
                });
            }
        }
    } catch (error) {
        try {
            sessionStorage.removeItem(RWL_NAV_KEY);
        } catch (ignored) {
            // Storage unavailable.
        }
    }
}

function updateYearPageView(options = {}) {
    const { scrollToTop = false } = options;
    const yearLabel = document.querySelector('.year-label');
    const sections = Array.from(document.querySelectorAll('main > section.log[id]'));

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

    document.querySelectorAll('.year-totals a').forEach(link => {
        link.classList.toggle('is-active', link.hash === `#${shownSection.id}`);
    });

    document.querySelectorAll('.cleanui-nav .depth-3.rwl-section a').forEach(link => {
        link.classList.toggle('is-active', link.hash === `#${shownSection.id}` && link.pathname.endsWith(`${currentYear}.html`));
    });

    syncRwlNavForYear(currentYear, shownSection.id);
    saveRwlNavState();

    if (scrollToTop) {
        window.scrollTo(0, 0);
    }
}

function syncRwlNavForYear(year, sectionId) {
    const nav = document.querySelector('.cleanui-nav');
    if (!nav || !year) {
        return;
    }

    nav.classList.add('is-rwl-open');
    const rootToggle = nav.querySelector('.rwl-root-toggle');
    if (rootToggle) {
        rootToggle.setAttribute('aria-expanded', 'true');
    }

    nav.querySelectorAll('.rwl-year').forEach(item => {
        const toggle = item.querySelector('.rwl-year-toggle');
        const itemYear = toggle ? toggle.dataset.year : '';
        const isOpen = itemYear === year;
        item.classList.toggle('is-open', isOpen);
        if (toggle) {
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    });

    nav.querySelectorAll('.rwl-section').forEach(item => {
        const itemYear = item.dataset.year;
        const isVisible = itemYear === year;
        item.classList.toggle('is-visible', isVisible);
    });
}

function setupRwlNav() {
    const nav = document.querySelector('.cleanui-nav');
    if (!nav) {
        return;
    }

    const rootToggle = nav.querySelector('.rwl-root-toggle');
    const yearToggles = Array.from(nav.querySelectorAll('.rwl-year-toggle'));

    const closeAllYears = () => {
        nav.querySelectorAll('.rwl-year').forEach(item => item.classList.remove('is-open'));
        nav.querySelectorAll('.rwl-section').forEach(item => item.classList.remove('is-visible'));
        yearToggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    };

    const setRwlOpen = open => {
        nav.classList.toggle('is-rwl-open', open);
        if (rootToggle) {
            rootToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (!open) {
            closeAllYears();
        }
        saveRwlNavState();
    };

    if (rootToggle) {
        rootToggle.addEventListener('click', () => {
            setRwlOpen(!nav.classList.contains('is-rwl-open'));
        });
    }

    yearToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            if (!nav.classList.contains('is-rwl-open')) {
                setRwlOpen(true);
            }

            const year = toggle.dataset.year;
            const yearItem = toggle.closest('.rwl-year');
            const opening = !yearItem.classList.contains('is-open');

            closeAllYears();

            if (opening) {
                yearItem.classList.add('is-open');
                toggle.setAttribute('aria-expanded', 'true');
                nav.querySelectorAll(`.rwl-section[data-year="${year}"]`).forEach(item => {
                    item.classList.add('is-visible');
                });
            }

            saveRwlNavState();
        });
    });
}

function setupSectionNavNoJump() {
    const sectionLinks = Array.from(document.querySelectorAll('.cleanui-nav .depth-3.rwl-section a, .mnav-sections a')).filter(
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

function setupMobileNav() {
    const rwlLink = document.querySelector('.mnav-rwl-link');
    const yearsRow = document.querySelector('.mnav-years');
    const sectionsRow = document.querySelector('.mnav-sections');
    if (!rwlLink || !yearsRow || !sectionsRow) return;

    const pageName = window.location.pathname.split('/').pop() || '';
    const yearMatch = pageName.match(/^(\d{4})\.html$/);
    const currentYear = yearMatch ? yearMatch[1] : '';
    const isYearPage = Boolean(currentYear);

    // The years row ships visible so the site works without JavaScript.
    // Collapse it here (CSS keeps it hidden until this runs, to avoid a flash).
    yearsRow.hidden = !isYearPage;
    document.documentElement.classList.add('nav-ready');

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

    if (isYearPage) {
        yearsRow.hidden = false;
        rwlLink.classList.add('is-open');
        setActiveYear(currentYear);
        renderSectionsForYear(currentYear);
    }

    rwlLink.addEventListener('click', e => {
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
// Email links ship pointing at the about page; build the real address here
// so it never appears in the HTML for scrapers.
function setupEmailLinks() {
    document.querySelectorAll('a.email-link[data-user][data-domain]').forEach(link => {
        link.href = `mailto:${link.dataset.user}@${link.dataset.domain}`;
    });
}

window.addEventListener('DOMContentLoaded', () => {
    setupEmailLinks();
    setupRwlNav();
    restoreRwlNavState();
    setupSectionNavNoJump();
    updateYearPageView({ scrollToTop: true });
    setupMobileNav();
});

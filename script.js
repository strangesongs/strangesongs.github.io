function updateYearPageView() {
    const yearLabel = document.querySelector('.year-label');
    const sections = Array.from(document.querySelectorAll('main .content section, main > section, .content > section')).filter(
        section => section.id
    );

    if (!yearLabel || sections.length === 0) {
        return;
    }

    const currentYear = (yearLabel.textContent.match(/\d{4}/) || [''])[0];
    const isMobile = window.innerWidth <= 768;
    const requestedId = window.location.hash.replace('#', '');
    const shownSection = sections.find(section => section.id === requestedId) || sections[0];

    sections.forEach(section => {
        section.style.display = isMobile || section === shownSection ? 'block' : 'none';
    });

    if (currentYear) {
        const sectionTitle = shownSection.dataset.sectionTitle || shownSection.id;
        yearLabel.textContent = isMobile ? currentYear : `${currentYear} (${sectionTitle})`;
        document.title = `${sectionTitle} ${currentYear}`;
    }

    document.querySelectorAll('.rwl-sections a').forEach(link => {
        link.classList.toggle('is-active', link.hash === `#${shownSection.id}` && link.pathname.endsWith(`${currentYear}.html`));
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

window.addEventListener('hashchange', updateYearPageView);
window.addEventListener('DOMContentLoaded', () => {
    setupYearAccordion();
    updateYearPageView();
});

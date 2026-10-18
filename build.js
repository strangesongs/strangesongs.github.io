const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ejs = require('ejs');
const { collectStats, renderStats } = require('./stats');

// --- site config -----------------------------------------------------------

const OUT_DIR = 'dist';
const CONTENT_DIR = 'content';
const TEMPLATE_PATH = path.join('templates', 'index.html');
const STATIC_FILES = ['style.css', 'script.js', 'favicon.svg'];

const SITE_URL = 'https://strangesongs.github.io/';
const SITE_NAME = 'cleve';
const SITE_DESCRIPTION = 'music, photography, small web projects, and a running log of what i read, watch, and listen to.';
// The address never appears in the HTML as-is: script.js assembles the mailto
// link from these parts, and without JavaScript the link goes to the about
// page, which spells it out in words.
const EMAIL_USER = 'jcrtll';
const EMAIL_DOMAIN = 'protonmail.com';

const SECTIONS = [
    { name: 'books', title: 'read', noun: 'book', verb: 'read' },
    { name: 'films', title: 'watch', noun: 'film', verb: 'watched' },
    { name: 'shows', title: 'listen', noun: 'show', verb: 'seen' }
];

const PROJECT_LINKS = [
    { title: 'consono', note: 'music', href: 'https://consono.bandcamp.com/', external: true },
    { title: 'ad lucem', note: 'guitar + electronics', href: 'https://adlucem.bandcamp.com/', external: true },
    { title: 'photography', note: '', href: 'whatwesee/', external: false },
    { title: 'fruit for all', note: 'local fruit-finding app', href: 'https://fruitforall.app/', external: true },
    { title: 'save to photos', note: 'assorted found images', href: 'https://savetophotos.com/', external: true }
];

const MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
];

// A list entry in any supported format: "- x", "1. x", "MM.DD x".
const ENTRY_PATTERN = /^(?:- |\d+\.\s+|\d{2}\.\d{2}\s+)\S/;

// --- helpers ---------------------------------------------------------------

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
}

function plural(noun, count) {
    if (count === 1) return noun;
    return noun === 'entry' ? 'entries' : `${noun}s`;
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function externalAttr(link) {
    return link.external ? ' target="_blank" rel="noopener"' : '';
}

// Project links carry a short note: shown under the link in the sidebar,
// and as a tooltip in the mobile nav (which has no room for it).
function projectLinkAttrs(link) {
    return `href="${link.href}"${externalAttr(link)}${link.note ? ` title="${escapeAttr(link.note)}"` : ''}`;
}

// Every content/YYYY folder that has at least one section file, oldest first.
function discoverYears() {
    return fs.readdirSync(CONTENT_DIR)
        .filter(name => /^\d{4}$/.test(name))
        .filter(name => fs.statSync(path.join(CONTENT_DIR, name)).isDirectory())
        .filter(name => sectionsForYear(name).length > 0)
        .sort();
}

function sectionsForYear(year) {
    return SECTIONS.filter(section =>
        fs.existsSync(path.join(CONTENT_DIR, year, `${section.name}.md`))
    );
}

function countEntries(rawContent) {
    return rawContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => ENTRY_PATTERN.test(line)).length;
}

// --- markdown --------------------------------------------------------------

function insertMonthHeaders(content) {
    let lastMonth = null;
    const result = [];

    for (const line of content.split('\n')) {
        const manualHeading = line.match(/^### ([a-z]+)$/);
        if (manualHeading) {
            const monthIndex = MONTH_NAMES.indexOf(manualHeading[1]);
            if (monthIndex >= 0) {
                lastMonth = String(monthIndex + 1).padStart(2, '0');
            }
            result.push(line);
            continue;
        }

        const match = line.match(/^(\d{2})\.\d{2}\s+/);
        if (!match || match[1] === lastMonth) {
            result.push(line);
            continue;
        }

        const monthIndex = parseInt(match[1], 10) - 1;
        if (monthIndex < 0 || monthIndex > 11) {
            result.push(line);
            continue;
        }

        lastMonth = match[1];
        const heading = `### ${MONTH_NAMES[monthIndex]}`;
        if (result[result.length - 1] !== heading) {
            result.push(heading);
        }
        result.push(line);
    }

    return result.join('\n');
}

// A trailing "*" marks a repeat viewing.
function markRepeat(body) {
    return body.replace(/\s*\*$/, ' <span class="repeat" title="repeat viewing">*</span>');
}

// plainClass: class for plain paragraphs (format lines and notes on log pages).
function processMarkdown(content, { plainClass = '' } = {}) {
    content = content.replace(/^---[\s\S]*?---\n/, '');
    content = escapeHtml(content);
    content = insertMonthHeaders(content);

    // Headers first so month headings stay on their own lines.
    content = content.replace(/^### (.+)$/gm, '<h3 class="month-heading">$1</h3>');
    content = content.replace(/^## (.+)$/gm, (m, text) =>
        `<h2 id="${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">${text}</h2>`);
    content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    content = content.replace(/^- (.+)$/gm, (m, body) => `<li class="bullet">${markRepeat(body)}</li>`);
    content = content.replace(/^\d+\.\s+(.+)$/gm, (m, body) => `<li class="numbered">${markRepeat(body)}</li>`);
    content = content.replace(/^(\d{2}\.\d{2})\s+(.+)$/gm, (m, date, body) =>
        `<li class="dated"><span class="entry-date">${date}</span><span class="entry-body">${markRepeat(body)}</span></li>`
    );

    // Blank lines split lists into separate groups.
    content = content.replace(/(<li class="bullet">.*?<\/li>\n?)+/g, m => `<ul class="markdown-list bullet-list">${m}</ul>`);
    content = content.replace(/(<li class="numbered">.*?<\/li>\n?)+/g, m => `<ol class="markdown-list numbered-list">${m}</ol>`);
    content = content.replace(/(<li class="dated">.*?<\/li>\n?)+/g, m => `<ul class="markdown-list dated-list">${m}</ul>`);

    content = content.split('\n').map(line => {
        line = line.trim();
        if (line === '' || line.startsWith('<')) return line;
        if (line.startsWith('* denotes')) return `<p class="addendum">${line}</p>`;
        return plainClass ? `<p class="${plainClass}">${line}</p>` : `<p>${line}</p>`;
    }).join('\n').replace(/\n{3,}/g, '\n\n');

    // Links last, once structure is in place. Text and URL are already escaped.
    // Only web links and relative paths become links; anything else
    // (javascript:, data:, ...) is published as plain text.
    content = content.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url)) return text;
        const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${url}"${external}>${text}</a>`;
    });

    return content;
}

// --- page rendering --------------------------------------------------------

function assetVersion() {
    const hash = crypto.createHash('sha1');
    STATIC_FILES.forEach(file => hash.update(fs.readFileSync(file)));
    return hash.digest('hex').slice(0, 10);
}

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const version = assetVersion();

function writePage(fileName, { title, description, sidebar, content, yearLabel = '', yearTotals = '', baseHref = '', noindex = false }) {
    const html = ejs.render(template, {
        pageTitle: title ? `${SITE_NAME} - ${title}` : SITE_NAME,
        siteName: SITE_NAME,
        description: description || SITE_DESCRIPTION,
        canonicalUrl: SITE_URL + (fileName === 'index.html' ? '' : fileName),
        version,
        sidebar,
        content,
        yearLabel,
        yearTotals,
        baseHref,
        noindex
    });
    fs.writeFileSync(path.join(OUT_DIR, fileName), html);
    console.log(`Generated ${fileName}`);
}

function emailLink() {
    return `<a href="about.html#contact" class="email-link" data-user="${EMAIL_USER}" data-domain="${EMAIL_DOMAIN}">email</a>`;
}

function buildSidebar(years, { currentYear = '', currentPage = '' } = {}) {
    const newestFirst = [...years].reverse();
    const active = isActive => (isActive ? ' class="is-active"' : '');

    // Desktop: every year is one plain link, always visible. Sections are
    // switched on the year page itself (the totals line under the year).
    let html = `<p class="masthead"><a href="index.html">${SITE_NAME}</a></p>\n`;
    html += '<ul class="site-nav">\n';
    html += '<li class="depth-1 nav-label">read watch listen</li>\n';
    newestFirst.forEach(year => {
        html += `<li class="depth-2"><a href="${year}.html"${active(year === currentYear)}>${year}</a></li>\n`;
    });
    html += `<li class="depth-2 nav-extras"><a href="abandoned.html"${active(currentPage === 'abandoned')}>abandoned</a> · <a href="stats.html"${active(currentPage === 'stats')}>stats</a></li>\n`;

    PROJECT_LINKS.forEach(link => {
        const note = link.note ? `<span class="nav-note">${escapeHtml(link.note)}</span>` : '';
        html += `<li class="depth-1 project"><a ${projectLinkAttrs(link)}>${link.title}</a>${note}</li>\n`;
    });

    html += `<li class="depth-1 nav-footer"><a href="about.html"${active(currentPage === 'about')}>about</a></li>\n`;
    html += `<li class="depth-1 nav-footer">${emailLink()}</li>\n`;
    html += '</ul>\n';

    // Phones: the same links as two wrapping rows of text.
    html += '\n<nav class="mobile-nav">';
    html += '\n  <div class="mnav-row mnav-main">';
    html += `\n    <a href="about.html"${active(currentPage === 'about')}>about</a>`;
    PROJECT_LINKS.forEach(link => {
        html += `\n    <a ${projectLinkAttrs(link)}>${link.title}</a>`;
    });
    html += `\n    ${emailLink()}`;
    html += '\n  </div>';
    html += '\n  <div class="mnav-row mnav-years">';
    newestFirst.forEach(year => {
        html += `\n    <a href="${year}.html"${active(year === currentYear)}>${year}</a>`;
    });
    html += `\n    <a href="abandoned.html" class="mnav-extra${currentPage === 'abandoned' ? ' is-active' : ''}">abandoned</a>`;
    html += `\n    <a href="stats.html" class="mnav-extra${currentPage === 'stats' ? ' is-active' : ''}">stats</a>`;
    html += '\n  </div>';
    html += '\n</nav>';

    return html;
}

function buildYear(year, years) {
    const sections = sectionsForYear(year);
    const counts = [];
    const totals = [];
    let content = '';

    sections.forEach(section => {
        let raw = fs.readFileSync(path.join(CONTENT_DIR, year, `${section.name}.md`), 'utf8');
        const count = countEntries(raw);
        counts.push(`${count} ${plural(section.noun, count)} ${section.verb}`);
        totals.push(`<a href="#${section.name}">${count} ${plural(section.noun, count)}</a>`);

        content += `<section id="${section.name}" class="log ${section.name}" data-section-title="${section.title}">\n`;
        content += `    <h2>${section.title}</h2>\n`;
        content += `    ${processMarkdown(raw, { plainClass: 'meta' })}\n`;
        content += `</section>\n`;
    });

    writePage(`${year}.html`, {
        title: year,
        description: `${year}: ${counts.join(', ')}.`,
        sidebar: buildSidebar(years, { currentYear: year }),
        content,
        yearLabel: year,
        yearTotals: totals.join(' · ')
    });
}

function buildSimplePage(name, years, { title, description, sectionAttrs, heading, plainClass }) {
    const filePath = path.join(CONTENT_DIR, `${name}.md`);
    const body = fs.existsSync(filePath)
        ? processMarkdown(fs.readFileSync(filePath, 'utf8'), { plainClass })
        : '<p>coming soon</p>';
    const headingHtml = heading ? `\n    <h2>${heading}</h2>` : '';

    writePage(`${name}.html`, {
        title,
        description,
        sidebar: buildSidebar(years, { currentPage: name }),
        content: `<section ${sectionAttrs}>${headingHtml}\n    ${body}\n</section>`
    });
}

// Split an entry line into its parts: date (MM.DD or ''), main text, fields.
function parseEntry(line) {
    const dated = line.match(/^(\d{2})\.(\d{2})\s+(.+)$/);
    const body = dated ? dated[3] : line.replace(/^(?:- |\d+\.\s+)/, '');
    const fields = body
        .replace(/\s*\*$/, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .split('|')
        .map(field => field.trim());
    return { month: dated ? dated[1] : '', day: dated ? dated[2] : '', main: fields[0], fields };
}

// The newest `count` entries in a section, newest first, continuing into
// earlier years when the newest year has fewer.
function recentEntries(years, section, count) {
    const found = [];
    for (const year of [...years].reverse()) {
        const file = path.join(CONTENT_DIR, year, `${section.name}.md`);
        if (!fs.existsSync(file)) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => ENTRY_PATTERN.test(line));
        for (const line of lines.reverse()) {
            const number = (line.match(/^(\d+)\./) || [])[1] || '';
            found.push({ year, number, ...parseEntry(line) });
            if (found.length === count) return found;
        }
    }
    return found;
}

const HOME_SECTIONS = [
    { section: SECTIONS[0], title: 'recently read', where: () => '' },
    { section: SECTIONS[1], title: 'recently watched', where: entry => entry.fields[2] || entry.fields[1] || '' },
    { section: SECTIONS[2], title: 'recently heard', where: entry => entry.fields[1] || '' }
];

function buildHome(years) {
    const newestYear = years[years.length - 1];
    let content = '';

    HOME_SECTIONS.forEach(({ section, title, where }) => {
        const entries = recentEntries(years, section, 5);
        if (!entries.length) return;

        const latestYear = entries[0].year;
        const count = countEntries(fs.readFileSync(path.join(CONTENT_DIR, latestYear, `${section.name}.md`), 'utf8'));
        content += `<section class="home-log ${section.name}">\n  <div class="section-head"><h2 class="section-title">${title}</h2>`;
        content += `<a class="section-count" href="${latestYear}.html#${section.name}">${count} ${plural(section.noun, count)} in ${latestYear}</a></div>\n`;
        content += '  <ul class="markdown-list dated-list">';
        entries.forEach(entry => {
            // Dated entries show MM.DD (plus the year when it isn't the current one);
            // books have no dates, so they show their list number, as on the year page.
            const date = entry.month
                ? `${entry.month}.${entry.day}${entry.year !== newestYear ? `.${entry.year.slice(2)}` : ''}`
                : entry.number ? `[${entry.number.padStart(2, '0')}]` : entry.year;
            const place = where(entry);
            content += `\n    <li class="dated"><span class="entry-date">${escapeHtml(date)}</span>`;
            content += `<span class="entry-body"><a href="${entry.year}.html#${section.name}">${escapeHtml(entry.main)}</a>`;
            if (place) content += `<span class="entry-where">${escapeHtml(place)}</span>`;
            content += '</span></li>';
        });
        content += '\n  </ul>\n';
        content += '</section>\n';
    });

    writePage('index.html', { sidebar: buildSidebar(years), content });
}

function buildStats(years) {
    const stats = collectStats(CONTENT_DIR, years);
    writePage('stats.html', {
        title: 'stats',
        description: `${stats.allFilms.length} films, ${stats.allShows.length} shows and counting: formats, cinemas, venues and directors.`,
        sidebar: buildSidebar(years, { currentPage: 'stats' }),
        content: `<div class="stats">\n${renderStats(stats, { escapeHtml, plural })}</div>`
    });
}

// GitHub Pages serves 404.html for any missing path, at any depth, so this
// page uses root-relative URLs via <base href="/">.
function buildNotFound(years) {
    writePage('404.html', {
        title: 'not found',
        description: 'page not found.',
        baseHref: '/',
        noindex: true,
        sidebar: buildSidebar(years),
        content: `<section class="intro not-found">
    <p>nothing here.</p>
    <p class="not-found-links"><a href="index.html">home</a> · <a href="${years[years.length - 1]}.html">${years[years.length - 1]}</a> · <a href="stats.html">stats</a> · <a href="about.html">about</a></p>
</section>`
    });
}

function buildRobotsAndSitemap(years) {
    const pages = ['', ...[...years].reverse().map(y => `${y}.html`), 'stats.html', 'abandoned.html', 'about.html'];
    const today = formatDate(new Date());
    const urls = pages.map(page => `  <url><loc>${SITE_URL}${page}</loc><lastmod>${today}</lastmod></url>`).join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
    console.log('Generated sitemap.xml, robots.txt');
}

// Old URL kept alive for anyone who bookmarked it.
function buildRwlRedirect() {
    fs.writeFileSync(path.join(OUT_DIR, 'rwl.html'), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=index.html">
    <link rel="canonical" href="${SITE_URL}">
    <title>${SITE_NAME}</title>
</head>
<body><p><a href="index.html">${SITE_NAME}</a></p></body>
</html>
`);
    console.log('Generated rwl.html (redirect to index)');
}

// --- build -----------------------------------------------------------------

function build() {
    console.log(`Building into ${OUT_DIR}/ ...`);
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });

    STATIC_FILES.forEach(file => fs.copyFileSync(file, path.join(OUT_DIR, file)));

    const years = discoverYears();
    years.forEach(year => buildYear(year, years));

    buildSimplePage('about', years, {
        title: 'about',
        description: SITE_DESCRIPTION,
        sectionAttrs: 'class="about"'
    });
    buildSimplePage('abandoned', years, {
        title: 'abandoned',
        description: 'books and films i gave up on before finishing.',
        sectionAttrs: 'id="abandoned" class="log abandoned" data-section-title="abandoned"',
        heading: 'abandoned',
        plainClass: 'meta'
    });

    buildHome(years);
    buildStats(years);
    buildNotFound(years);
    buildRobotsAndSitemap(years);
    buildRwlRedirect();

    console.log('Build complete!');
}

build();

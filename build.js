const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
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
const EMAIL = 'jcrtll@protonmail.com';

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
    content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
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
        if (line.startsWith('total:')) return `<p class="count">${line}</p>`;
        return plainClass ? `<p class="${plainClass}">${line}</p>` : `<p>${line}</p>`;
    }).join('\n').replace(/\n{3,}/g, '\n\n');

    // Links last, once structure is in place. Text and URL are already escaped.
    content = content.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    return content;
}

// --- git history -----------------------------------------------------------

function git(args) {
    try {
        return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
        return '';
    }
}

function lastCommit(file) {
    const out = git(['log', '-1', '--format=%H %ct', '--', file]);
    if (!out) return null;
    const [hash, time] = out.split(' ');
    return { hash, time: Number(time) };
}

// Describe what the given commit did to the file. Entries added and removed
// in the same commit count as edits (e.g. a typo fix), not additions.
function summarizeCommit(commit, file, noun) {
    if (!commit) return 'not yet committed';

    const diff = git(['show', '--format=', '--unified=0', commit.hash, '--', file]).split('\n');
    const added = diff.filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1));
    const removed = diff.filter(line => line.startsWith('-') && !line.startsWith('---')).map(line => line.slice(1));

    if (noun) {
        const addedEntries = added.filter(line => ENTRY_PATTERN.test(line.trim())).length;
        const removedEntries = removed.filter(line => ENTRY_PATTERN.test(line.trim())).length;
        const net = addedEntries - removedEntries;
        if (net > 0) return `${net} new ${plural(noun, net)} added`;
        if (net < 0) return `${-net} ${plural(noun, -net)} removed`;
        if (addedEntries > 0) return `${addedEntries} ${plural(noun, addedEntries)} edited`;
    }

    const changed = added.length + removed.length;
    if (changed > 0) return `${changed} ${changed === 1 ? 'line' : 'lines'} changed`;
    return 'updated';
}

// Everything that can appear in "recent updates" or the changelog.
function collectSources(years) {
    const sources = [];

    years.forEach(year => {
        sectionsForYear(year).forEach(section => {
            sources.push({
                file: path.join(CONTENT_DIR, year, `${section.name}.md`),
                year,
                label: section.title,
                href: `${year}.html#${section.name}`,
                noun: section.noun,
                isLog: true
            });
        });
    });

    sources.push({ file: path.join(CONTENT_DIR, 'abandoned.md'), label: 'abandoned', href: 'abandoned.html', noun: 'entry' });
    sources.push({ file: path.join(CONTENT_DIR, 'about.md'), label: 'about', href: 'about.html', noun: null });
    sources.push({ file: path.join(CONTENT_DIR, 'home.md'), label: 'home', href: 'index.html', noun: null });
    ['style.css', 'script.js', TEMPLATE_PATH, 'build.js', 'stats.js'].forEach(file => {
        sources.push({ file, label: file, href: null, noun: null });
    });

    return sources
        .filter(source => fs.existsSync(source.file))
        .map(source => {
            const commit = lastCommit(source.file);
            const time = commit ? commit.time * 1000 : fs.statSync(source.file).mtimeMs;
            return { ...source, date: new Date(time), summary: summarizeCommit(commit, source.file, source.noun) };
        })
        .sort((a, b) => (b.date - a.date) || a.file.localeCompare(b.file));
}

// --- page rendering --------------------------------------------------------

function assetVersion() {
    const hash = crypto.createHash('sha1');
    STATIC_FILES.forEach(file => hash.update(fs.readFileSync(file)));
    return hash.digest('hex').slice(0, 10);
}

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const version = assetVersion();

function writePage(fileName, { title, description, sidebar, content, yearLabel = '', yearTotals = '' }) {
    const html = ejs.render(template, {
        pageTitle: title ? `${SITE_NAME} - ${title}` : SITE_NAME,
        siteName: SITE_NAME,
        description: description || SITE_DESCRIPTION,
        canonicalUrl: SITE_URL + (fileName === 'index.html' ? '' : fileName),
        version,
        sidebar,
        content,
        yearLabel,
        yearTotals
    });
    fs.writeFileSync(path.join(OUT_DIR, fileName), html);
    console.log(`Generated ${fileName}`);
}

function buildSidebar(years, { currentYear = '', currentSection = '', currentPage = '' } = {}) {
    const newestFirst = [...years].reverse();
    const rwlExpanded = Boolean(currentYear) || currentPage === 'abandoned' || currentPage === 'stats';
    const active = isActive => (isActive ? ' class="is-active"' : '');

    let html = `<p class="cleanui-masthead primary"><a href="index.html">${SITE_NAME}</a></p>\n`;
    html += `<ul class="cleanui-nav${rwlExpanded ? ' is-rwl-open' : ''}">\n`;
    html += `<li class="depth-1"><button type="button" class="nav-toggle rwl-root-toggle" aria-expanded="${rwlExpanded}">read watch listen</button></li>\n`;

    newestFirst.forEach(year => {
        const isCurrentYear = year === currentYear;
        html += `<li class="depth-2 rwl-branch rwl-year${isCurrentYear ? ' is-open' : ''}"><button type="button" class="nav-toggle rwl-year-toggle" data-year="${year}" aria-expanded="${isCurrentYear}">${year}</button></li>\n`;
        sectionsForYear(year).forEach(section => {
            const visible = isCurrentYear ? ' is-visible' : '';
            const isActive = isCurrentYear && section.name === currentSection;
            html += `<li class="depth-3 rwl-branch rwl-section${visible}" data-year="${year}"><a href="${year}.html#${section.name}"${active(isActive)}>${section.name}</a></li>\n`;
        });
    });

    html += `<li class="depth-2 rwl-branch"><a href="abandoned.html"${active(currentPage === 'abandoned')}>abandoned</a></li>\n`;
    html += `<li class="depth-2 rwl-branch"><a href="stats.html"${active(currentPage === 'stats')}>stats</a></li>\n`;

    PROJECT_LINKS.forEach(link => {
        const note = link.note ? `<span class="nav-note">${escapeHtml(link.note)}</span>` : '';
        html += `<li class="depth-1 project"><a ${projectLinkAttrs(link)}>${link.title}</a>${note}</li>\n`;
    });

    html += `<li class="depth-1 nav-footer"><a href="about.html"${active(currentPage === 'about')}>about</a></li>\n`;
    html += `<li class="depth-1 nav-footer"><a href="changelog.html"${active(currentPage === 'changelog')}>changelog</a></li>\n`;
    html += `<li class="depth-1 nav-footer"><a href="mailto:${EMAIL}">email</a></li>\n`;
    html += `</ul>\n`;

    // Mobile nav. The years row is visible by default so it works without
    // JavaScript; script.js collapses it.
    html += `\n<nav class="mobile-nav">`;
    html += `\n  <div class="mnav-row mnav-main">`;
    html += `\n    <a href="about.html">about</a>`;
    html += `\n    <a href="#mnav-years" class="mnav-rwl-link">read watch listen</a>`;
    PROJECT_LINKS.forEach(link => {
        html += `\n    <a ${projectLinkAttrs(link)}>${link.title}</a>`;
    });
    html += `\n    <a href="mailto:${EMAIL}">email</a>`;
    html += `\n  </div>`;
    html += `\n  <div class="mnav-row mnav-years" id="mnav-years">`;
    newestFirst.forEach(year => {
        const sections = sectionsForYear(year).map(section => section.name).join(',');
        html += `\n    <a href="${year}.html" data-year="${year}" data-sections="${sections}">${year}</a>`;
    });
    html += `\n    <a href="abandoned.html" data-leaf="true">abandoned</a>`;
    html += `\n    <a href="stats.html" data-leaf="true">stats</a>`;
    html += `\n  </div>`;
    html += `\n  <div class="mnav-row mnav-sections" hidden></div>`;
    html += `\n</nav>`;

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
        // The year header shows live totals, so the file's own total line is dropped.
        raw = raw.replace(/^total:.*\n?/m, '');

        content += `<section id="${section.name}" class="log ${section.name}" data-section-title="${section.title}">\n`;
        content += `    <h2>${section.title}</h2>\n`;
        content += `    ${processMarkdown(raw, { plainClass: 'meta' })}\n`;
        content += `</section>\n`;
    });

    writePage(`${year}.html`, {
        title: year,
        description: `${year}: ${counts.join(', ')}.`,
        sidebar: buildSidebar(years, { currentYear: year, currentSection: sections[0].name }),
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

function updateBlock(source) {
    const label = source.year || source.label;
    const name = source.href
        ? `<a href="${source.href}" class="file-name">${escapeHtml(label)}</a>`
        : `<span class="file-name">${escapeHtml(label)}</span>`;
    const section = source.year ? `<span class="file-section">${source.label}</span>` : '';
    return `\n  <div class="recent-file-block"><div class="recent-file-meta">${name}${section}`
        + `<span class="file-date">${formatDate(source.date)}</span></div>`
        + `<div class="file-summary">${escapeHtml(source.summary)}</div></div>`;
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

// The newest entry in a section, from the newest year that has one.
function latestEntry(years, section) {
    for (const year of [...years].reverse()) {
        const file = path.join(CONTENT_DIR, year, `${section.name}.md`);
        if (!fs.existsSync(file)) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => ENTRY_PATTERN.test(line));
        if (lines.length) return { year, ...parseEntry(lines[lines.length - 1]) };
    }
    return null;
}

function currentlyBlock(years) {
    const rows = [
        { section: SECTIONS[0], label: 'last read', place: () => '' },
        { section: SECTIONS[1], label: 'last watched', place: entry => entry.fields[2] || '' },
        { section: SECTIONS[2], label: 'last show', place: entry => entry.fields[1] || '' }
    ];

    let html = '<section class="recent-updates currently">\n  <h2 class="recent-updates-title">currently</h2>';
    rows.forEach(({ section, label, place }) => {
        const entry = latestEntry(years, section);
        if (!entry) return;
        const date = entry.month ? `${entry.year}-${entry.month}-${entry.day}` : entry.year;
        const where = place(entry);
        html += `\n  <div class="recent-file-block"><div class="recent-file-meta">`;
        html += `<a href="${entry.year}.html#${section.name}" class="file-name">${label}</a>`;
        html += `<span class="file-date">${escapeHtml(date)}</span>`;
        if (where) html += `<span class="file-section">${escapeHtml(where)}</span>`;
        html += `</div><div class="file-summary">${escapeHtml(entry.main)}</div></div>`;
    });
    return html + '\n</section>\n';
}

function buildHome(years, sources) {
    const introPath = path.join(CONTENT_DIR, 'home.md');
    let content = fs.existsSync(introPath)
        ? `<section class="intro">\n    ${processMarkdown(fs.readFileSync(introPath, 'utf8'))}\n</section>\n`
        : '';
    content += currentlyBlock(years);
    content += '<section class="recent-updates">\n  <h2 class="recent-updates-title">recent updates</h2>';
    sources.filter(source => source.isLog).slice(0, 6).forEach(source => {
        content += updateBlock(source);
    });
    content += '\n  <p class="recent-more"><a href="changelog.html">full changelog</a></p>';
    content += '\n</section>';

    writePage('index.html', { sidebar: buildSidebar(years), content });
}

function buildChangelog(years, sources) {
    let content = '<section class="recent-updates site-changelog">\n  <h2 class="recent-updates-title">site changelog</h2>';
    sources.slice(0, 15).forEach(source => {
        content += updateBlock(source);
    });
    content += '\n</section>';

    writePage('changelog.html', {
        title: 'changelog',
        description: `recent changes to ${SITE_NAME}.`,
        sidebar: buildSidebar(years, { currentPage: 'changelog' }),
        content
    });
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

    const sources = collectSources(years);
    buildHome(years, sources);
    buildChangelog(years, sources);
    buildStats(years);
    buildRwlRedirect();

    console.log('Build complete!');
}

build();

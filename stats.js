// Stats page: everything here is computed from content/ at build time.
//
// Older years record format and location inconsistently (2010/2014 have
// neither; 2013 sometimes puts a country in the format slot), so formats,
// cinemas and streaming services are recognized by name in any field rather
// than by field position.

const fs = require('fs');
const path = require('path');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// First field (left to right) that matches any rule decides the format.
const FORMATS = [
    ['streaming', /streaming|netflix|hulu|amazon prime|youtube|criterion channel|kanopy|mubi|vimeo|apple tv/],
    ['70mm', /\b70 ?mm\b/],
    ['35mm', /\b35 ?mm\b/],
    ['16mm', /\b16 ?mm\b/],
    ['dcp / 4k', /\bdcp\b|\b4k\b/i],
    ['blu-ray', /blu-?ray/],
    ['dvd', /\bdvd\b/],
    ['digital', /digital|\.avi|torrent|vhs/]
];

const CINEMAS = [
    [/2220/, '2220 arts + archives'],
    [/egyptian/, 'egyptian theater'],
    [/los feliz/, 'los feliz 3'],
    [/philosophical research|^prs$/, 'philosophical research society'],
    [/marciano/, 'marciano art foundation'],
    [/new beverly/, 'new beverly cinema'],
    [/academy museum/, 'academy museum'],
    [/lacma/, 'lacma'],
    [/alamo/, 'alamo drafthouse'],
    [/aero theater/, 'aero theater'],
    [/brain ?dead/, 'brain dead studios'],
    [/regency/, 'regency theater'],
    [/castro/, 'castro theater'],
    [/century city/, 'amc century city'],
    [/gardena/, 'gardena cinema'],
    [/directors guild/, 'directors guild of america'],
    [/vista/, 'vista theater'],
    [/nuart/, 'nuart theater'],
    [/moca/, 'moca grand'],
    [/ucla/, 'ucla film archive']
];

const SERVICES = [
    [/criterion channel/, 'criterion channel'],
    [/kanopy/, 'kanopy'],
    [/mubi/, 'mubi'],
    [/youtube/, 'youtube'],
    [/netflix/, 'netflix'],
    [/hulu/, 'hulu'],
    [/apple tv/, 'apple tv'],
    [/vimeo/, 'vimeo'],
    [/amazon/, 'amazon prime'],
    [/night flight/, 'night flight plus'],
    [/light ?cone/, 'light cone'],
    [/flight/, 'in-flight']
];

const NOT_A_VENUE = /^(streaming|couch tour)$/;

function match(rules, text) {
    const hit = rules.find(([pattern]) => pattern.test(text));
    return hit ? hit[1] : null;
}

function readEntries(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).flatMap(line => {
        const m = line.match(/^(?:(\d{2})\.\d{2}|\d+\.|-)\s+(.+)$/);
        if (!m) return [];
        const repeat = /\s\*$|\*$/.test(m[2]);
        const fields = m[2]
            .replace(/\s*\*$/, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .split('|')
            .map(field => field.trim().toLowerCase());
        return [{ month: m[1] ? Number(m[1]) : null, main: fields[0], extra: fields.slice(1), repeat }];
    });
}

function analyzeFilm(entry) {
    let format = null;
    for (const field of entry.extra) {
        format = match(FORMATS.map(([name, re]) => [re, name]), field);
        if (format) break;
    }
    let cinema = null;
    for (const field of entry.extra) {
        cinema = match(CINEMAS, field);
        if (cinema) break;
    }
    let service = null;
    if (format === 'streaming') {
        for (const field of entry.extra) {
            service = match(SERVICES, field) || (field === 'criterion' ? 'criterion channel' : null);
            if (service) break;
        }
        service = service || 'unspecified';
    }
    const director = (entry.main.match(/\(\d{4}\)\s*(.+)$/) || [])[1] || null;
    // Seen in a cinema: a named cinema, a projection format, or the entry says so.
    const inCinema = Boolean(cinema)
        || ['70mm', '35mm', '16mm', 'dcp / 4k'].includes(format)
        || entry.extra.some(field => /theat(er|re)|screening|cinema/.test(field) && !/home screening|tv performance/.test(field));
    return { ...entry, format, cinema, service, director, inCinema, recorded: entry.extra.length > 0 };
}

function tally(items) {
    const counts = new Map();
    items.filter(Boolean).forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function collectStats(contentDir, years) {
    const perYear = years.map(year => {
        const dir = path.join(contentDir, year);
        const films = readEntries(path.join(dir, 'films.md')).map(analyzeFilm);
        const shows = readEntries(path.join(dir, 'shows.md'));
        const books = readEntries(path.join(dir, 'books.md'));
        return {
            year,
            hasBooks: fs.existsSync(path.join(dir, 'books.md')),
            hasFilms: fs.existsSync(path.join(dir, 'films.md')),
            hasShows: fs.existsSync(path.join(dir, 'shows.md')),
            books,
            films,
            shows
        };
    });
    const allFilms = perYear.flatMap(y => y.films);
    const allShows = perYear.flatMap(y => y.shows);
    const monthYear = [...perYear].reverse().find(y => y.films.some(f => f.month) || y.shows.some(s => s.month));

    return {
        perYear,
        allFilms,
        allShows,
        formats: tally(allFilms.map(f => f.format)),
        formatRecorded: allFilms.filter(f => f.format).length,
        cinemas: tally(allFilms.map(f => f.cinema)),
        services: tally(allFilms.map(f => f.service)),
        showVenues: tally(allShows.map(s => s.extra[0]).filter(v => v && !NOT_A_VENUE.test(v))),
        directors: tally(allFilms.map(f => f.director)),
        monthYear
    };
}

// --- rendering -------------------------------------------------------------

function renderStats(stats, { escapeHtml, plural }) {
    const bars = (rows, { limit = 10, unit = '' } = {}) => {
        const shown = rows.slice(0, limit);
        const max = Math.max(1, ...shown.map(([, count]) => count));
        return `<div class="bars">${shown.map(([label, count]) => {
            const width = (count / max * 100).toFixed(1);
            const tip = `${label}: ${count}${unit ? ' ' + plural(unit, count) : ''}`;
            return `\n  <div class="bar-row" title="${escapeHtml(tip)}"><span class="bar-label">${escapeHtml(label)}</span>`
                + `<span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>`
                + `<span class="bar-value">${count}</span></div>`;
        }).join('')}\n</div>`;
    };
    const block = (title, body, note = '') =>
        `<section class="stats-block">\n<h2 class="section-title">${title}</h2>\n${body}${note ? `\n<p class="stats-note">${note}</p>` : ''}\n</section>\n`;

    // Totals by year
    const cell = (has, list) => (has ? String(list.length) : '—');
    const cinemaCell = y => {
        const recorded = y.films.filter(f => f.recorded);
        if (!y.hasFilms || recorded.length === 0) return '—';
        return String(y.films.filter(f => f.inCinema).length);
    };
    const rows = [...stats.perYear].reverse().map(y =>
        `<tr><th scope="row"><a href="${y.year}.html">${y.year}</a></th><td>${cell(y.hasBooks, y.books)}</td><td>${cell(y.hasFilms, y.films)}</td><td>${cinemaCell(y)}</td><td>${cell(y.hasShows, y.shows)}</td></tr>`
    ).join('\n');
    const total = key => stats.perYear.reduce((sum, y) => sum + y[key].length, 0);
    const allCinema = stats.allFilms.filter(f => f.inCinema).length;
    const table = `<table class="stats-table">
<thead><tr><th scope="col">year</th><th scope="col">books</th><th scope="col">films</th><th scope="col">in a cinema</th><th scope="col">shows</th></tr></thead>
<tbody>
${rows}
</tbody>
<tfoot><tr><th scope="row">all time</th><td>${total('books')}</td><td>${total('films')}</td><td>${allCinema}</td><td>${total('shows')}</td></tr></tfoot>
</table>`;

    // By month, newest year with dated entries
    let months = '';
    const my = stats.monthYear;
    if (my) {
        const last = Math.max(...[...my.films, ...my.shows].map(e => e.month || 0));
        const byMonth = list => MONTHS.slice(0, last).map((name, i) => [name, list.filter(e => e.month === i + 1).length]);
        const monthBars = (list, unit) => {
            const rows = byMonth(list); // calendar order, not sorted
            const max = Math.max(1, ...rows.map(([, c]) => c));
            return `<div class="bars bars-months">${rows.map(([label, count]) =>
                `\n  <div class="bar-row" title="${label} ${my.year}: ${count} ${plural(unit, count)}"><span class="bar-label">${label}</span>`
                + `<span class="bar-track"><span class="bar-fill" style="width:${(count / max * 100).toFixed(1)}%"></span></span>`
                + `<span class="bar-value">${count}</span></div>`).join('')}\n</div>`;
        };
        const parts = [];
        if (my.hasFilms) parts.push(`<div><h3 class="stats-subtitle">films</h3>${monthBars(my.films, 'film')}</div>`);
        if (my.hasShows) parts.push(`<div><h3 class="stats-subtitle">shows</h3>${monthBars(my.shows, 'show')}</div>`);
        months = block(`${my.year} by month`, `<div class="stats-pair">${parts.join('\n')}</div>`);
    }

    // Repeat viewings
    const repeatYears = [...stats.perYear].reverse()
        .map(y => [y.year, y.films.filter(f => f.repeat).length])
        .filter(([, count]) => count > 0);
    const repeatTotal = repeatYears.reduce((sum, [, c]) => sum + c, 0);
    const repeats = `<p class="stats-lead">${repeatTotal} ${plural('film', repeatTotal)} watched again</p>`
        + `<p class="stats-inline">${repeatYears.map(([y, c]) => `<a href="${y}.html#films">${y}</a> ${c}`).join(' · ')}</p>`;

    const shownOnFilm = stats.allFilms.filter(f => ['70mm', '35mm', '16mm'].includes(f.format)).length;

    return `<header><p class="year-label">stats</p></header>
${block('totals by year', table, '"in a cinema" counts films with a cinema named, shown on dcp or film, or marked as a screening; — means no format or location was recorded that year.')}
${months}
${block('films by format', bars(stats.formats, { unit: 'film' }), `format recorded for ${stats.formatRecorded} of ${stats.allFilms.length} films. ${shownOnFilm} seen on actual film (16/35/70mm).`)}
${block('cinemas', bars(stats.cinemas, { unit: 'film' }))}
${block('streaming', bars(stats.services, { limit: 8, unit: 'film' }))}
${block('show venues', bars(stats.showVenues, { unit: 'show' }))}
${block('most-watched directors', bars(stats.directors, { unit: 'film' }), 'counts every viewing, including repeats.')}
${block('repeat viewings', repeats)}`.replace(/\n{3,}/g, '\n\n');
}

module.exports = { collectStats, renderStats };

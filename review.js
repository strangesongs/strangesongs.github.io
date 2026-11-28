// Year in review: one page per year with dated films or shows
// (review-YYYY.html), computed from content/ at build time like the stats
// page. The current year is labelled "so far" and fills in as entries are
// added. Matching (cinemas, formats, directors) reuses stats.js; titles are
// read again from the markdown so they keep their capitals for display.

const fs = require('fs');
const path = require('path');
const { readEntries, analyzeFilm, tally, NOT_A_VENUE, CINEMAS } = require('./stats');

// Same place, spelled differently ("2220 arts and archives"): use the cinema name.
const placeName = text => { const hit = CINEMAS.find(([re]) => re.test(text)); return hit ? hit[1] : text; };

const MONTH_WORDS = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
const LINE = /^(?:(\d{2})\.(\d{2})|\d+\.|-)\s+(.+)$/;

// The display text of each entry, in the same order readEntries returns them.
function readTitles(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).flatMap(line => {
        const m = line.match(LINE);
        if (!m) return [];
        return [m[3].replace(/\s*\*$/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').split('|')[0].trim()];
    });
}

function readYear(contentDir, year) {
    const dir = path.join(contentDir, year);
    const load = (name, map = e => e) => {
        const file = path.join(dir, `${name}.md`);
        const titles = readTitles(file);
        return readEntries(file).map((entry, i) => ({ ...map(entry), title: titles[i] || entry.main, year }));
    };
    return {
        year,
        books: load('books'),
        films: load('films', analyzeFilm),
        shows: load('shows').map(s => ({ ...s, venue: s.extra[0] && !NOT_A_VENUE.test(s.extra[0]) ? placeName(s.extra[0]) : null }))
    };
}

function reviewYears(contentDir, years) {
    return years.filter(year => {
        const y = readYear(contentDir, year);
        return [...y.films, ...y.shows].some(e => e.month && e.day);
    });
}

const dayKey = e => `${String(e.month).padStart(2, '0')}.${String(e.day).padStart(2, '0')}`;

function collectReview(contentDir, years, year) {
    const all = years.map(y => readYear(contentDir, y));
    const cur = all.find(y => y.year === year);
    const earlier = all.filter(y => y.year < year);
    const prev = [...earlier].reverse().find(y => y.films.length || y.shows.length || y.books.length);
    const dated = [...cur.films, ...cur.shows].filter(e => e.month && e.day);

    // Busiest day, and the longest run of consecutive days with something logged.
    const perDay = tally(dated.map(dayKey));
    const days = [...new Set(dated.map(e => new Date(Number(year), e.month - 1, e.day).getTime()))].sort((a, b) => a - b);
    let best = { length: 0 }, run = { length: 0 };
    days.forEach((t, i) => {
        run = i && t - days[i - 1] <= 90000000 ? { start: run.start, end: t, length: run.length + 1 } : { start: t, end: t, length: 1 };
        if (run.length > best.length) best = run;
    });

    // Places seen for the first time this year.
    const seenBefore = new Set(earlier.flatMap(y => [...y.films.map(f => f.cinema), ...y.shows.map(s => s.venue)]).filter(Boolean));
    const firstVisits = [...new Set([...cur.films.map(f => f.cinema), ...cur.shows.map(s => s.venue)].filter(Boolean))]
        .filter(place => !seenBefore.has(place));

    // Books: authors read more than once, and when the books were written.
    const bookMeta = cur.books.map(b => {
        const m = b.main.match(/\((\d{4})\)\s*(.+)$/);
        return m ? { published: Number(m[1]), author: m[2].replace(/^edited by\s+/, '').trim() } : {};
    });
    const decades = tally(bookMeta.filter(b => b.published).map(b => `${Math.floor(b.published / 10) * 10}s`))
        .sort((a, b) => a[0].localeCompare(b[0]));

    const lastDated = dated.reduce((a, e) => (!a || e.month * 40 + e.day > a.month * 40 + a.day ? e : a), null);

    return {
        year,
        cur,
        prev,
        inProgress: Number(year) === new Date().getFullYear(),
        lastDated,
        perMonth: MONTH_WORDS.map((name, i) => [name.slice(0, 3),
            cur.films.filter(f => f.month === i + 1).length, cur.shows.filter(s => s.month === i + 1).length]),
        busiestDay: perDay[0] && perDay[0][1] > 1 ? perDay[0] : null,
        streak: best.length > 1 ? best : null,
        inCinema: cur.films.filter(f => f.inCinema).length,
        onFilm: cur.films.filter(f => ['70mm', '35mm', '16mm'].includes(f.format)).length,
        streamed: cur.films.filter(f => f.format === 'streaming').length,
        formats: tally(cur.films.map(f => f.format)),
        cinemas: tally(cur.films.map(f => f.cinema)),
        services: tally(cur.films.map(f => f.service)),
        venues: tally(cur.shows.map(s => s.venue)),
        directors: tally(cur.films.map(f => f.director)).filter(([, n]) => n > 1),
        repeats: cur.films.filter(f => f.repeat),
        firstVisits,
        authors: tally(bookMeta.map(b => b.author)).filter(([, n]) => n > 1),
        decades,
        oldestBook: cur.books[bookMeta.reduce((best, b, i) => (b.published && (best < 0 || b.published < bookMeta[best].published) ? i : best), -1)],
        firsts: { film: cur.films[0], show: cur.shows[0], book: cur.books[0] },
        lasts: { film: cur.films[cur.films.length - 1], show: cur.shows[cur.shows.length - 1], book: cur.books[cur.books.length - 1] }
    };
}

function renderReview(r, { escapeHtml, plural, markTitle }) {
    const { cur } = r;
    const title = e => markTitle(escapeHtml(e.title));
    const when = e => (e.month && e.day ? `${MONTH_WORDS[e.month - 1]} ${e.day}` : '');
    // The date column holds MM.DD, as on the year pages; books show a dash.
    const short = e => (e.month && e.day ? `${String(e.month).padStart(2, '0')}.${String(e.day).padStart(2, '0')}` : '—');
    const block = (heading, body, note = '') =>
        `<section class="stats-block">\n<h2 class="section-title">${heading}</h2>\n${body}${note ? `\n<p class="stats-note">${note}</p>` : ''}\n</section>\n`;
    const bars = (rows, unit, limit = 8) => {
        const shown = rows.slice(0, limit);
        const max = Math.max(1, ...shown.map(([, c]) => c));
        return `<div class="bars">${shown.map(([label, count]) =>
            `\n  <div class="bar-row" title="${escapeHtml(`${label}: ${count} ${plural(unit, count)}`)}"><span class="bar-label">${escapeHtml(label)}</span>`
            + `<span class="bar-track"><span class="bar-fill" style="width:${(count / max * 100).toFixed(1)}%"></span></span>`
            + `<span class="bar-value">${count}</span></div>`).join('')}\n</div>`;
    };
    const list = items => `<ul class="markdown-list dated-list">${items.join('')}\n</ul>`;
    const item = (label, body, where = '') => `\n  <li class="dated"><span class="entry-date">${escapeHtml(label)}</span>`
        + `<span class="entry-body">${body}${where ? `<span class="entry-where">${escapeHtml(where)}</span>` : ''}</span></li>`;
    const link = (e, section) => `<a href="${r.year}.html#${section}">${title(e)}</a>`;
    const count = (n, noun) => `${n} ${plural(noun, n)}`;

    // Lead: the year in one line, and how it compares with the one before.
    const parts = [];
    if (cur.books.length) parts.push(`<a href="${r.year}.html#books">${count(cur.books.length, 'book')}</a>`);
    if (cur.films.length) parts.push(`<a href="${r.year}.html#films">${count(cur.films.length, 'film')}</a>`);
    if (cur.shows.length) parts.push(`<a href="${r.year}.html#shows">${count(cur.shows.length, 'show')}</a>`);
    const delta = (key, noun) => {
        if (!r.prev || !r.prev[key].length || !cur[key].length) return null;
        const d = cur[key].length - r.prev[key].length;
        return d === 0 ? `as many ${noun}s` : `${Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} ${plural(noun, Math.abs(d))}`;
    };
    const deltas = [delta('books', 'book'), delta('films', 'film'), delta('shows', 'show')].filter(Boolean);
    const soFar = r.inProgress && r.lastDated ? ` so far, through ${when(r.lastDated)}` : '';
    let html = `<header><p class="year-label">${r.year} in review</p></header>\n`;
    html += `<section class="stats-block">\n<p class="stats-lead">${parts.join(', ')}${soFar}.</p>`;
    if (deltas.length) html += `\n<p class="stats-inline">${deltas.join(' · ')} than ${r.inProgress ? 'all of ' : ''}<a href="review-${r.prev.year}.html">${r.prev.year}</a>.</p>`;
    html += '\n</section>\n';

    // Month by month, films and shows side by side.
    const last = r.inProgress && r.lastDated ? r.lastDated.month : 12;
    const months = r.perMonth.slice(0, last);
    const monthBars = (index, unit) => bars(months.map(m => [m[0], m[index]]), unit, 12).replace('class="bars"', 'class="bars bars-months"');
    const pair = [];
    if (cur.films.some(f => f.month)) pair.push(`<div><h3 class="stats-subtitle">films</h3>${monthBars(1, 'film')}</div>`);
    if (cur.shows.some(s => s.month)) pair.push(`<div><h3 class="stats-subtitle">shows</h3>${monthBars(2, 'show')}</div>`);
    const busiest = (index, noun) => {
        const top = [...months].sort((a, b) => b[index] - a[index])[0];
        return top && top[index] ? `busiest month for ${noun}s: ${MONTH_WORDS[MONTH_WORDS.findIndex(m => m.startsWith(top[0]))]} (${top[index]})` : '';
    };
    const notes = [busiest(1, 'film'), cur.shows.length ? busiest(2, 'show') : ''];
    if (r.busiestDay) {
        const [m, d] = r.busiestDay[0].split('.').map(Number);
        notes.push(`busiest day: ${MONTH_WORDS[m - 1]} ${d} (${r.busiestDay[1]} entries)`);
    }
    if (r.streak) {
        const fmt = t => { const d = new Date(t); return `${MONTH_WORDS[d.getMonth()]} ${d.getDate()}`; };
        notes.push(`longest run: ${r.streak.length} days in a row, ${fmt(r.streak.start)} to ${fmt(r.streak.end)}`);
    }
    if (pair.length) html += block('month by month', `<div class="stats-pair">${pair.join('\n')}</div>`, notes.filter(Boolean).join('. ') + '.');

    // Firsts and lasts.
    const bookends = [];
    [['film', 'films', 'first film'], ['show', 'shows', 'first show'], ['book', 'books', 'first book']].forEach(([key, section, label]) => {
        const e = r.firsts[key];
        if (e) bookends.push(item(short(e), link(e, section), label));
    });
    [['film', 'films', r.inProgress ? 'latest film' : 'last film'], ['show', 'shows', r.inProgress ? 'latest show' : 'last show']].forEach(([key, section, label]) => {
        const e = r.lasts[key];
        if (e && e !== r.firsts[key]) bookends.push(item(short(e), link(e, section), label));
    });
    if (bookends.length) html += block('firsts and lasts', list(bookends));

    // Films: where and how.
    if (cur.films.length) {
        const recorded = cur.films.filter(f => f.recorded).length;
        if (recorded) {
            const split = [`${r.inCinema} in a cinema`, `${r.streamed} streamed`, `${cur.films.length - r.inCinema - r.streamed} elsewhere`]
                .filter(s => !s.startsWith('0 elsewhere'));
            html += block('how the films were seen',
                `<p class="stats-lead">${split.join(', ')}.</p>${r.formats.length ? bars(r.formats, 'film') : ''}`,
                r.onFilm ? `${count(r.onFilm, 'film')} projected on actual film (16/35/70mm).` : '');
        }
        if (r.cinemas.length) html += block('cinemas', bars(r.cinemas, 'film'));
        if (r.services.length) html += block('streaming', bars(r.services, 'film', 6));
        if (r.directors.length) html += block('directors, more than once', bars(r.directors, 'film', 10));
        if (r.repeats.length) html += block('watched again', list(r.repeats.map(f => item(short(f), link(f, 'films')))));
    }

    if (r.venues.length) html += block('show venues', bars(r.venues, 'show'));
    if (r.firstVisits.length) {
        html += block('first time at', `<p class="stats-inline">${r.firstVisits.map(escapeHtml).join(' · ')}</p>`,
            'cinemas and venues that appear in the log for the first time this year.');
    }

    // Books.
    if (cur.books.length) {
        let body = '';
        if (r.decades.length) body += `<h3 class="stats-subtitle">when they were written</h3>${bars(r.decades, 'book', 20)}`;
        if (r.authors.length) body += `<h3 class="stats-subtitle">authors, more than once</h3>${bars(r.authors, 'book', 10)}`;
        const note = r.oldestBook ? `oldest: ${title(r.oldestBook)}.` : '';
        if (body) html += block('books', body, note);
    }

    return html.replace(/\n{3,}/g, '\n\n');
}

module.exports = { reviewYears, collectReview, renderReview };

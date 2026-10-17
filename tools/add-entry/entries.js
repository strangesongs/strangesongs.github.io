// Formatting and insertion rules for new log entries. Shared by the add-entry
// server and its tests; mirrors the content format documented in CLAUDE.md.

const fs = require('fs');
const path = require('path');

const KINDS = {
    book: { file: 'books.md', title: 'read', header: 'TITLE (year) author | notes' },
    film: { file: 'films.md', title: 'watch', header: 'date TITLE (year) director | format | location | notes\n* denotes repeat viewing' },
    show: { file: 'shows.md', title: 'listen', header: 'date PERFORMER | VENUE | NOTES' }
};

const FORMATS = ['dcp', '35mm', '16mm', '70mm', '4k restoration', 'digital', 'streaming', 'blu-ray', 'dvd'];

class EntryError extends Error {}

// One field: trimmed, single-spaced, no characters that would break the line format.
function field(value, name, { required = false } = {}) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (required && !text) throw new EntryError(`${name} is required.`);
    if (text.includes('|')) throw new EntryError(`${name} can't contain "|" (it separates the fields).`);
    return text;
}

// Lowercase everything except the URL part of markdown links (URLs are case-sensitive).
function lowerKeepLinks(text) {
    return text.split(/(\]\([^)]*\))/).map((part, i) => (i % 2 ? part : part.toLowerCase())).join('');
}

// Performer/title fields are uppercase; "w/" (guests) stays lowercase with spaces.
function upper(text) {
    return text.toUpperCase().replace(/\s*\bW\/\s*/g, ' w/ ').trim();
}

function parseDate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new EntryError('Pick a date.');
    return { year: m[1], month: m[2], day: m[3] };
}

// Build the markdown line (without a list number for books) and work out which year it goes in.
function formatEntry(input) {
    const kind = input.kind;
    if (!KINDS[kind]) throw new EntryError('Choose book, film or show.');
    const notes = lowerKeepLinks(field(input.notes, 'Notes'));

    if (kind === 'book') {
        const title = upper(field(input.title, 'Title', { required: true }));
        const year = field(input.year, 'Year published');
        if (year && !/^\d{4}$/.test(year)) throw new EntryError('Year published should be four digits.');
        const author = field(input.author, 'Author', { required: true }).toLowerCase();
        const listYear = field(input.listYear, 'List year', { required: true });
        if (!/^\d{4}$/.test(listYear)) throw new EntryError('List year should be four digits.');
        const line = `${title}${year ? ` (${year})` : ''} ${author}${notes ? ` | ${notes}` : ''}`;
        return { kind, listYear, line };
    }

    const date = parseDate(input.date);
    const prefix = `${date.month}.${date.day}`;

    if (kind === 'film') {
        const title = upper(field(input.title, 'Title', { required: true }));
        const year = field(input.year, 'Year', { required: true });
        if (!/^\d{4}$/.test(year)) throw new EntryError('Year should be four digits.');
        const director = field(input.director, 'Director', { required: true }).toLowerCase();
        const format = field(input.format, 'Format', { required: true }).toLowerCase();
        const location = field(input.location, 'Where', { required: true }).toLowerCase();
        const repeat = input.repeat ? ' *' : '';
        const line = `${prefix} ${title} (${year}) ${director} | ${format} | ${location}${notes ? ` | ${notes}` : ''}${repeat}`;
        return { kind, listYear: date.year, line };
    }

    const performers = upper(field(input.performers, 'Performers', { required: true }));
    const venue = field(input.venue, 'Venue', { required: true }).toLowerCase();
    const line = `${prefix} ${performers} | ${venue}${notes ? ` | ${notes}` : ''}`;
    return { kind, listYear: date.year, line };
}

function newFileText(kind, year) {
    const k = KINDS[kind];
    return `---\ntitle: ${k.title}\ndate: ${year}\n---\n\n${k.header}\n\n`;
}

const DATED = /^(\d{2})\.(\d{2})\s/;
const NUMBERED = /^(\d+)\.\s/;

// Insert the entry into the file's text: dated entries in date order (with a
// blank line between months, like the existing files), books numbered at the end.
function insertEntry(text, entry) {
    const lines = text.replace(/\s+$/, '').split('\n');

    if (entry.kind === 'book') {
        let last = -1;
        let number = 0;
        lines.forEach((line, i) => {
            const m = line.match(NUMBERED);
            if (m) { last = i; number = Math.max(number, Number(m[1])); }
        });
        const line = `${number + 1}. ${entry.line}`;
        if (last === -1) lines.push('', line);
        else lines.splice(last + 1, 0, line);
        return { text: lines.join('\n') + '\n', line };
    }

    const key = entry.line.slice(0, 5);
    const monthOf = line => line.slice(0, 2);
    const gap = (a, b) => (monthOf(a) !== monthOf(b) ? [''] : []);
    const entryIdx = lines.map((line, i) => (DATED.test(line) ? i : -1)).filter(i => i !== -1);
    const prevIdx = [...entryIdx].reverse().find(i => lines[i].slice(0, 5) <= key);
    const nextIdx = entryIdx.find(i => lines[i].slice(0, 5) > key);
    const hasPrev = prevIdx !== undefined;
    const hasNext = nextIdx !== undefined;

    if (hasPrev && hasNext && lines.slice(prevIdx + 1, nextIdx).every(line => line.trim() === '')) {
        // Normal case: replace the gap between the two neighbours.
        const block = [...gap(lines[prevIdx], entry.line), entry.line, ...gap(entry.line, lines[nextIdx])];
        lines.splice(prevIdx + 1, nextIdx - prevIdx - 1, ...block);
    } else if (hasPrev) {
        lines.splice(prevIdx + 1, 0, ...gap(lines[prevIdx], entry.line), entry.line);
    } else if (hasNext) {
        lines.splice(nextIdx, 0, entry.line, ...gap(entry.line, lines[nextIdx]));
    } else {
        lines.push('', entry.line);
    }
    return { text: lines.join('\n') + '\n', line: entry.line };
}

// Suggestions for the form: formats, and the places used most in recent years.
function suggestions(contentDir) {
    const years = fs.readdirSync(contentDir).filter(n => /^\d{4}$/.test(n)).sort().slice(-3);
    const count = (kind, fieldIndex) => {
        const tally = new Map();
        years.forEach(year => {
            const file = path.join(contentDir, year, KINDS[kind].file);
            if (!fs.existsSync(file)) return;
            fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
                if (!DATED.test(line)) return;
                const value = (line.replace(/\s*\*$/, '').split('|')[fieldIndex] || '').trim();
                if (value && !value.includes('](')) tally.set(value, (tally.get(value) || 0) + 1);
            });
        });
        return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v).slice(0, 60);
    };
    return { formats: FORMATS, filmPlaces: count('film', 2), venues: count('show', 1) };
}

module.exports = { KINDS, EntryError, formatEntry, insertEntry, newFileText, suggestions };

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAW_DIR = path.join(__dirname, '..', 'raw files');
const CONTENT_DIR = path.join(__dirname, '..', 'content');

function rtfToText(filename) {
    return execSync(`textutil -convert txt -stdout "${path.join(RAW_DIR, filename)}"`, { encoding: 'utf8' });
}

function odtToText(filename) {
    return execSync(`textutil -convert txt -stdout "${path.join(RAW_DIR, filename)}"`, { encoding: 'utf8' });
}

function lc(s) {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseViewingListRtf(text) {
    const lines = text.split('\n').filter(l => /^\d+\./.test(l.trim()));
    return lines.map(line => {
        const repeat = line.includes('*');
        let body = line.replace(/^\d+\.\s*/, '').replace(/\*$/, '').trim();
        // Normalize dashes
        body = body.replace(/[–—]/g, '--');
        const parts = body.split(/\s*--\s*/).map(p => p.trim());
        const title = parts[0];
        const director = parts[1] || '';
        let year = '';
        let format = '';
        if (/^\d{4}$/.test(parts[2])) {
            year = parts[2];
            // title — director — year — country — format
            format = parts.length >= 5 ? parts.slice(4).join(', ') : (parts[3] || '');
        } else {
            const ym = body.match(/\b(19|20)\d{2}\b/g);
            if (ym) year = title.includes('MODERN TIMES') ? '1936' : ym[0];
        }
        format = format.replace(/,/g, ' |').toLowerCase();
        let entry = `${title} (${year}) ${lc(director)}`;
        if (format) entry += ` | ${lc(format)}`;
        if (repeat) entry += ' *';
        return entry;
    });
}

function parse2010Films(text) {
    const filmSection = text.split(/Books:/i)[0];
    const lines = filmSection.split('\n').filter(l => /^\d+\./.test(l.trim()));
    return lines.map(line => {
        const repeat = line.includes('*');
        let body = line.replace(/^\d+\.\s*/, '').trim();
        body = body.replace(/\s+\d+\/10\*?\s*$/, '').replace(/\s+\d+\/10\s*$/, '');
        // Title (year, Country, directed by Director)
        const m = body.match(/^(.+?)\s*\((\d{4}),\s*[^,]+,\s*directed by\s+(.+?)\)\*?$/i)
            || body.match(/^(.+?)\s*\((\d{4}),\s*[^,]+,\s*directed by\s+(.+?)\)$/i);
        if (!m) {
            // Painters Painting / Man With a Movie Camera style
            const m2 = body.match(/^(.+?)\s*\(([^)]*),\s*directed by\s+(.+?)\)$/i);
            if (m2) {
                const yearMap = { 'painters painting': '1973', 'man with a movie camera': '1929' };
                const yr = yearMap[m2[1].trim().toLowerCase()] || '';
                return `${m2[1].toUpperCase()} (${yr}) ${lc(m2[3])}${repeat ? ' *' : ''}`;
            }
            return body;
        }
        let entry = `${m[1].toUpperCase()} (${m[2]}) ${lc(m[3])}`;
        if (repeat) entry += ' *';
        return entry;
    });
}

function parse2010Books(text) {
    const bookSection = text.split(/Books:/i)[1];
    if (!bookSection) return [];
    const lines = bookSection.split('\n').filter(l => /^\d+\./.test(l.trim()));
    const yearMap = {
        'the coming insurrection': '2007',
        'the subversive copy editor': '2004',
        "don't get too comfortable": '2005',
        'making of a chef: mastering heat at the culinary institute of america': '1997',
        'the soul of a chef': '2000',
        'the elements of cooking': '2007',
        'lying': '2000'
    };
    return lines.map(line => {
        const body = line.replace(/^\d+\.\s*/, '').trim();
        const m = body.match(/^(.+?)\s+by\s+(.+)$/i);
        if (!m) return body;
        const titleKey = m[1].toLowerCase();
        const year = yearMap[titleKey] || '';
        return `${m[1].toUpperCase()} (${year}) ${lc(m[2])}`;
    });
}

function parseDate(raw, defaultYear = '2014') {
    if (!raw) return null;
    raw = raw.trim().replace(/[()]/g, '');
    // M/D/YYYY or M/D/YY or M/D
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return null;
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    return `${mm}.${dd}`;
}

function parse2014Line(line) {
    line = line.trim();
    if (!line) return null;
    const repeat = line.includes('*');
    line = line.replace(/\*+$/, '').replace(/\* /g, ' ').trim();

    // Extract date from end or parens
    let date = null;
    const parenDate = line.match(/\((\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\)\s*$/);
    if (parenDate) {
        date = parseDate(parenDate[1]);
        line = line.replace(/\(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\)\s*$/, '').trim();
    }
    const endDate = line.match(/\s(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*$/);
    if (endDate) {
        date = parseDate(endDate[1]);
        line = line.replace(/\s\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/, '').trim();
    }
    const dashEndDate = line.match(/[–—-]\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*$/);
    if (dashEndDate) {
        date = parseDate(dashEndDate[1]);
        line = line.replace(/[–—-]\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/, '').trim();
    }

    let notes = '';
    if (/all year/i.test(line)) {
        notes = 'all year';
        line = line.replace(/\s*all year\s*$/i, '').trim();
    }

    // Parse (d. Director, year, country)
    const m = line.match(/^(.+?)\s*\(\s*d\.\s*(.+?),\s*(\d{4}),\s*(.+?)\s*\)\s*$/i)
        || line.match(/^(.+?)\s*--\s*d\.\s*(.+?),\s*(\d{4}),\s*(.+?)\s*$/i)
        || line.match(/^(.+?)\s*[–—]\s*d\.\s*(.+?),\s*(\d{4}),\s*(.+?)\s*$/i);
    if (!m) return null;

    const title = m[1].trim().toUpperCase();
    const director = lc(m[2].replace(/^d\.\s*/i, ''));
    const year = m[3];
    let entry;
    if (date) {
        entry = `${date} ${title} (${year}) ${director}`;
    } else {
        entry = `${title} (${year}) ${director}`;
    }
    if (notes) entry += ` | | | ${notes}`;
    if (repeat) entry += ' *';
    return { dated: !!date, entry };
}

function parse2014Films(text) {
    const dated = [];
    const numbered = [];
    let num = 1;
    text.split('\n').forEach(line => {
        const parsed = parse2014Line(line);
        if (!parsed) return;
        if (parsed.dated) {
            dated.push(parsed.entry);
        } else {
            numbered.push(`${num}. ${parsed.entry}`);
            num++;
        }
    });
    return { dated, numbered };
}

function parse2019(text) {
    const books = [];
    const datedFilms = [];
    const numberedFilms = [];
    let section = 'books';
    let filmNum = 1;

    const bookYears = {
        'the new jim crow': '2010',
        'trans*': '2018',
        'horror in architecture': '2013',
        'shock value': '1981',
        "giovanni's room": '1956',
        "giovanni's room": '1956',
        "hell's angels": '1966',
        "hell's angels": '1966',
        'the scum manifesto': '1968',
        'safe spaces': '2013',
        'the warmth of other suns': '2010'
    };

    text.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.toLowerCase() === 'completed books') return;
        if (/^FILM LIST/i.test(line)) { section = 'films'; return; }

        if (section === 'books') {
            const m = line.match(/^(.+?)\s+by\s+(.+)$/i);
            if (!m) return;
            const titleKey = m[1].replace(/["'""'']/g, '').trim().toLowerCase();
            const year = bookYears[titleKey] || bookYears[titleKey.replace(/'/g, "'")] || '';
            books.push(`${m[1].replace(/"/g, '').trim().toUpperCase()} (${year}) ${lc(m[2])}`);
        } else {
            const dateMatch = line.match(/\((\d{1,2}\.\d{2}\.\d{2})\)\s*$/);
            let date = null;
            if (dateMatch) {
                const [mm, dd] = dateMatch[1].split('.');
                date = `${mm.padStart(2, '0')}.${dd.padStart(2, '0')}`;
                line = line.replace(/\(\d{1,2}\.\d{2}\.\d{2}\)\s*$/, '').trim();
            }
            const m = line.match(/["""]?(.+?)["""]?\s+d\.\s+(.+?)\s+(\d{4})/i);
            if (!m) return;
            const title = m[1].replace(/["'""'']/g, '').trim().toUpperCase();
            const directorMap = { cassavettes: 'john cassavetes' };
            let director = lc(m[2].replace(/,\s*$/, ''));
            director = directorMap[director] || director;
            const year = m[3];
            const entry = date
                ? `${date} ${title} (${year}) ${director}`
                : `${title} (${year}) ${director}`;
            if (date) datedFilms.push(entry);
            else { numberedFilms.push(`${filmNum}. ${entry}`); filmNum++; }
        }
    });

    return { books, datedFilms, numberedFilms };
}

function writeFilms(year, dated, numbered, intro = '') {
    const dir = path.join(CONTENT_DIR, year);
    fs.mkdirSync(dir, { recursive: true });
    const total = dated.length + numbered.length;
    let body = `---
title: watch
date: ${year}
---

date TITLE (year) director | format | location | notes
* denotes repeat viewing
total: ${total} films

`;
    if (intro) body += intro + '\n\n';
    body += dated.join('\n');
    if (dated.length && numbered.length) body += '\n\n';
    body += numbered.join('\n');
    body += '\n';
    fs.writeFileSync(path.join(dir, 'films.md'), body);
    console.log(`Wrote content/${year}/films.md (${total} films)`);
}

function writeBooks(year, entries) {
    const dir = path.join(CONTENT_DIR, year);
    fs.mkdirSync(dir, { recursive: true });
    const numbered = entries.map((e, i) => `${i + 1}. ${e}`);
    let body = `---
title: read
date: ${year}
---

TITLE (year) author | notes

total: ${entries.length} books

`;
    body += numbered.join('\n') + '\n';
    fs.writeFileSync(path.join(dir, 'books.md'), body);
    console.log(`Wrote content/${year}/books.md (${entries.length} books)`);
}

// --- 2010 ---
const raw2010 = rtfToText('read watch list 2010.rtf');
writeBooks('2010', parse2010Books(raw2010));
const films2010 = parse2010Films(raw2010);
writeFilms('2010', [], films2010.map((e, i) => `${i + 1}. ${e}`));

// --- 2013 (viewing list.rtf — no year in filename; inferred from latest theatre entries) ---
const rawViewing = rtfToText('viewing list.rtf');
const films2013 = parseViewingListRtf(rawViewing);
writeFilms('2013', [], films2013.map((e, i) => `${i + 1}. ${e}`));

// --- 2014 ---
const raw2014 = odtToText('2014 viewing list.odt');
const { dated: dated2014, numbered: numbered2014 } = parse2014Films(raw2014);
writeFilms('2014', dated2014, numbered2014);

// --- 2019 ---
const raw2019 = odtToText('completed books 2019.odt');
const { books: books2019, datedFilms: dated2019, numberedFilms: numbered2019 } = parse2019(raw2019);
writeBooks('2019', books2019);
writeFilms('2019', dated2019, numbered2019);

console.log('Done.');

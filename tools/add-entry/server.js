#!/usr/bin/env node
// cleve add: a small local form for adding a book, film or show to the log.
//
//   node tools/add-entry/server.js --open     (or: npm run add, or the "cleve add" app)
//
// Serves a form on http://127.0.0.1:4719 (this computer only). On submit it
// pulls, writes the entry into content/YYYY/<kind>.md in the right format and
// place, commits just that file, and pushes. GitHub Actions then rebuilds the
// site. Shuts itself down after 30 minutes idle, or from the "done" button.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { KINDS, EntryError, formatEntry, insertEntry, newFileText, suggestions } = require('./entries');

const REPO = path.resolve(__dirname, '..', '..');
const CONTENT = path.join(REPO, 'content');
const PORT = Number(process.env.CLEVE_ADD_PORT || 4719);
const URL = `http://127.0.0.1:${PORT}/`;
const TOKEN = crypto.randomBytes(16).toString('hex');
const IDLE_MS = 30 * 60 * 1000;
const DRY_RUN = process.argv.includes('--dry-run'); // write the file, skip git (for testing)

function git(args) {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd: REPO, timeout: 60000 }, (error, stdout, stderr) => {
            if (error) reject(new Error((stderr || stdout || error.message).trim()));
            else resolve(stdout.trim());
        });
    });
}

let busy = false;

async function addEntry(input) {
    const entry = formatEntry(input);
    const rel = path.join('content', entry.listYear, KINDS[entry.kind].file);
    const file = path.join(REPO, rel);

    if (!DRY_RUN) {
        if (await git(['status', '--porcelain', '--', rel])) {
            throw new EntryError(`${rel} has changes that aren't committed yet. Commit or discard them first, so they don't get pushed by accident.`);
        }
        await git(['pull', '--ff-only', '--quiet']);
    }

    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : newFileText(entry.kind, entry.listYear);
    const bareLine = entry.line.replace(/^\d{2}\.\d{2} /, '');
    if (before.split('\n').some(line => line.replace(/^(\d{2}\.\d{2}|\d+\.) /, '') === bareLine)) {
        throw new EntryError('That exact entry is already in the list.');
    }

    const { text, line } = insertEntry(before, entry);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);

    if (DRY_RUN) return { line, file: rel, pushed: false, note: 'dry run: file written, git skipped' };

    const label = (input.title || input.performers || '').toLowerCase().trim();
    await git(['add', '--', rel]);
    await git(['commit', '--quiet', '-m', `add ${entry.kind}: ${label}`, '--', rel]);
    try {
        await git(['push', '--quiet']);
    } catch (error) {
        return { line, file: rel, pushed: false, note: `Saved and committed, but the push failed: ${error.message}` };
    }
    return { line, file: rel, pushed: true };
}

function page() {
    const s = suggestions(CONTENT);
    const options = list => list.map(v => `<option value="${v.replace(/"/g, '&quot;')}">`).join('');
    const year = new Date().getFullYear();
    return fs.readFileSync(path.join(__dirname, 'form.html'), 'utf8')
        .replace('{{TOKEN}}', TOKEN)
        .replace('{{YEAR}}', String(year))
        .replace('{{FORMATS}}', options(s.formats))
        .replace('{{FILM_PLACES}}', options(s.filmPlaces))
        .replace('{{VENUES}}', options(s.venues));
}

function send(res, status, body, type = 'application/json') {
    res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
            if (data.length > 20000) req.destroy();
        });
        req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(new EntryError('Bad request.')); }
        });
    });
}

let idleTimer;
function touch() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => process.exit(0), IDLE_MS);
}

const server = http.createServer(async (req, res) => {
    touch();
    // Only answer this computer, and only pages this server served (blocks other sites posting here).
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '')) return send(res, 403, { error: 'forbidden' });

    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) return send(res, 200, page(), 'text/html');
    if (req.method !== 'POST') return send(res, 404, { error: 'not found' });
    if (req.headers['x-cleve-token'] !== TOKEN) return send(res, 403, { error: 'This form is out of date. Reload the page.' });

    try {
        const input = await readJson(req);
        if (req.url === '/preview') {
            try { return send(res, 200, { line: formatEntry(input).line }); } catch (e) { return send(res, 200, { line: '' }); }
        }
        if (req.url === '/quit') {
            send(res, 200, { ok: true });
            return setTimeout(() => process.exit(0), 100);
        }
        if (req.url === '/add') {
            if (busy) return send(res, 409, { error: 'Still saving the last one.' });
            busy = true;
            try {
                return send(res, 200, await addEntry(input));
            } finally {
                busy = false;
            }
        }
        return send(res, 404, { error: 'not found' });
    } catch (error) {
        const message = error instanceof EntryError ? error.message : `Something went wrong: ${error.message}`;
        return send(res, 400, { error: message });
    }
});

function openForm() {
    if (process.argv.includes('--open') && process.platform === 'darwin') execFile('open', [URL]);
    else console.log(`cleve add: ${URL}`);
}

server.on('error', error => {
    if (error.code === 'EADDRINUSE') { openForm(); process.exit(0); } // already running: just show it
    throw error;
});

server.listen(PORT, '127.0.0.1', () => {
    touch();
    openForm();
});

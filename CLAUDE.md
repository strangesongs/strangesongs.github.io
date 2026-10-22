# strangesongs.github.io

Personal site ("cleve") with a running log of books read, films watched, and live shows attended, plus links to music and other projects. Static site built from markdown by a small Node script and deployed to GitHub Pages by GitHub Actions.

## Commands

```bash
npm install            # install dependencies (ejs, nodemon)
npm run build          # generate the site into dist/
npm run watch          # rebuild on content/template/build/style/script changes
npm run serve          # preview dist/ at http://localhost:8090
npm run add            # open the add-entry form (same as the "cleve add" app)
```

## How it builds and deploys

- `build.js` reads `content/` and `templates/index.html`, and writes **everything** the site serves into `dist/`: the HTML pages plus copies of `style.css`, `script.js`, `favicon.svg`, and the `fonts/` folder.
- `dist/` is gitignored. Never commit generated HTML, and never hand-edit files in `dist/`.
- `.github/workflows/build.yml` runs on every push to `main`: `npm ci`, `npm run build`, then uploads **only `dist/`** to Pages. Nothing else in the repo (mockups, raw files, node_modules, docs) is published. Keep it that way: never change the upload path back to `.`.
- Asset URLs get a `?v=<hash>` of the static files' contents, so the CSS/JS cache-busts automatically. Don't hand-edit version strings.
- The repo itself is public on GitHub. The original pre-markdown lists (`raw files/`), early design mockups (`mockups/`) and their one-off importer (`scripts/`) were removed; they survive only in old git history (e.g. `git show <old-commit>:"raw files/viewing list.rtf"`).

## Project structure

```
content/
  YYYY/
    books.md     → "read" section
    films.md     → "watch" section
    shows.md     → "listen" section
  abandoned.md   → abandoned books/films
  about.md       → about page
  writing.md     → writing page text (shown while it has no links)
  music.md, projects.md → optional intro above those pages' lists
templates/index.html   # the one EJS page layout (meta tags, sidebar, main)
build.js               # markdown → dist/ (pages, sidebar, home, stats, 404, sitemap)
stats.js               # stats page: parsing + rendering, used by build.js
style.css              # the one stylesheet
script.js              # year-page section switching, email links
favicon.svg
fonts/                 # Spectral woff files (Latin subset) + OFL.txt
tools/add-entry/       # "cleve add": local form for adding entries (see below)
```

## Adding a new year

Create `content/YYYY/` with any of `books.md`, `films.md`, `shows.md`, then run `npm run build`. Years are discovered automatically: nothing in `build.js` needs editing.

## What the build generates

- `YYYY.html` for each year folder. All sections are on one page; `script.js` shows one section at a time based on the URL hash (`#books`, `#films`, `#shows`). Without JavaScript, every section is shown.
- `index.html`: three short lists, **recently read**, **recently watched** and **recently heard**, each with the newest five entries of that log (films with their cinema/location, shows with their venue), linking to the year page. If the newest year has fewer than five, earlier years fill in. No changelog-style updates on the homepage.
- `stats.html` (see below).
- `404.html`: served by GitHub Pages for any missing path. It uses `<base href="/">` so its relative links work at any depth, and is marked `noindex`.
- `robots.txt` and `sitemap.xml` (every page), regenerated each build.
- `about.html`, `abandoned.html`, plus `rwl.html`, a redirect kept for old links.
- `music.html`, `projects.html`, `writing.html`: lists of outside links from `MUSIC_LINKS`, `PROJECT_LINKS` and `WRITING_LINKS` in `build.js`. Each entry is the name (no underline) with its note and domain in grey under it. `WRITING_LINKS` is empty for now, so that page shows `content/writing.md`.
- Each page gets a meta description, canonical URL, and Open Graph tags. Year pages describe their counts ("2026: 46 books read, 104 films watched, 40 shows seen.").

## Adding entries: "cleve add" (`tools/add-entry/`)

The owner adds entries with a small local form instead of editing markdown by hand:

- `cleve add.app` (double-click; built by `make-app.sh`, gitignored because it has this machine's repo path baked in) or `npm run add` starts `server.js`, which opens the form at `http://127.0.0.1:4719`.
- Pick book / film / show and fill in the fields. The form shows a live preview of the exact line. Datalists suggest formats, recent cinemas/streaming services, and recent venues.
- On submit, `server.js`: refuses if that content file has uncommitted changes, runs `git pull --ff-only`, inserts the line (dated entries in date order with a blank line between months; books numbered at the end; creates `content/YYYY/<kind>.md` for a new year), then commits **only that file** (`add film: paprika`) and pushes. CI rebuilds the site.
- All formatting rules live in `entries.js` (`formatEntry`, `insertEntry`) and match the content conventions in this file. If the conventions change, change both.
- It listens on 127.0.0.1 only and requires a per-session token on every POST, so other websites can't post to it. It exits after 30 minutes idle or from the form's "done" button.
- No dependencies beyond Node. `--dry-run` writes the file without touching git, for testing.

## Stats page (`stats.js`)

Linked under "read watch listen" next to abandoned. Built entirely from `content/` at build time:
totals by year (with films seen in a cinema), the newest year by month, films by format, top cinemas, streaming services, show venues, most-watched directors, and repeat viewings.

Older years record format/location inconsistently, so `stats.js` recognizes **formats, cinemas and streaming services by name in any field**, using the lookup tables at the top of the file (`FORMATS`, `CINEMAS`, `SERVICES`). When you start going to a new cinema or using a new streaming service, add it there, or it won't show up in those charts. Show venues are read straight from the second field, which is why that field must always be the venue.

The bars are plain HTML/CSS (no chart library): one series each, in `--accent`, with the value printed beside every bar and a `title` tooltip.

## Content format

Each section file has YAML frontmatter (`title`, `date`), a format line, an optional `* denotes repeat viewing` line, then entries.

- There are no `total:` lines: the build counts entries and shows the totals under the year heading ("46 books · 104 films · 40 shows", each linking to its section).
- Month headings (`### january`) are inserted automatically for dated entries.
- Text is HTML-escaped, so `&`, `<`, `>` are safe in titles and notes. Markdown links `[text](url)` work anywhere; only `http(s)` and relative URLs become links (anything else, like `javascript:`, is published as plain text). External links open in a new tab.
- `## heading` lines get an id from their text (`## contact` → `#contact`).
- Plain lines (the format line, notes like the abandoned intro) render as small uppercase "meta" text.

### books (`content/YYYY/books.md`)

```
TITLE (year) author | notes

1. TITLE (year) author | optional notes
```

### films (`content/YYYY/films.md`)

```
date TITLE (year) director | format | location | notes
* denotes repeat viewing

MM.DD TITLE (year) director | format | location | optional notes
```

Older years (2010, 2013, part of 2014) use a numbered list instead of dates. A repeat viewing is marked by ending the line with ` *` (space, asterisk): always the **last character of the line**, after any notes. The build renders it as a red marker.

### shows (`content/YYYY/shows.md`)

```
date PERFORMER | VENUE | NOTES

MM.DD PERFORMER | venue | optional notes
```

The second field is **always the venue** (`streaming` for streamed performances). Performer field rules:

- **`, `** separates the acts on a bill: `FRED FRITH, SHELLEY BURGON, MODERN CURRENT`
- **` + `** joins people playing together as one group or set: `WIL BLADES + JEFF PARKER + ROY MCCURDY JR`. This is intentional; never "correct" it to a comma.
- **` w/ `** (lowercase, with spaces) introduces guests or the featured players: `BILL FRISELL TRIO w/ LUKE BERGMAN + TIM ANGULO`
- Never ` / ` or ` | ` between acts, and no trailing "and" in lists. `/` with no spaces is part of a name (`BODY/HEAD`), as is `&` inside a group's name (`MARY HALVORSON & TOMAS FUJIWARA DUO`).
- The whole performer field is UPPERCASE (except `w/`): `MCCURDY`, not `McCURDY`. Notes are lowercase, including composer names.
- Lineups go in parentheses: `HEART TRIO (WILLIAM PARKER, COOPER MOORE, HAMID DRAKE)`.

### abandoned (`content/abandoned.md`)

Same numbered-list format as books.

## Content conventions

- Titles and performers in UPPERCASE; authors, directors, formats, venues, and notes in lowercase.
- All other site text (intro, about, nav, notes, labels) is lowercase, always, including names ("j. cretella", "koreatown, los angeles").
- Formats in lowercase: `dcp`, `35mm`, `16mm`, `4k restoration`, `digital`, `streaming`, `blu-ray`, `dvd`.
- For streaming, the location field is the service: `streaming | criterion channel`, `streaming | kanopy`, `streaming | mubi`. In the 2013 list, `criterion` / `janus films/criterion` is the **disc label**, not the streaming service.
- Use these canonical venue names (most common):
  - `2220 arts + archives` (for lightstruck screenings there, `lightstruck @ 2220 arts + archives` or `2220 arts + archives | presented by lightstruck`)
  - `walt disney concert hall`
  - `egyptian theater`, `aero theater`, `los feliz 3`, `new beverly cinema`, `alamo drafthouse`, `regency theater`
  - `academy museum` (or `ted mann theater @ academy museum`)
  - `philosophical research society` (not `prs`)
  - `brain dead studios`, `barnsdall gallery theater`, `zebulon`, `lodge room`, `redcat`, `the wallis`
- Section display names: books → "read", films → "watch", shows → "listen". In the nav, sections are listed by file name (books/films/shows).

## Design

- Raw, handmade, HTML-first. One serif voice for everything; accents sparse; no decorative chrome.
- Serif type (Spectral, self-hosted from `fonts/`; Georgia is the fallback), white paper, near-black ink, red (`--accent`, #dd2c00, chosen to pass 4.5:1 contrast on white) accents, yellow (`--highlight`) hover with red underline. Colors are the CSS custom properties at the top of `style.css`; use them rather than raw hex values. Type sizes work the same way: `--text-label` (12px), `--text-small` (14px), `--text-body` (18px), `--text-entry` (22px; 20px on phones), `--text-lead` (26px; 22px on phones), plus the two display sizes (masthead, page heading). Every small uppercase label uses `--track-label`. Use these rather than new pixel sizes.
- Sidebar order: about; then music, projects, writing (`NAV_PAGES` in `build.js`); then "read watch listen", which opens to show every year plus `abandoned · stats`; then email. "read watch listen" is a plain `<details>` (works without JavaScript), open on year pages, abandoned and stats, closed elsewhere. On phones (≤768px) the top shows the "cleve" masthead, then one wrapping row (about, music, projects, writing, email), then "read watch listen", which folds the years the same way (its own `<details>`, open on the same pages). Sections (books/films/shows) are switched on the year page itself via the totals line under the year, not in the nav.
- Small grey text (venues, notes, totals, format lines) uses Spectral medium (500), since its regular weight is light at those sizes.
- Titles and performers stay UPPERCASE in the markdown but display as Spectral small caps. `markTitle()` in `build.js` wraps the leading title (everything before ` (YYYY)`, or before the first ` | ` for shows) in `<span class="title">`; `w/` inside it gets `<span class="title-lower">` so it stays lowercase. A mixed-case original title in parentheses (`THE MOMENT OF TRUTH (Il momento della verita)`) is left out of the span.
- The homepage section headings carry the year's count on the right ("104 films in 2026"), linking to that section.
- **Works without JavaScript.** All navigation is plain links. `script.js` only shows one section at a time on year pages (without it, every section shows) and assembles the email links. Keep new features working without it.
- **The email address never appears in the HTML.** Email links are `<a class="email-link" data-user data-domain href="about.html#contact">`; `script.js` builds the `mailto:` at runtime, and without JavaScript the link goes to the about page, which spells the address out in words. The parts are `EMAIL_USER` / `EMAIL_DOMAIN` in `build.js`. Don't write the plain address into content or templates.
- Favicon: red italic Spectral "c" (`favicon.svg`), drawn as a path traced from the font, so it needs no font to render.
- Keep changes minimal and consistent with the existing style.

## Photography

The portfolio is a separate repo, `whatwesee` (https://github.com/strangesongs/whatwesee), published at `/whatwesee/` on this domain by its own Pages deployment. The "photography" nav link points there. Do not add photos or gallery code to this repo.

## Repo rules

- Site title/branding: "cleve".
- Outside links and their one-line notes live in `MUSIC_LINKS`, `PROJECT_LINKS` and `WRITING_LINKS` at the top of `build.js`, and show on their pages (not in the sidebar).
- Do not commit secrets. Do not force-push to main.
- GitHub Actions in the workflow are **pinned to full commit SHAs** (with the version in a comment). To upgrade one, look up the new release's commit and replace both.
- Only commit when explicitly asked.

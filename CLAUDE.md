# strangesongs.github.io

Personal site ("cleve") with a running log of books read, films watched, and live shows attended, plus links to music and other projects. Static site built from markdown by a small Node script and deployed to GitHub Pages by GitHub Actions.

## Commands

```bash
npm install            # install dependencies (ejs, nodemon)
npm run build          # generate the site into dist/
npm run watch          # rebuild on content/template/build/style/script changes
npm run serve          # preview dist/ at http://localhost:8090
npm run deploy         # build, commit content/ only, push
npm run add            # open the add-entry form (same as the "cleve add" app)
```

## How it builds and deploys

- `build.js` reads `content/` and `templates/index.html`, and writes **everything** the site serves into `dist/`: the HTML pages plus copies of `style.css`, `script.js`, and `favicon.svg`.
- `dist/` is gitignored. Never commit generated HTML, and never hand-edit files in `dist/`.
- `.github/workflows/build.yml` runs on every push to `main`: `npm ci`, `npm run build`, then uploads **only `dist/`** to Pages. Nothing else in the repo (mockups, raw files, node_modules, docs) is published. Keep it that way: never change the upload path back to `.`.
- Asset URLs get a `?v=<hash>` of the static files' contents, so the CSS/JS cache-busts automatically. Don't hand-edit version strings.
- The repo itself is public on GitHub. `raw files/` (original pre-markdown lists), `mockups/` (design explorations) and `scripts/` (one-off importer) are gitignored and exist only on the owner's machine; don't re-add them. They remain in old git history.

## Project structure

```
content/
  YYYY/
    books.md     → "read" section
    films.md     → "watch" section
    shows.md     → "listen" section
  abandoned.md   → abandoned books/films
  about.md       → about page
templates/index.html   # the one EJS page layout (meta tags, sidebar, main)
build.js               # markdown → dist/ (pages, sidebar, home, stats, 404, sitemap)
stats.js               # stats page: parsing + rendering, used by build.js
style.css              # the one stylesheet
script.js              # sidebar collapsing, year-page section switching, mobile nav
favicon.svg
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

Each section file has YAML frontmatter (`title`, `date`), a format line, an optional `* denotes repeat viewing` line, a `total:` line, then entries.

- The `total:` line is **not rendered**. The build counts entries itself and shows the totals under the year heading ("46 books · 104 films · 40 shows", each linking to its section). Old files still have `total:` lines; new ones don't need them.
- Month headings (`### january`) are inserted automatically for dated entries.
- Text is HTML-escaped, so `&`, `<`, `>` are safe in titles and notes. Markdown links `[text](url)` work anywhere; only `http(s)` and relative URLs become links (anything else, like `javascript:`, is published as plain text). External links open in a new tab.
- `## heading` lines get an id from their text (`## contact` → `#contact`).
- Plain lines (the format line, notes like the abandoned intro) render as small uppercase "meta" text.

### books (`content/YYYY/books.md`)

```
TITLE (year) author | notes

total: N books

1. TITLE (year) author | optional notes
```

### films (`content/YYYY/films.md`)

```
date TITLE (year) director | format | location | notes
* denotes repeat viewing
total: N films

MM.DD TITLE (year) director | format | location | optional notes
```

Older years (2010, 2013, part of 2014) use a numbered list instead of dates. A repeat viewing is marked by ending the line with ` *` (space, asterisk): always the **last character of the line**, after any notes. The build renders it as a red marker.

### shows (`content/YYYY/shows.md`)

```
date PERFORMER | VENUE | NOTES
total: N shows

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

- Raw, handmade, HTML-first: see `RAW_WEB_STYLE_PORTING_GUIDE.md`.
- Serif type (Georgia), white paper, near-black ink, red (`--accent`) accents, yellow (`--highlight`) hover with red underline. Colors are the CSS custom properties at the top of `style.css`; use them rather than raw hex values.
- Desktop: sticky left sidebar with a collapsible "read watch listen" tree. Mobile (≤768px): stacked text nav at the top, with a years row and a sections row.
- **Works without JavaScript.** The template adds a `js` class to `<html>` before paint; collapsing rules in `style.css` are scoped to `.js`, and the mobile years row ships visible and is collapsed by `script.js` (`nav-ready` class). Keep new interactive features following that pattern.
- `script.js` uses `sessionStorage` only for remembering which nav year is open, always inside `try/catch`.
- **The email address never appears in the HTML.** Email links are `<a class="email-link" data-user data-domain href="about.html#contact">`; `script.js` builds the `mailto:` at runtime, and without JavaScript the link goes to the about page, which spells the address out in words. The parts are `EMAIL_USER` / `EMAIL_DOMAIN` in `build.js`. Don't write the plain address into content or templates.
- Favicon: red italic Georgia "c" (`favicon.svg`).
- Keep changes minimal and consistent with the existing style.

## Photography

The portfolio is a separate repo, `whatwesee` (https://github.com/strangesongs/whatwesee), published at `/whatwesee/` on this domain by its own Pages deployment. The "photography" nav link points there. Do not add photos or gallery code to this repo.

## Repo rules

- Site title/branding: "cleve".
- Project links and their one-line notes live in `PROJECT_LINKS` at the top of `build.js`. The note shows under the link in the desktop sidebar and as a tooltip on mobile.
- Do not commit secrets. Do not force-push to main.
- GitHub Actions in the workflow are **pinned to full commit SHAs** (with the version in a comment). To upgrade one, look up the new release's commit and replace both.
- Only commit when explicitly asked.

# strangesongs.github.io

Personal site ("cleve") with a running log of books read, films watched, and live shows attended, plus links to music and other projects. Static site built from markdown by a small Node script and deployed to GitHub Pages by GitHub Actions.

## Commands

```bash
npm install            # install dependencies (ejs, nodemon)
npm run build          # generate the site into dist/
npm run watch          # rebuild on content/template/build/style/script changes
npm run serve          # preview dist/ at http://localhost:8090
npm run deploy         # build, commit content/ only, push
```

## How it builds and deploys

- `build.js` reads `content/` and `templates/index.html`, and writes **everything** the site serves into `dist/`: the HTML pages plus copies of `style.css`, `script.js`, and `favicon.svg`.
- `dist/` is gitignored. Never commit generated HTML, and never hand-edit files in `dist/`.
- `.github/workflows/build.yml` runs on every push to `main`: `npm ci`, `npm run build`, then uploads **only `dist/`** to Pages. Nothing else in the repo (mockups, raw files, node_modules, docs) is published. Keep it that way: never change the upload path back to `.`.
- The workflow checks out full git history (`fetch-depth: 0`) because the homepage and changelog are built from git commit dates.
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
build.js               # markdown → dist/ (pages, sidebar, home, changelog)
style.css              # the one stylesheet
script.js              # sidebar collapsing, year-page section switching, mobile nav
favicon.svg
```

## Adding a new year

Create `content/YYYY/` with any of `books.md`, `films.md`, `shows.md`, then run `npm run build`. Years are discovered automatically: nothing in `build.js` needs editing.

## What the build generates

- `YYYY.html` for each year folder. All sections are on one page; `script.js` shows one section at a time based on the URL hash (`#books`, `#films`, `#shows`). Without JavaScript, every section is shown.
- `index.html`: the six most recently committed year/section files, with a summary of the last commit to each ("2 new films added", "1 book edited").
- `changelog.html`: the 15 most recently committed content and site files, in the same format.
- `about.html`, `abandoned.html`, plus `rwl.html`, a redirect kept for old links.
- Each page gets a meta description, canonical URL, and Open Graph tags. Year pages describe their counts ("2026: 46 books read, 104 films watched, 40 shows seen.").

Summaries come from the **last commit** touching each file. Entries added and removed in the same commit count as edits, so fixing a typo doesn't show up as "new". Uncommitted changes show as "not yet committed" in a local build.

## Content format

Each section file has YAML frontmatter (`title`, `date`), a format line, an optional `* denotes repeat viewing` line, a `total:` line, then entries.

- `total:` is **recalculated on every build** from the entry count, so the number in the source file can be stale; don't bother updating it by hand.
- Month headings (`### january`) are inserted automatically for dated entries.
- Text is HTML-escaped, so `&`, `<`, `>` are safe in titles and notes. Markdown links `[text](url)` work anywhere.
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

Some older entries separate the acts on a bill with ` | ` (e.g. `MYRIAM GENDRON | JIM WHITE + MELISSA ANDERSON | zebulon`), which makes the venue column ambiguous. For new entries, join acts with `, ` or ` + ` so the second field is always the venue.

### abandoned (`content/abandoned.md`)

Same numbered-list format as books.

## Content conventions

- Titles and performers in UPPERCASE; authors, directors, formats, venues, and notes in lowercase.
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
- Keep changes minimal and consistent with the existing style.

## Photography

The portfolio is a separate repo, `whatwesee` (https://github.com/strangesongs/whatwesee), published at `/whatwesee/` on this domain by its own Pages deployment. The "photography" nav link points there. Do not add photos or gallery code to this repo.

## Repo rules

- Site title/branding: "cleve".
- Do not commit secrets. Do not force-push to main.
- Only commit when explicitly asked.

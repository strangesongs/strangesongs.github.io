# strangesongs.github.io

Personal site (cleve) tracking books read, films watched, and live performances attended. Static site built from markdown content, deployed to GitHub Pages.

## Tech stack

- Node.js build script (`build.js`) with EJS templates
- Content in markdown under `content/`
- Generated HTML at repo root (`2022.html`–`2026.html`, `index.html`, etc.)
- `style.css` + `script.js` for layout and mobile nav
- GitHub Actions (`.github/workflows/build.yml`) builds and deploys on push to `main`

## Commands

```bash
npm install          # install dependencies (ejs, nodemon)
npm run build        # generate all HTML from content
npm run watch        # rebuild on content/template/build/style changes
npm run serve        # local preview at http://localhost:8080
```

After editing content, run `npm run build` to regenerate HTML. Do not hand-edit generated `.html` files.

## Project structure

```
content/
  YYYY/
    books.md    → "read" section
    films.md    → "watch" section
    shows.md    → "listen" section
  abandoned.md  → abandoned books/films
templates/index.html   # EJS layout (sidebar + main content)
build.js               # markdown → HTML, sidebar, changelog, index
style.css              # canonical stylesheet (see RAW_WEB_STYLE_PORTING_GUIDE.md)
script.js              # mobile nav behavior
```

## Content format

Each section file has YAML frontmatter (`title`, `date`) followed by a format line, a `total:` line, then entries.

### books (`content/YYYY/books.md`)

```
TITLE (year) author | notes

total: N books

1. TITLE (year) author | optional notes
```

Numbered list (`1.`, `2.`, …). Titles and authors in lowercase.

### films (`content/YYYY/films.md`)

```
date TITLE (year) director | format | location | notes
* denotes repeat viewing
total: N films

MM.DD TITLE (year) director | format | location | optional notes
```

Dated entries use `MM.DD` prefix (e.g. `01.09`). Repeat viewings marked with `*`.

### shows (`content/YYYY/shows.md`)

```
date PERFORMER | VENUE | NOTES
total: N shows

MM.DD PERFORMER | venue | optional notes
```

Dated entries use `MM.DD` prefix. Markdown links allowed in notes.

### abandoned (`content/abandoned.md`)

Same numbered-list format as books.

## Build behavior

- `total:` lines are **auto-recalculated** on build from list item count — manual totals may be stale until build runs.
- Markdown is converted to HTML by custom logic in `processMarkdown()` (not a full markdown parser). Supported patterns:
  - `- ` bullet lists
  - `1. ` numbered lists
  - `MM.DD ` dated list items
  - `##` / `###` headers
  - Lines starting with `* denotes`, `total:`, `date `, `TITLE` get special wrapping
- Sidebar is generated dynamically from existing `content/YYYY/` directories.
- `index.html` shows recent updates derived from git history.
- `changelog.html` shows site-wide change log.

## Adding a new year

1. Create `content/YYYY/` with `books.md`, `films.md`, and/or `shows.md`.
2. Add the year string to the `allYears` array in `build.js` (and the `buildYear()` call in `build()`).
3. Run `npm run build`.

## Design

- Raw, handmade, HTML-first aesthetic — see `RAW_WEB_STYLE_PORTING_GUIDE.md`.
- Serif typography, neutral paper + dark ink, red accents, yellow link hover.
- Desktop: narrow sidebar. Mobile: stacked top nav via `script.js`.
- Keep changes minimal and consistent with existing style conventions.

## Conventions

- Lowercase titles, authors, directors, venues throughout content.
- Section display names: books → "read", films → "watch", shows → "listen".
- Site title/branding: "cleve".
- Do not commit secrets. Do not force-push to main.
- Only commit when explicitly asked.

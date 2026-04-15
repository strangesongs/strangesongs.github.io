# Raw Web Style Porting Guide

This project now uses a single canonical stylesheet:

- `style.css`
- Template reference: `templates/index.html` -> `style.css?v=20260414-final`

Use this guide to apply the same style direction in another repo.

## Design Intent

- Raw, handmade, HTML-first presentation
- Minimal palette with intentional accents
- Classic text-heavy interface for link lists and personal logs
- Desktop sidebar + mobile top-nav behavior

## Core Visual Rules

1. Typography
- One primary family for nearly everything (serif voice)
- No mixed serif/sans split for major UI hierarchy
- Utility labels may use the same family to keep consistency

2. Color
- Neutral paper + dark ink base
- Red for emphasis/accent markers
- Yellow hover highlight with red underline for links
- Avoid broad color noise; keep accents sparse and meaningful

3. Interaction
- Links: dark default, yellow hover background, red underline
- Disclosure markers: `+` when closed, `-` when open
- No `v` markers

4. Layout
- Narrow sidebar rail on desktop
- Mobile switches to stacked top-nav
- Keep list content large and expressive, but tune films/shows slightly smaller for density

## Must-keep Behavior Fixes

1. Hash navigation should not jump into mid-list on year pages.
- `script.js` intercepts section nav links and calls `updateYearPageView({ scrollToTop: true })`.

2. Film/show clipping prevention
- Slightly increased line-height and vertical padding in film/show list entries
- Keep `overflow: visible` on dated/numbered rows

## Porting Checklist

1. Copy `style.css` into the new project.
2. Point HTML/template stylesheet link to `style.css` with a fresh query string.
3. Ensure HTML structure supports these selectors:
- `.layout`, `.sidebar`, `.content`
- `.rwl-years`, `.rwl-sections`, `.rwl-year-summary`
- `section.films`, `section.shows`
- `.dated-list`, `.numbered-list`, `.entry-date`, `.entry-body`
4. Copy `script.js` section-navigation behavior (no native anchor jump).
5. Verify mobile breakpoint behavior (`@media (max-width: 768px)`).
6. Test pages with long film/show entries for clipping.
7. Hard-refresh and verify cache-busted CSS URL loads.

## Optional Tuning Knobs

- Sidebar width: `.layout { grid-template-columns: ... }`
- Masthead weight/size: `.sidebar h1`
- Page title size: `.content header .year-label`
- Film/show density only:
- `section.films li, section.shows li`
- `section.films .dated-list .entry-body, section.shows .dated-list .entry-body`
- Accent intensity:
- `--accent-primary`, `--hover-highlight`

## Cleanup Policy

Keep only one active stylesheet file (`style.css`) to avoid drift.
If experimenting, use short-lived branches rather than many persistent style variants.

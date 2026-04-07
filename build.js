const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function countSectionItems(rawContent) {
    const itemPattern = /^(?:- |\d+\.\s+|\d{2}\.\d{2}\s+).+/;
    return rawContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => itemPattern.test(line)).length;
}

function processMarkdown(content) {
    // Remove frontmatter
    content = content.replace(/^---[\s\S]*?---\n/, '');
    
    // Convert markdown-style lists to HTML, marking them differently
    content = content.replace(/^- (.+)$/gm, '<li class="bullet">$1</li>');
    content = content.replace(/^\d+\.\s+(.+)$/gm, '<li class="numbered">$1</li>');
    content = content.replace(/^(\d{2}\.\d{2})\s+(.+)$/gm, '<li class="dated"><span class="entry-date">$1</span><span class="entry-body">$2</span></li>');
    
    // Wrap consecutive bullet list items in ul tags.
    // Use a single-line separator so blank lines split lists into separate groups.
    content = content.replace(/(<li class="bullet">.*?<\/li>\n?)+/g, match => {
        return '<ul class="markdown-list bullet-list">' + match + '</ul>';
    });
    
    // Wrap consecutive numbered list items in ol tags
    content = content.replace(/(<li class="numbered">.*?<\/li>\n?)+/g, match => {
        return '<ol class="markdown-list numbered-list">' + match + '</ol>';
    });

    // Wrap consecutive dated entries in ul tags
    content = content.replace(/(<li class="dated">.*?<\/li>\n?)+/g, match => {
        return '<ul class="markdown-list dated-list">' + match + '</ul>';
    });
    
    // Convert headers
    content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Wrap non-HTML lines in paragraphs (for the format description lines)
    const lines = content.split('\n');
    const processedLines = lines.map(line => {
        line = line.trim();
        if (line === '' || line.startsWith('<')) {
            return line;
        }
        // Wrap format description lines and note lines in paragraphs
        if (line.startsWith('* denotes')) {
            return `<p class="addendum">${line}</p>`;
        }
        if (line.startsWith('total:')) {
            return `<p class="count">${line}</p>`;
        }
        if (line.startsWith('date ') || line.startsWith('TITLE')) {
            return `<p>${line}</p>`;
        }
        return `<p>${line}</p>`;
    });
    
    // Keep intentional blank-line spacing while collapsing excessive gaps.
    content = processedLines.join('\n').replace(/\n{3,}/g, '\n\n');
    
    return content;
}

function buildSidebar(currentYear = '', currentSection = '') {
    const allYears = ['2022', '2023', '2024', '2025', '2026'];
    const sectionDefs = [
        { name: 'books', title: 'books' },
        { name: 'films', title: 'films' },
        { name: 'shows', title: 'shows' }
    ];
    const defaultOpenYear = allYears.findLast(year => fs.existsSync(path.join('content', year))) || '';
    const activeYear = currentYear || defaultOpenYear;

    let sidebar = `<h1><a href="index.html">cleve</a></h1>\n<nav>\n<ul>\n`;
    sidebar += `<li><a href="about.html">about</a></li>\n`;
    sidebar += `<li class="rwl-item">\n<details open>\n<summary class="rwl-link">read watch listen</summary>\n<ul class="rwl-years">`;

    [...allYears].reverse().forEach(year => {
        const yearDir = path.join('content', year);
        if (!fs.existsSync(yearDir)) return;

        const availableSections = sectionDefs.filter(section =>
            fs.existsSync(path.join(yearDir, `${section.name}.md`))
        );
        const isOpen = year === activeYear ? ' open' : '';

        sidebar += `\n  <li class="rwl-year-item">`;
        sidebar += `\n    <details${isOpen}>`;
        sidebar += `\n      <summary class="rwl-year-summary">${year}</summary>`;
        sidebar += `\n      <ul class="rwl-sections">`;

        availableSections.forEach(section => {
            const isActive = year === currentYear && section.name === currentSection ? ' class="is-active"' : '';
            sidebar += `\n        <li><a href="${year}.html#${section.name}"${isActive}>${section.title}</a></li>`;
        });

        sidebar += `\n      </ul>`;
        sidebar += `\n    </details>`;
        sidebar += `\n  </li>`;
    });

    sidebar += `\n</ul>\n</details>\n</li>`;
    sidebar += `<li><a href="https://whatwesee.netlify.app/" target="_blank" rel="noopener">photography</a></li>\n`;
    sidebar += `<li><a href="https://consono.bandcamp.com/" target="_blank" rel="noopener">music</a></li>\n`;
    sidebar += `<li><a href="mailto:jcrtll@protonmail.com">email</a></li>\n`;
    sidebar += `</ul>\n</nav>`;

    // Flat mobile-only nav — completely separate from the details tree
    const existingYears = [...allYears].reverse().filter(y => fs.existsSync(path.join('content', y)));
    sidebar += `\n<nav class="mobile-nav">`;
    sidebar += `\n  <div class="mnav-row mnav-main">`;
    sidebar += `\n    <a href="about.html">about</a>`;
    sidebar += `\n    <a href="rwl.html" class="mnav-rwl-link">read watch listen</a>`;
    sidebar += `\n    <a href="https://whatwesee.netlify.app/" target="_blank" rel="noopener">photography</a>`;
    sidebar += `\n    <a href="https://consono.bandcamp.com/" target="_blank" rel="noopener">music</a>`;
    sidebar += `\n    <a href="mailto:jcrtll@protonmail.com">email</a>`;
    sidebar += `\n  </div>`;
    sidebar += `\n  <div class="mnav-row mnav-years" hidden>`;
    existingYears.forEach(year => {
        const yearDir = path.join('content', year);
        const availableSections = ['books', 'films', 'shows'].filter(s =>
            fs.existsSync(path.join(yearDir, `${s}.md`))
        );
        sidebar += `\n    <a href="${year}.html" data-year="${year}" data-sections="${availableSections.join(',')}">${year}</a>`;
    });
    sidebar += `\n  </div>`;
    sidebar += `\n  <div class="mnav-row mnav-sections" hidden></div>`;
    sidebar += `\n</nav>`;

    return sidebar;
}

async function buildYear(year) {
    console.log(`Building ${year}...`);
    
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const contentDir = path.join('content', year);

    if (!fs.existsSync(contentDir)) {
        console.log(`No content directory for ${year}, skipping...`);
        return;
    }

    const sidebar = buildSidebar(year);

    let content = '';
    let recentContent = '';

    // No special 'recent additions' section for 2026; just show main sections

    const sections = [
        { name: 'books', title: 'read' },
        { name: 'films', title: 'watch' },
        { name: 'shows', title: 'listen' }
    ];

    let latestDate = new Date(0); // Start with epoch

    sections.forEach(section => {
        const filePath = path.join(contentDir, `${section.name}.md`);
        if (fs.existsSync(filePath)) {
            let rawContent = fs.readFileSync(filePath, 'utf8');

            // Dynamically recount list items and update the total line
            const itemCount = countSectionItems(rawContent);
            rawContent = rawContent.replace(/^total:.*$/m, `total: ${itemCount} ${section.name}`);

            const processedContent = processMarkdown(rawContent);
            
            // Track the latest modification date
            const fileStats = fs.statSync(filePath);
            if (fileStats.mtime > latestDate) {
                latestDate = fileStats.mtime;
            }
            // Add id attribute for hash navigation
            content += `<section id="${section.name}" class="${section.name}" data-section-title="${section.title}">\n`;
            content += `    <h2>${section.title}</h2>\n`;
            content += `    ${processedContent}\n`;
            content += `</section>\n`;
        }
    });
    
    const currentSectionMatch = content.match(/<section id="([^"]+)"/);
    const html = ejs.render(template, {
        sidebar: buildSidebar(year, currentSectionMatch ? currentSectionMatch[1] : ''),
        content: content,
        year: year,
        showFooter: false,
        lastUpdated: latestDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
    });

    fs.writeFileSync(`${year}.html`, html);
    console.log(`Generated ${year}.html`);
}

async function buildAbout() {
    console.log('Building about...');
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const aboutContent = `
<section class="about">
    <p>coming soon</p>
</section>`;

    const html = ejs.render(template, {
        sidebar: buildSidebar(),
        year: 'about',
        content: aboutContent,
        showFooter: false,
        lastUpdated: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
    });
    
    fs.writeFileSync('about.html', html);
    console.log('Generated about.html');
}

async function buildRwl() {
    console.log('Building rwl...');
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const rwlContent = '';

    const html = ejs.render(template, {
        sidebar: buildSidebar(),
        year: '',
        content: rwlContent,
        showFooter: false,
        lastUpdated: ''
    });

    fs.writeFileSync('rwl.html', html);
    console.log('Generated rwl.html');
}

async function build() {
    // ...existing build logic for years, sections, etc...
    console.log('Starting build...');
    await buildYear('2022');
    await buildYear('2023');
    await buildYear('2024');
    await buildYear('2025');
    await buildYear('2026');
    await buildAbout();
    await buildRwl();

    const execSync = require('child_process').execSync;

    function getLastCommitTime(file) {
        try {
            const ts = execSync(`git log -1 --format=%ct -- ${file}`, { encoding: 'utf8' }).trim();
            if (!ts) return 0;
            return Number(ts) || 0;
        } catch (e) {
            return 0;
        }
    }

    // Gather all content files and their last modified dates
    const years = ['2022', '2023', '2024', '2025', '2026'];
    const sections = ['books', 'films', 'shows'];
    let fileInfos = [];
    years.forEach(year => {
        sections.forEach(section => {
            const filePath = path.join('content', year, `${section}.md`);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const commitTime = getLastCommitTime(filePath);
                fileInfos.push({
                    file: `${year}/${section}.md`,
                    mtime: stats.mtime,
                    commitTime
                });
            }
        });
    });
    // Sort by latest git commit, then mtime, then filename.
    fileInfos.sort((a, b) => {
        const commitDelta = b.commitTime - a.commitTime;
        if (commitDelta !== 0) return commitDelta;

        const mtimeDelta = b.mtime - a.mtime;
        if (mtimeDelta !== 0) return mtimeDelta;

        return a.file.localeCompare(b.file);
    });

    // Show a broader set so same-day updates are represented better
    const topFiles = fileInfos.slice(0, 6);

    // For each file, get a one-line summary of what was added using git
    function getLastSummary(file) {
        try {
            // Get last two commit hashes for the file
            const log = execSync(`git log -n 2 --pretty=format:'%H' -- ${file}`, { encoding: 'utf8' }).trim().split('\n');
            if (log.length < 2) return '';
            const [newHash, oldHash] = log;
            // Get the diff
            const diff = execSync(`git diff ${oldHash} ${newHash} -- ${file}`, { encoding: 'utf8' });
            // Extract only added lines
            const added = diff.match(/^\+[^+][^\n]*/gm) || [];
            if (added.length === 0) return 'Updated';
            // Count list-style additions in all supported markdown formats.
            const newItems = added.filter(l => /^\+(?:\d+\.\s+|- |\d{2}\.\d{2}\s+)/.test(l)).length;
            let type = 'item';
            if (file.includes('books')) type = 'book';
            if (file.includes('films')) type = 'film';
            if (file.includes('shows')) type = 'show';
            if (newItems === 1) {
                return `1 new ${type} added`;
            } else if (newItems > 1) {
                return `${newItems} new ${type}s added`;
            } else {
                return 'Updated';
            }
        } catch (e) {
            return 'Updated';
        }
    }

    // Render the list as HTML (minimal, one-line summary)
    let updatesList = '<section class="recent-updates">\n  <h2 class="recent-updates-title">recent updates</h2>';
    topFiles.forEach(info => {
        const sourceDate = info.commitTime ? new Date(info.commitTime * 1000) : info.mtime;
        const dateStr = sourceDate.toISOString().slice(0, 10);
        const summary = getLastSummary('content/' + info.file);
        const section = path.basename(info.file, '.md');
        updatesList += `\n  <div class=\"recent-file-block\">`;
        updatesList += `<div class=\"recent-file-meta\"><span class=\"file-name\">${info.file}</span><span class=\"file-section\">${section}</span><span class=\"file-date\">${dateStr}</span></div>`;
        updatesList += `<div class=\"file-summary\">${summary}</div>`;
        updatesList += '</div>';
    });
    updatesList += '\n</section>';

    // Use the main template, but with no year and just the updates list as content
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const html = ejs.render(template, {
        sidebar: buildSidebar(),
        year: '',
        content: updatesList,
        showFooter: true,
        lastUpdated: topFiles.length > 0 ? topFiles[0].mtime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    });
    fs.writeFileSync('index.html', html);
    console.log('Generated index.html (recent file updates with diffs)');

    // --- Changelog logic moved here ---
    // Changelog: gather all relevant files (content, about.html, style.css, etc.)
    const changelogFiles = [];
    // Add content files
    years.forEach(year => {
        sections.forEach(section => {
            const filePath = path.join('content', year, `${section}.md`);
            if (fs.existsSync(filePath)) {
                changelogFiles.push({
                    file: `${year}/${section}.md`,
                    rel: `content/${year}/${section}.md`,
                    link: `${year}.html`,
                    mtime: fs.statSync(filePath).mtime
                });
            }
        });
    });
    // Add main pages
    ['about.html', 'index.html', 'style.css', 'script.js'].forEach(f => {
        if (fs.existsSync(f)) {
            changelogFiles.push({
                file: f,
                rel: f,
                link: f.endsWith('.html') ? f : null,
                mtime: fs.statSync(f).mtime
            });
        }
    });
    // Sort by most recent
    changelogFiles.sort((a, b) => b.mtime - a.mtime);
    // Only show the last 10 changes
    const topChangelog = changelogFiles.slice(0, 10);
    // Use the same summary function as homepage
    function getChangelogSummary(file) {
        try {
            const log = execSync(`git log -n 2 --pretty=format:'%H' -- ${file}`, { encoding: 'utf8' }).trim().split('\n');
            if (log.length < 2) return 'Updated';
            const [newHash, oldHash] = log;
            const diff = execSync(`git diff ${oldHash} ${newHash} -- ${file}`, { encoding: 'utf8' });
            const added = diff.match(/^\+[^+][^\n]*/gm) || [];
            if (added.length === 0) return 'Updated';
            // Try to count new items (list items, paragraphs, etc.)
            if (file.includes('books')) {
                const newItems = added.filter(l => l.match(/^\+\d+\.|^- /)).length;
                if (newItems === 1) return '1 new book added';
                if (newItems > 1) return `${newItems} new books added`;
            }
            if (file.includes('films')) {
                const newItems = added.filter(l => l.match(/^\+\d+\.|^- /)).length;
                if (newItems === 1) return '1 new film added';
                if (newItems > 1) return `${newItems} new films added`;
            }
            if (file.includes('shows')) {
                const newItems = added.filter(l => l.match(/^\+\d+\.|^- /)).length;
                if (newItems === 1) return '1 new show added';
                if (newItems > 1) return `${newItems} new shows added`;
            }
            // For about.html, index.html, style.css, script.js, etc.
            const newParas = added.filter(l => l.match(/^\+<p/)).length;
            if (file.endsWith('about.html') && newParas > 0) return `${newParas} paragraph${newParas > 1 ? 's' : ''} added`;
            const newLines = added.length;
            if (newLines === 1) return '1 line added';
            if (newLines > 1) return `${newLines} lines added`;
            return 'Updated';
        } catch (e) {
            return 'Updated';
        }
    }

    // Render changelog as HTML
    let changelogList = '<section class="site-changelog">\n  <h2 class="changelog-title">site changelog</h2>';
    topChangelog.forEach(info => {
        const dateStr = info.mtime.toISOString().slice(0, 10);
        const summary = getChangelogSummary(info.rel);
        if (info.link) {
            changelogList += `\n  <div class=\"changelog-entry\"><a href=\"${info.link}\" class=\"changelog-file\">${info.file}</a> <span class=\"changelog-date\">${dateStr}</span> — <span class=\"changelog-summary\">${summary}</span></div>`;
        } else {
            changelogList += `\n  <div class=\"changelog-entry\"><span class=\"changelog-file\">${info.file}</span> <span class=\"changelog-date\">${dateStr}</span> — <span class=\"changelog-summary\">${summary}</span></div>`;
        }
    });
    changelogList += '\n</section>';

    // Generate sidebar for changelog page
    // (reuse the same logic as above)
    // (could be refactored to a function for DRY, but inlined for now)
    // Write changelog.html using the main template
    const changelogTemplate = fs.readFileSync('templates/index.html', 'utf8');
    const changelogHtml = ejs.render(changelogTemplate, {
        sidebar: buildSidebar(),
        year: '',
        content: changelogList,
        showFooter: false,
        lastUpdated: topChangelog.length > 0 ? topChangelog[0].mtime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    });
    fs.writeFileSync('changelog.html', changelogHtml);
    console.log('Generated changelog.html (site changelog)');

    console.log('Build complete!');
}

build().catch(console.error);

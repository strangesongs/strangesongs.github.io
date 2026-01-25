const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function processMarkdown(content) {
    // Remove frontmatter
    content = content.replace(/^---[\s\S]*?---\n/, '');
    
    // Convert markdown-style lists to HTML
    content = content.replace(/^- (.+)$/gm, '<li>$1</li>');
    content = content.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    
    // Wrap consecutive list items in ol/ul tags
    content = content.replace(/(<li>.*<\/li>\s*)+/gs, '<ol>$&</ol>');
    
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
        if (line.startsWith('date ') || line.startsWith('* denotes') || line.startsWith('TITLE') || line.startsWith('total:')) {
            return `<p>${line}</p>`;
        }
        return line;
    });
    
    // Clean up extra whitespace
    content = processedLines.join('\n').replace(/\n\s*\n/g, '\n');
    
    return content;
}

async function buildYear(year) {
    console.log(`Building ${year}...`);
    
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const contentDir = path.join('content', year);
    
    if (!fs.existsSync(contentDir)) {
        console.log(`No content directory for ${year}, skipping...`);
        return;
    }
    
    let content = '';
    const sections = [
        { name: 'books', title: 'read' },
        { name: 'films', title: 'watch' },
        { name: 'shows', title: 'listen' }
    ];
    
    sections.forEach(section => {
        const filePath = path.join(contentDir, `${section.name}.md`);
        if (fs.existsSync(filePath)) {
            const rawContent = fs.readFileSync(filePath, 'utf8');
            
            // Count list items (lines starting with -)
            const listItems = rawContent.match(/^- /gm);
            const count = listItems ? listItems.length : 0;
            
            const processedContent = processMarkdown(rawContent);
            
            content += `<section class="${section.name}" data-section-title="${section.title}">\n`;
            content += `    <h2>${section.title}</h2>\n`;
            content += `    ${processedContent}\n`;
            content += `    <p class="count">${count} total</p>\n`;
            content += `</section>\n`;
        }
    });
    
    const html = ejs.render(template, {
        content: content,
        year: year,
        lastUpdated: new Date().toLocaleDateString('en-US', { 
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
    const aboutContent = '<section class="about">\n    <div class="photo-placeholder" style="width: 200px; height: 200px; border: 2px solid #4a148c; margin-bottom: 30px; display: flex; align-items: center; justify-content: center; color: #6a1b9a;">\n        [photo goes here]\n    </div>\n    \n    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>\n    \n    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>\n    \n    <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>\n    \n    <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>\n</section>';
    
    const html = ejs.render(template, {
        year: 'about',
        content: aboutContent,
        lastUpdated: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
    });
    
    fs.writeFileSync('about.html', html);
    console.log('Generated about.html');
}

async function build() {
    console.log('Starting build...');
    await buildYear('2022');
    await buildYear('2023');
    await buildYear('2024');
    await buildYear('2025');
    await buildYear('2026');
    await buildAbout();
    
    // Create index.html that redirects to current year (2026)
    const redirectHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=2026.html">
    <script>window.location.href="2026.html";</script>
    <title>read watch listen</title>
</head>
<body>
</body>
</html>`;
    
    fs.writeFileSync('index.html', redirectHtml);
    console.log('Generated index.html (redirect to 2026)');
    console.log('Build complete!');
}

build().catch(console.error);

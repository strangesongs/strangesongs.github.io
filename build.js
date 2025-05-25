const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function processMarkdown(content) {
    // Remove frontmatter
    content = content.replace(/^---[\s\S]*?---\n/, '');
    
    // Convert markdown-style lists to HTML
    content = content.replace(/^- (.+)$/gm, '<li>$1</li>');
    
    // Wrap consecutive list items in ul tags
    content = content.replace(/(<li>.*<\/li>\s*)+/gs, '<ul>$&</ul>');
    
    // Convert headers (## becomes h2, ### becomes h3, etc.)
    content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Convert paragraphs (non-empty lines that aren't already HTML)
    const lines = content.split('\n');
    const processedLines = lines.map(line => {
        line = line.trim();
        if (line === '' || line.startsWith('<') || line.startsWith('date finished')) {
            return line;
        }
        if (!line.startsWith('<li>') && !line.startsWith('<h')) {
            return `<p>${line}</p>`;
        }
        return line;
    });
    
    return processedLines.join('\n');
}

async function buildYear(year) {
    console.log(`Building ${year}...`);
    
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const contentDir = path.join('content', year);
    
    if (!fs.existsSync(contentDir)) {
        console.log(`No content directory for ${year}, skipping...`);
        return;
    }
    
    let content = '<div class="container">\n';
    const sections = [
        { name: 'books', title: 'read' },
        { name: 'movies', title: 'watch' },
        { name: 'tv', title: 'tv' },
        { name: 'music', title: 'listen' }
    ];
    
    sections.forEach(section => {
        const filePath = path.join(contentDir, `${section.name}.md`);
        if (fs.existsSync(filePath)) {
            const rawContent = fs.readFileSync(filePath, 'utf8');
            const processedContent = processMarkdown(rawContent);
            
            content += `    <div class="row">\n`;
            content += `        <div class="twelve columns">\n`;
            content += `            <section class="${section.name}">\n`;
            content += `                <h2>${section.title}</h2>\n`;
            content += `                ${processedContent}\n`;
            content += `            </section>\n`;
            content += `        </div>\n`;
            content += `    </div>\n`;
        }
    });
    
    content += '</div>\n';
    
    // Generate previous years nav (horizontal bar style)
    const allYears = ['2022', '2023', '2024', '2025'];
    const otherYears = allYears.filter(y => y !== year);
    const previousYears = otherYears.map(y => `<li><a href="${y}.html">${y}</a></li>`).join('\n                ');
    
    const html = ejs.render(template, {
        content: content,
        year: year,
        previousYears: previousYears,
        lastUpdated: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
    });

    fs.writeFileSync(`${year}.html`, html);
    console.log(`Generated ${year}.html`);
}

async function build() {
    console.log('Starting build...');
    await buildYear('2022');
    await buildYear('2023');
    await buildYear('2024');
    await buildYear('2025');
    
    // Create index.html that redirects to current year (2025)
    const redirectHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=2025.html">
    <title>watch read listen</title>
</head>
<body>
    <p>Redirecting to <a href="2025.html">2025</a>...</p>
</body>
</html>`;
    
    fs.writeFileSync('index.html', redirectHtml);
    console.log('Generated index.html (redirect to 2025)');
    console.log('Build complete!');
}

build().catch(console.error);

const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const frontMatter = require('front-matter');
const ejs = require('ejs');

marked.setOptions({
    mangle: false,
    headerIds: false
});

// Function to add spacing between months
function addMonthSpacing(htmlContent) {
    // Split by lines and add spacing between different month numbers
    const lines = htmlContent.split('\n');
    let result = [];
    let currentMonth = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        result.push(line);
        
        // Check if this line contains a date pattern like "- 1.xx" or "- 2.xx"
        const match = line.match(/<li>-?\s*(\d+)\./);
        if (match) {
            const month = match[1];
            if (currentMonth && currentMonth !== month) {
                // Add a line break before this item if it's a new month
                result[result.length - 1] = '<br>' + line;
            }
            currentMonth = month;
        }
    }
    
    return result.join('\n');
}

async function buildYear(year) {
    console.log(`Building ${year}...`);
    
    // Delete existing HTML file if it exists
    if (fs.existsSync(`${year}.html`)) {
        fs.unlinkSync(`${year}.html`);
        console.log(`Deleted existing ${year}.html`);
    }
    
    const sections = ['films', 'books', 'shows'].map(section => {
        const filePath = `content/${year}/${section}.md`;
        console.log(`Reading ${filePath}...`);
        
        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`Warning: ${filePath} does not exist - skipping`);
                return null;
            }
            
            const md = fs.readFileSync(filePath, 'utf8');
            const content = frontMatter(md);
            const title = content.attributes && content.attributes.title ? content.attributes.title : section;
            let parsedContent = marked.parse(content.body);
            
            // Add month spacing for years that have dates
            if (year !== '2022' && year !== '2023') {
                parsedContent = addMonthSpacing(parsedContent);
            }
            
            return `<section id="${section}-section">
                <h3>${title}</h3>
                ${parsedContent}
            </section>`;
        } catch (error) {
            console.error(`Error processing ${filePath}: ${error.message}`);
            return null;
        }
    }).filter(section => section !== null);

    const template = fs.readFileSync('templates/index.html', 'utf8');
    
    // Generate other years list (excluding current year)
    const allYears = ['2022', '2023', '2024', '2025'];
    const otherYears = allYears.filter(y => y !== year).sort();
    const otherYearsHtml = otherYears.map(y => `<li><a href="${y}.html">${y}</a></li>`).join('\n                ');
    
    const html = ejs.render(template, {
        content: sections.join('\n'),
        year: year,
        previousYears: otherYearsHtml
    });

    fs.writeFileSync(`${year}.html`, html);
    console.log(`Generated ${year}.html`);
    
    // Copy static assets
    if (fs.existsSync('templates/scripts.js')) {
        fs.copyFileSync('templates/scripts.js', 'scripts.js');
        console.log('Copied scripts.js');
    }
    if (fs.existsSync('style.css')) {
        // Style.css is already in the root, no need to copy
        console.log('Using existing style.css');
    }
}

async function build() {
    await buildYear('2022');
    await buildYear('2023');
    await buildYear('2024');
    await buildYear('2025');
}

build().catch(console.error);

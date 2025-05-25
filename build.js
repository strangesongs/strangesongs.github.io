const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const frontMatter = require('front-matter');
const ejs = require('ejs');

marked.setOptions({
    mangle: false,
    headerIds: false
});

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
                return null; // Return null instead of placeholder content
            }
            
            const md = fs.readFileSync(filePath, 'utf8');
            const content = frontMatter(md);
            const title = content.attributes && content.attributes.title ? content.attributes.title : section;
            return `<section id="${section}-section">
                <h3>${title}</h3>
                ${marked.parse(content.body)}
            </section>`;
        } catch (error) {
            console.error(`Error processing ${filePath}: ${error.message}`);
            return null; // Return null on error instead of error message
        }
    }).filter(section => section !== null); // Filter out null sections

    const template = fs.readFileSync('templates/index.html', 'utf8');
    
    // Generate previous years list (excluding current year)
    const allYears = ['2022', '2024', '2025'];
    const previousYears = allYears.filter(y => y !== year).sort();
    const previousYearsHtml = previousYears.map(y => `<li><a href="${y}.html">${y}</a></li>`).join('\n                ');
    
    const html = ejs.render(template, {
        content: sections.join('\n'),
        year: year,
        previousYears: previousYearsHtml
    });

    fs.writeFileSync(`${year}.html`, html);
    console.log(`Generated ${year}.html`);
    
    // Copy static assets
    fs.copyFileSync('templates/scripts.js', 'scripts.js');
    console.log('Copied scripts.js');
}

async function build() {
    await buildYear('2022');
    await buildYear('2023');
    await buildYear('2024');
    await buildYear('2025');
}

build().catch(console.error);

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
        
        const md = fs.readFileSync(filePath, 'utf8');
        const content = frontMatter(md);
        return `<section id="${section}-section">
            <h3>${content.attributes.title}</h3>
            ${marked.parse(content.body)}
        </section>`;
    });

    const template = fs.readFileSync('templates/index.html', 'utf8');
    const html = ejs.render(template, {
        content: sections.join('\n'),
        year: year
    });

    fs.writeFileSync(`${year}.html`, html);
    console.log(`Generated ${year}.html`);
    
    // Copy static assets
    fs.copyFileSync('templates/scripts.js', 'scripts.js');
    console.log('Copied scripts.js');
}

async function build() {
    await buildYear('2024');
    await buildYear('2025');
}

build().catch(console.error);

const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const frontMatter = require('front-matter');
const ejs = require('ejs');

// Configure marked options
marked.setOptions({
    mangle: false,
    headerIds: false
});

async function buildYear(year) {
    // Create dist directory if it doesn't exist
    if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist');
    }

    const sections = ['films', 'books', 'shows'].map(section => {
        const filePath = `content/${year}/${section}.md`;
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

    fs.writeFileSync(`dist/${year}.html`, html);
}

async function build() {
    await buildYear('2024');
    await buildYear('2025');
}

build().catch(console.error);

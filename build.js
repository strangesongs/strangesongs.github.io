const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

async function buildYear(year) {
    console.log(`Building ${year}...`);
    
    const template = fs.readFileSync('templates/index.html', 'utf8');
    const contentDir = path.join('content', year);
    
    if (!fs.existsSync(contentDir)) {
        console.log(`No content directory for ${year}, skipping...`);
        return;
    }
    
    let content = '';
    const sections = ['books', 'movies', 'tv', 'music'];
    
    sections.forEach(section => {
        const filePath = path.join(contentDir, `${section}.md`);
        if (fs.existsSync(filePath)) {
            const sectionContent = fs.readFileSync(filePath, 'utf8');
            content += `<section class="${section}">\n${sectionContent}\n</section>\n`;
        }
    });
    
    // Generate previous years nav
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

async function buildIndex() {
    console.log('Building index page...');
    
    const template = fs.readFileSync('templates/index.html', 'utf8');
    
    const allYears = ['2022', '2023', '2024', '2025'];
    const yearLinks = allYears.map(year => `<li><a href="${year}.html">${year}</a></li>`).join('\n                ');
    
    const html = ejs.render(template, {
        content: `<div class="container">
            <div class="row">
                <div class="twelve columns">
                    <h3>select a year</h3>
                    <ul>
                        ${yearLinks}
                    </ul>
                </div>
            </div>
        </div>`,
        year: '',
        previousYears: '',
        lastUpdated: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
    });

    fs.writeFileSync('index.html', html);
    console.log('Generated index.html');
}

async function build() {
    console.log('Starting build...');
    await buildYear('2022');
    await buildYear('2023');
    await buildYear('2024');
    await buildYear('2025');
    await buildIndex();
    console.log('Build complete!');
}

build().catch(console.error);

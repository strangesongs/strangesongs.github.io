document.addEventListener('DOMContentLoaded', function() {
    const yearLinks = document.querySelectorAll('.year-link');
    const sectionLinks = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('section');
    const yearLabel = document.querySelector('.year-label');
    
    // Get current year from page
    const currentYear = yearLabel.textContent.trim();
    
    // Format all list items with proper styling
    function formatListItems() {
        sections.forEach(section => {
            // Make sure section is visible
            section.style.display = 'block';
            
            const listItems = section.querySelectorAll('li');
            listItems.forEach(li => {
                // For shows section, don't reformat - the bold is already in the HTML
                if (section.classList.contains('shows')) {
                    // Just apply consistent styling without reformatting
                    const text = li.innerHTML;
                    const showMatch = text.match(/^(\d+\.\d+)\s+(.+)$/);
                    if (showMatch) {
                        const date = showMatch[1];
                        const details = showMatch[2];
                        li.innerHTML = `<span style="display: inline-block; width: 45px; font-weight: normal;">${date}</span>${details}`;
                    }
                    return;
                }
                
                const text = li.textContent;
                
                // Try to match with date first: date TITLE (year) rest...
                // More flexible title pattern to capture numbers, hyphens, etc
                const withDateMatch = text.match(/^(\d+\.\d+)\s+([A-Z0-9][A-Z0-9\s,:\-!'&\.\(\)]+?)\s+(\(\d{4}\))\s+(.+)$/);
                
                // Match without date but with year: TITLE (year) rest...
                const withoutDateMatch = text.match(/^([A-Z0-9][A-Z0-9\s,:\-!'&\.\(\)]+?)\s+(\(\d{4}\))\s+(.+)$/);
                
                // Match entries with no date and no year: TITLE author/director
                const noYearMatch = text.match(/^([A-Z0-9][A-Z0-9\s,:\-!'&\.\(\)]+?)\s+([a-z].+)$/);
                
                if (withDateMatch) {
                    const date = withDateMatch[1];
                    const title = withDateMatch[2].trim();
                    const year = withDateMatch[3];
                    const meta = withDateMatch[4];
                    
                    li.innerHTML = `<span style="display: inline-block; width: 45px; font-weight: normal;">${date}</span><span style="font-weight: bold;">${title}</span> ${year} <span style="font-size: 14px; color: #666;">${meta}</span>`;
                } else if (withoutDateMatch) {
                    const title = withoutDateMatch[1].trim();
                    const year = withoutDateMatch[2];
                    const meta = withoutDateMatch[3];
                    
                    li.innerHTML = `<span style="font-weight: bold;">${title}</span> ${year} <span style="font-size: 14px; color: #666;">${meta}</span>`;
                } else if (noYearMatch) {
                    const title = noYearMatch[1].trim();
                    const meta = noYearMatch[2];
                    
                    li.innerHTML = `<span style="font-weight: bold;">${title}</span> <span style="font-size: 14px; color: #666;">${meta}</span>`;
                }
                // If no match, leave as is (for entries without standard format)
            });
        });
    }
    
    formatListItems();
    
    // Expand current year by default
    const currentYearLink = document.querySelector(`.year-link[data-year="${currentYear}"]`);
    if (currentYearLink) {
        currentYearLink.parentElement.classList.add('expanded');
    }
    
    // Handle year link clicks
    yearLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const year = this.dataset.year;
            const parentLi = this.parentElement;
            
            // If clicking on a different year, load that page
            if (year !== currentYear) {
                window.location.href = `${year}.html`;
                return;
            }
            
            // Toggle expansion for current year
            const wasExpanded = parentLi.classList.contains('expanded');
            
            // Close all year items
            document.querySelectorAll('.year-item').forEach(item => {
                item.classList.remove('expanded');
            });
            
            // Open this one if it wasn't already expanded
            if (!wasExpanded) {
                parentLi.classList.add('expanded');
            }
            
            // Show all sections when year is clicked
            sections.forEach(section => {
                section.style.display = 'block';
            });
            
            // Reset year label to just the year
            yearLabel.textContent = currentYear;
        });
    });
    
    // Handle section link clicks (films, books, shows)
    sectionLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionName = this.dataset.section;
            
            // Hide all sections
            sections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show only the clicked section
            const targetSection = document.querySelector(`.${sectionName}`);
            if (targetSection) {
                targetSection.style.display = 'block';
                
                // Update year label to show "year (section)"
                const sectionTitle = targetSection.dataset.sectionTitle || sectionName;
                yearLabel.textContent = `${currentYear} (${sectionTitle})`;
            }
            
            // Remove active class from all section links
            sectionLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
        });
    });
});

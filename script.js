document.addEventListener('DOMContentLoaded', function() {
    const yearLinks = document.querySelectorAll('.year-link');
    const sectionLinks = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('section');
    const yearLabel = document.querySelector('.year-label');
    
    const currentYear = yearLabel.textContent.trim();
    
    // Hide all sections initially
    sections.forEach(section => section.style.display = 'none');
    
    // Show only the first section on page load
    if (sections.length > 0) {
        sections[0].style.display = 'block';
        const sectionTitle = sections[0].dataset.sectionTitle || sections[0].className;
        yearLabel.textContent = `${currentYear} (${sectionTitle})`;
        
        // Mark first section link as active
        const firstSectionName = sections[0].className.split(' ')[0];
        const firstLink = document.querySelector(`[data-section="${firstSectionName}"]`);
        if (firstLink) {
            firstLink.classList.add('active');
        }
    }
    
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
            
            // If clicking on a different year, load that page
            if (year !== currentYear) {
                window.location.href = `${year}.html`;
                return;
            }
            
            // Toggle expansion for current year
            const parentLi = this.parentElement;
            const wasExpanded = parentLi.classList.contains('expanded');
            
            // Close all year items
            document.querySelectorAll('.year-item').forEach(item => {
                item.classList.remove('expanded');
            });
            
            // Open this one if it wasn't already expanded
            if (!wasExpanded) {
                parentLi.classList.add('expanded');
                
                // Show the first available section
                const firstSectionLink = parentLi.querySelector('[data-section]');
                if (firstSectionLink) {
                    firstSectionLink.click();
                }
            }
        });
    });
    
    // Handle section link clicks
    sectionLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionName = this.dataset.section;
            
            // Hide all sections
            sections.forEach(section => section.style.display = 'none');
            
            // Show only the clicked section
            const targetSection = document.querySelector(`.${sectionName}`);
            if (targetSection) {
                targetSection.style.display = 'block';
                const sectionTitle = targetSection.dataset.sectionTitle || sectionName;
                yearLabel.textContent = `${currentYear} (${sectionTitle})`;
            }
            
            // Update active states
            sectionLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

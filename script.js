document.addEventListener('DOMContentLoaded', function() {
            // Sidebar: Expand/collapse 'read watch listen' years and subpages
            const rwlYearLinks = document.querySelectorAll('.rwl-year-link');
            rwlYearLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const parent = this.closest('.rwl-year-item');
                    const subpages = parent.querySelector('.rwl-subpages');
                    const isOpen = subpages.style.display === 'block';
                    // Close all subpages
                    document.querySelectorAll('.rwl-subpages').forEach(ul => ul.style.display = 'none');
                    if (!isOpen) {
                        subpages.style.display = 'block';
                    }
                });
            });

            // Prevent sidebar collapse when clicking subpage links
            const rwlSubLinks = document.querySelectorAll('.rwl-subpages a');
            rwlSubLinks.forEach(link => {
                link.addEventListener('click', function() {
                    // Keep the year list expanded in localStorage
                    localStorage.setItem('rwlExpanded', '1');
                });
            });
        // Sidebar: Expand/collapse 'read watch listen' years, keep expanded across pages
        const rwlLink = document.querySelector('.rwl-link');
        const rwlYears = document.querySelector('.rwl-years');
        // Use localStorage to remember expanded/collapsed state
        function setRwlExpanded(expanded) {
            if (expanded) {
                rwlYears.style.display = 'block';
                localStorage.setItem('rwlExpanded', '1');
            } else {
                rwlYears.style.display = 'none';
                localStorage.setItem('rwlExpanded', '0');
            }
        }
        if (rwlLink && rwlYears) {
            // On load, restore state
            const expanded = localStorage.getItem('rwlExpanded') !== '0';
            setRwlExpanded(expanded);
            // If expanded, also expand the submenu for the current year/hash
            if (expanded) {
                // Get current year from .year-label or from URL
                let currentYear = '';
                const yearLabel = document.querySelector('.year-label');
                if (yearLabel) {
                    currentYear = yearLabel.textContent.trim();
                }
                // If on a hash (e.g., #books), still expand the year
                if (!currentYear) {
                    const match = window.location.pathname.match(/(\d{4})\.html/);
                    if (match) currentYear = match[1];
                }
                if (currentYear) {
                    const yearItem = document.querySelector(`.rwl-year-link[data-year="${currentYear}"]`);
                    if (yearItem) {
                        const subpages = yearItem.closest('.rwl-year-item').querySelector('.rwl-subpages');
                        if (subpages) subpages.style.display = 'block';
                    }
                }
            }
            rwlLink.addEventListener('click', function(e) {
                e.preventDefault();
                const isOpen = rwlYears.style.display === 'block';
                setRwlExpanded(!isOpen);
            });
        }
    const yearLinks = document.querySelectorAll('.year-link');
    const sectionLinks = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('section');
    const yearLabel = document.querySelector('.year-label');
    
    const currentYear = yearLabel.textContent.trim();
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Mobile: show all sections for continuous scroll
        sections.forEach(section => section.style.display = 'block');
    } else {
        // Desktop: hide all sections initially
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
    
    // Handle section link clicks (desktop only)
    sectionLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // On mobile, don't filter - continuous scroll shows all sections
            if (window.innerWidth <= 768) {
                return;
            }
            
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

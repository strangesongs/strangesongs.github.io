document.addEventListener('DOMContentLoaded', function() {
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleDateString();
    }

    // Function to count list items and update the count
    function updateCount(sectionId, countId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const items = section.querySelectorAll('li');
            const countElement = document.getElementById(countId);
            if (countElement) {
                countElement.textContent = items.length;
            }
        }
    }

    // Update counts for each section
    updateCount('films-section', 'film-count');
    updateCount('books-section', 'book-count');
    updateCount('shows-section', 'show-count');
});

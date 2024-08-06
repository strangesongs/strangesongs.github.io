document.addEventListener('DOMContentLoaded', function() {
    function updateFilmCount() {
        const section = document.getElementById('film-section'); // Select the section with the ID 'film-section'
        const ul = section.querySelector('ul'); // Select the <ul> within the section
        const liCount = ul.querySelectorAll('li').length; // Count the <li> items
        document.getElementById('film-count').textContent = liCount; // Update the <span> with the count
    }

    function updateShowCount() {
        const section = document.getElementById('show-section'); // Select the section with the ID 'show-section'
        const ul = section.querySelector('ul'); // Select the <ul> within the section
        const liCount = ul.querySelectorAll('li').length; // Count the <li> items
        document.getElementById('show-count').textContent = liCount; // Update the <span> with the count
    }

    function updateBookCount() {
        const section = document.getElementById('read-section'); // Select the section with the ID 'read-section'
        const ul = section.querySelector('ul'); // Select the <ul> within the section
        const liCount = ul.querySelectorAll('li').length; // Count the <li> items
        document.getElementById('book-count').textContent = liCount; // Update the <span> with the count
    }

    function updateLastModified() {
        const lastUpdatedElement = document.getElementById('last-updated');
        const lastModified = new Date(document.lastModified);
        const formattedDate = `${lastModified.getMonth() + 1}.${lastModified.getDate()}.${lastModified.getFullYear()}`;
        lastUpdatedElement.innerHTML = `<i>last updated ${formattedDate}</i>`;
    }

    updateFilmCount();
    updateShowCount();
    updateBookCount();
    updateLastModified();
});
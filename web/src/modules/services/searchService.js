/**
 * Search service module for handling municipality search functionality
 */

/**
 * Sets up the search functionality for municipalities.
 * Handles autocomplete suggestions and municipality selection.
 * @param {Object} data - Municipality data for searching
 * @param {Function} onMunicipalitySelect - Callback function when municipality is selected
 */
export function setupSearch(data, onMunicipalitySelect) {
    const searchInput = document.getElementById('searchInput');
    const autocompleteList = document.getElementById('autocompleteList');
    
    searchInput.addEventListener('input', function() {
        const value = this.value.trim().toLowerCase();
        autocompleteList.innerHTML = '';
        const searchError = document.querySelector('.search-error');
        if (value.length < 2) {
            searchError.classList.remove('visible');
            return;
        }

        // Get fuzzy matches instead of exact includes
        const matches = fuzzySearch(data.gemeenten, value);

        if (matches.length === 0) {
            searchError.classList.add('visible');
        } else {
            searchError.classList.remove('visible');
        }

        matches.forEach(match => {
            const div = document.createElement('div');
            div.textContent = match.item.naam;
            div.addEventListener('click', () => {
                handleMunicipalitySelection(match.item, searchInput, autocompleteList, onMunicipalitySelect);
            });
            autocompleteList.appendChild(div);
        });
    });

    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            const value = this.value.trim().toLowerCase();
            
            // Use fuzzy search for matches
            const matches = fuzzySearch(data.gemeenten, value);
            
            // Try exact match first (case insensitive)
            const exactMatch = data.gemeenten.find(municipality =>
                municipality.naam.toLowerCase() === value
            );

            if (exactMatch) {
                // If there's an exact match, use that
                handleMunicipalitySelection(exactMatch, searchInput, autocompleteList, onMunicipalitySelect);
            } else if (matches.length === 1) {
                // If there's only one fuzzy match, use that
                handleMunicipalitySelection(matches[0].item, searchInput, autocompleteList, onMunicipalitySelect);
            } else if (matches.length > 1) {
                // If there are multiple matches, use the one with highest score
                const bestMatch = matches[0]; // Matches are already sorted by score
                if (bestMatch.score > 0.4) { // Only use if score is good enough
                    handleMunicipalitySelection(bestMatch.item, searchInput, autocompleteList, onMunicipalitySelect);
                }
            }
        }
    });
}

/**
 * Calculates Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Distance between strings
 */
function levenshteinDistance(str1, str2) {
    // Convert strings to lowercase for case-insensitive comparison
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    
    const m = str1.length;
    const n = str2.length;
    
    // Create a matrix of size (m+1) x (n+1)
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    // Initialize the matrix
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }
    
    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                );
            }
        }
    }
    
    return dp[m][n];
}

/**
 * Calculates similarity score between strings (higher = more similar)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1; // Both strings are empty
    
    const distance = levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
}

/**
 * Performs fuzzy search on array of municipality objects
 * @param {Array} items - Array of objects to search in
 * @param {string} query - Search query
 * @param {number} threshold - Minimum similarity score (0-1)
 * @returns {Array} - Array of matches with scores
 */
function fuzzySearch(items, query, threshold = 0.3) {
    // Return empty array for empty query
    if (!query || query.length < 2) return [];
    
    // Calculate similarity scores for each item
    const results = items.map(item => {
        const score = calculateSimilarity(query, item.naam.toLowerCase());
        return { item, score };
    });
    
    // Filter by threshold and sort by score (descending)
    return results
        .filter(result => result.score >= threshold || result.item.naam.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Limit to top 10 results
}

/**
 * Handles the selection of a municipality from search
 * @param {Object} municipality - The selected municipality object
 * @param {HTMLElement} searchInput - The search input element
 * @param {HTMLElement} autocompleteList - The autocomplete list element
 * @param {Function} onMunicipalitySelect - Callback function when municipality is selected
 */
function handleMunicipalitySelection(municipality, searchInput, autocompleteList, onMunicipalitySelect) {
    // Clear UI elements
    autocompleteList.innerHTML = '';
    const searchError = document.querySelector('.search-error');
    searchError.classList.remove('visible');
    
    // Hide keyboard on mobile devices
    searchInput.blur();

    // Clear input after a short delay
    setTimeout(() => {
        searchInput.value = '';
    }, 585);

    // Call the callback function with the selected municipality
    if (onMunicipalitySelect) {
        onMunicipalitySelect(municipality);
    }
}

/**
 * Finds a municipality by name in the provided data
 * @param {Object} data - Municipality data to search in
 * @param {string} municipalityName - Name of the municipality to find
 * @returns {Object|null} - Found municipality object or null
 */
export function findMunicipalityByName(data, municipalityName) {
    if (!data || !data.features) return null;

    // Try exact match first
    const exactMatch = data.features.find(feature =>
        feature.properties.gemeentenaam.toLowerCase() === municipalityName.toLowerCase()
    );

    if (exactMatch) {
        return {
            naam: exactMatch.properties.gemeentenaam,
            code: exactMatch.properties.gemeentecode
        };
    }

    // Try fuzzy match if exact match fails
    const searchData = createSearchData(data);
    const fuzzyMatches = fuzzySearch(searchData.gemeenten, municipalityName, 0.6); // Higher threshold for URL params
    
    if (fuzzyMatches.length > 0) {
        return fuzzyMatches[0].item;
    }

    return null;
}

/**
 * Creates a simplified data structure for search from municipality data
 * @param {Object} municipalityData - Raw municipality data
 * @returns {Object} - Simplified data structure for search
 */
export function createSearchData(municipalityData) {
    return {
        gemeenten: municipalityData.features.map(feature => ({
            naam: feature.properties.gemeentenaam,
            code: feature.properties.gemeentecode
        })).sort((a, b) => a.naam.localeCompare(b.naam))
    };
} 
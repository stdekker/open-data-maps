/**
 * Fetches and parses JSON data from a URL with error handling
 * @param {string} url - The URL to fetch from
 * @returns {Promise<Object>} The parsed JSON data
 * @throws {Error} If the fetch fails or response is not OK
 */
export async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}

/**
 * Loads population data for municipalities if not already loaded
 * @param {Object} municipalityPopulations - Object to store municipality data
 */
export async function ensurePopulationData(municipalityPopulations) {
    if (Object.keys(municipalityPopulations).length === 0) {
        try {
            const data = await fetchData('data/gemeenten.json');
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = {
                    ...feature.properties
                };
            });
        } catch (error) {
            console.error('Error loading population data:', error);
        }
    }
}

/**
 * Loads GeoJSON data for a specific municipality
 * @param {string} code - Municipality code
 * @returns {Promise<Object>} GeoJSON data for the municipality
 */
export async function loadGeoJsonData(code) {
    try {
        const data = await fetchData(`api/municipality.php?code=${code}`);
        return data;
    } catch (error) {
        console.error('Error loading GeoJSON data:', error);
        throw error;
    }
}

/**
 * Loads overview data containing municipality information
 * @returns {Promise<Object>} Overview data with municipality list
 */
export async function loadOverviewData() {
    try {
        const data = await fetchData('data/overview.json');
        return data;
    } catch (error) {
        console.error('Error loading overview data:', error);
        throw error;
    }
} 
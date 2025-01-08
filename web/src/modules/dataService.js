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
import { findFirstSymbolLayer, cleanupLayers } from '../services/layerService.js';
import * as State from '../state.js';
import * as cache from '../services/cacheService.js';

let lastLoadedMunicipalityCode = null;
let isFetchCancelled = false;

/**
 * Updates the progress message for the BAG layer.
 * @param {string} message - The message to display. If empty, the indicator is hidden.
 */
function updateBagProgress(message) {
    const progressElement = document.getElementById('bag-progress');
    if (progressElement) {
        progressElement.textContent = message;
        progressElement.style.display = message ? 'block' : 'none';
        console.log('BAG Progress:', message); // Debug logging
    } else {
        console.warn('BAG progress element not found!');
    }
}

/**
 * Helper function to calculate the bounding box of a GeoJSON geometry.
 * @param {Object} geometry - A GeoJSON geometry object.
 * @returns {Array<number>} - An array representing the bbox: [minX, minY, maxX, maxY].
 */
function getGeoJsonBbox(geometry) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function process(coords) {
        if (typeof coords[0] === 'number') { // It's a coordinate
            minX = Math.min(minX, coords[0]);
            minY = Math.min(minY, coords[1]);
            maxX = Math.max(maxX, coords[0]);
            maxY = Math.max(maxY, coords[1]);
        } else { // It's an array of coordinates or arrays, recurse
            coords.forEach(process);
        }
    }
    
    process(geometry.coordinates);
    
    return [minX, minY, maxX, maxY];
}


/**
 * Sets up the BAG layer on the map with an empty source.
 * @param {Object} map - The Mapbox map instance
 */
export function addBagLayer(map) {
    // Clean up existing BAG layer if it exists, but preserve the last loaded code
    const currentMunicipalityCode = lastLoadedMunicipalityCode;
    cleanupBagLayer(map);
    lastLoadedMunicipalityCode = currentMunicipalityCode; // Restore it
    
    const firstSymbolId = findFirstSymbolLayer(map);
    
    if (!map.getSource('bag-verblijfsobjecten')) {
        map.addSource('bag-verblijfsobjecten', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    
    if (!map.getLayer('bag-verblijfsobjecten-points')) {
        map.addLayer({
            id: 'bag-verblijfsobjecten-points',
            type: 'circle',
            source: 'bag-verblijfsobjecten',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 1,
                    14, 2,
                    18, 6
                ],
                'circle-color': '#ff6b6b',
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#d63384'
            }
        }, firstSymbolId);

        // Add click listener for showing feature properties
        map.on('click', 'bag-verblijfsobjecten-points', (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                // console.log('Clicked BAG feature properties:', feature.properties);
            }
        });

        // Change the cursor to a pointer when the mouse is over the points layer.
        map.on('mouseenter', 'bag-verblijfsobjecten-points', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'bag-verblijfsobjecten-points', () => {
            map.getCanvas().style.cursor = '';
        });
    }
}

/**
 * Loads all BAG verblijfsobjecten for a specific municipality.
 * @param {Object} map - The Mapbox map instance.
 * @param {Object|null} municipalityFeature - The GeoJSON feature for the municipality. Null to clear data.
 */
export async function loadBagDataForMunicipality(map, municipalityFeature) {
    const source = map.getSource('bag-verblijfsobjecten');
    if (!source) {
        return;
    }

    if (!municipalityFeature) {
        source.setData({ type: 'FeatureCollection', features: [] });
        lastLoadedMunicipalityCode = null;
        return;
    }

    const newMunicipalityCode = municipalityFeature.properties.gemeentecode;
    if (lastLoadedMunicipalityCode === newMunicipalityCode) {
        return;
    }
    
    isFetchCancelled = false;
    lastLoadedMunicipalityCode = newMunicipalityCode;
    source.setData({ type: 'FeatureCollection', features: [] });
    updateBagProgress('Loading BAG data...');

    try {
        const initialResponse = await fetch(`api/bag.php?municipality_code=${newMunicipalityCode}`);
        if (isFetchCancelled) return;

        const initialData = await initialResponse.json();

        if (initialData.type === 'FeatureCollection') {
            // Cached data is returned
            updateBagProgress('Loading BAG data from server cache...');
            source.setData(initialData);
            updateBagProgress(`Loaded ${initialData.features.length} buildings.`);
            setTimeout(() => updateBagProgress(''), 2000);
        } else if (initialData.status === 'fetch_postcodes') {
            // No cache, need to fetch per postcode
            const postcodes = initialData.postcodes;
            if (postcodes.length === 0) {
                updateBagProgress('No postcodes found for BAG data.');
                setTimeout(() => updateBagProgress(''), 2000);
                return;
            }

            let allFeatures = [];
            let loadedCount = 0;

            for (const postcode of postcodes) {
                if (isFetchCancelled) {
                    updateBagProgress('Loading cancelled.');
                    return;
                }

                loadedCount++;
                updateBagProgress(`Loading BAG data for ${postcode}... (${loadedCount}/${postcodes.length})`);

                // Small delay to allow UI to update
                await new Promise(resolve => setTimeout(resolve, 100));

                const apiUrl = `api/bag.php?postcode4=${postcode}`;
                const response = await fetch(apiUrl);
                if (isFetchCancelled) return;

                if (!response.ok) {
                    console.warn(`Failed to fetch BAG data for postcode ${postcode}.`);
                    continue;
                }
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    allFeatures.push(...data.features);
                    source.setData({ type: 'FeatureCollection', features: allFeatures });
                    updateBagProgress(`Loading BAG data for ${postcode}... (${loadedCount}/${postcodes.length}) - ${allFeatures.length} buildings loaded`);
                }
            }

            if (isFetchCancelled) return;
            
            updateBagProgress(`Loaded ${allFeatures.length} buildings.`);
            setTimeout(() => updateBagProgress(''), 2000);

            // Post the final data to server for caching
            const finalGeoJson = { type: 'FeatureCollection', features: allFeatures };
            await fetch(`api/bag.php?municipality_code=${newMunicipalityCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalGeoJson)
            });
        }
    } catch (error) {
        if (!isFetchCancelled) {
            console.error(`Error fetching BAG data for ${newMunicipalityCode}:`, error);
            updateBagProgress('Error loading data.');
            lastLoadedMunicipalityCode = null;
        }
    }
}


/**
 * Removes BAG layer from the map
 * @param {Object} map - The Mapbox map instance
 */
export function cleanupBagLayer(map) {
    isFetchCancelled = true; // Signal to stop any ongoing fetches
    cleanupLayers(map, ['bag-verblijfsobjecten-points'], ['bag-verblijfsobjecten']);
    lastLoadedMunicipalityCode = null; // Reset tracking
    updateBagProgress(''); // Clear any lingering messages
}

/**
 * Toggles BAG layer visibility
 * @param {Object} map - The Mapbox map instance
 * @param {Boolean} isVisible - Whether the layer should be visible
 */
export function toggleBagLayer(map, isVisible) {
    if (isVisible) {
        isFetchCancelled = false; // Allow fetching to start/resume
        addBagLayer(map);
    } else {
        isFetchCancelled = true; // Signal to stop fetching
        cleanupBagLayer(map);
    }
    
    // Update state
    State.setShowBagLayer(isVisible);
} 
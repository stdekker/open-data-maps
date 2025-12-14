import { findFirstSymbolLayer, cleanupLayers, getBeforeLayerId, LAYER_ORDER } from '../services/layerService.js';
import * as State from '../state.js';
import * as cache from '../services/cacheService.js';

let lastLoadedMunicipalityCode = null;
let isFetchCancelled = false;
let cachedBagData = null; // In-memory cache for instant restoration
let currentHighlightedStreet = null; // Currently highlighted street name
let currentSelectedFeatureId = null; // Currently selected feature ID
let currentSelectedFeatureCoords = null; // Coordinates of currently selected feature [lng, lat]
let bagPopup = null; // Mapbox popup for address info

// Cache duration: 7 days in milliseconds
const CACHE_DURATION_MS = 100 * 24 * 60 * 60 * 1000;

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
    // Clean up existing BAG layer if it exists, but preserve the cache
    const currentMunicipalityCode = lastLoadedMunicipalityCode;
    const currentCachedData = cachedBagData;
    cleanupBagLayer(map);
    lastLoadedMunicipalityCode = currentMunicipalityCode; // Restore it
    cachedBagData = currentCachedData; // Restore cached data
    
    // Determine the correct position for the BAG layer based on layer ordering
    const beforeLayerId = getBeforeLayerId(map, LAYER_ORDER.BAG);
    
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
            layout: {
                'visibility': 'visible'
            },
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 1,
                    14, 2,
                    18, 6
                ],
                'circle-color': [
                    'case',
                    ['==', ['get', 'status'], 'Verblijfsobject in gebruik'],
                    '#ff6b6b', // In use
                    '#FFD3B9'  // Not in use 
                ],
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': [
                    'case',
                    ['==', ['get', 'status'], 'Verblijfsobject in gebruik'],
                    '#d63384', // In use
                    '#D64D76'  // Not in use
                ]
            }
        }, beforeLayerId);
        
        // Add highlight layer for selected street (rendered on top)
        map.addLayer({
            id: 'bag-verblijfsobjecten-highlight',
            type: 'circle',
            source: 'bag-verblijfsobjecten',
            layout: {
                'visibility': 'visible'
            },
            filter: ['==', ['get', 'openbare_ruimte'], ''], // Initially show nothing
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 1,
                    14, 2,
                    18, 6
                ],
                'circle-color': '#FFD700', // Gold/yellow highlight
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FF8C00' // Dark orange stroke
            }
        });
        
        // Add selected feature layer (white, rendered on top of highlight)
        map.addLayer({
            id: 'bag-verblijfsobjecten-selected',
            type: 'circle',
            source: 'bag-verblijfsobjecten',
            layout: {
                'visibility': 'visible'
            },
            filter: ['==', ['id'], ''], // Initially show nothing
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 1,
                    14, 2,
                    18, 6
                ],
                'circle-color': '#FFFFFF', // White for selected feature
                'circle-opacity': 1.0,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#000000' // Black stroke for contrast
            }
        });

        // Add click listener for showing feature properties and highlighting street
        map.on('click', 'bag-verblijfsobjecten-points', (e) => {
            if (e.features && e.features.length > 0) {
                e.preventDefault();
                const feature = e.features[0];
                const props = feature.properties;
                const streetName = props.openbare_ruimte || '';
                const postcode = props.postcode || '';
                const huisnummer = props.huisnummer || '';
                
                // Clear any existing popup first (without triggering close event handler)
                if (bagPopup) {
                    // Remove event listener before removing to prevent recursive loop
                    bagPopup.off('close');
                    const popup = bagPopup;
                    bagPopup = null;
                    popup.remove();
                }
                
                // Get feature ID from the clicked feature
                // Mapbox GeoJSON sources with generateId: true use array index as ID
                const featureId = feature.id !== undefined && feature.id !== null ? feature.id : e.features[0].id;
                currentSelectedFeatureId = featureId;
                
                // Store the coordinates of the selected feature
                if (feature.geometry && feature.geometry.type === 'Point') {
                    currentSelectedFeatureCoords = feature.geometry.coordinates;
                } else {
                    currentSelectedFeatureCoords = [e.lngLat.lng, e.lngLat.lat];
                }
                
                // Highlight all features with the same street name (immediately switch)
                // Exclude the selected feature from the highlight (it will be white)
                if (streetName && featureId !== undefined && featureId !== null) {
                    currentHighlightedStreet = streetName;
                    // Show same street but exclude the selected feature
                    map.setFilter('bag-verblijfsobjecten-highlight', [
                        'all',
                        ['==', ['get', 'openbare_ruimte'], streetName],
                        ['!=', ['id'], featureId]
                    ]);
                    // Show selected feature in white
                    map.setFilter('bag-verblijfsobjecten-selected', ['==', ['id'], featureId]);
                } else if (streetName) {
                    // Fallback: if no ID, just highlight the street (selected feature won't be white)
                    currentHighlightedStreet = streetName;
                    map.setFilter('bag-verblijfsobjecten-highlight', ['==', ['get', 'openbare_ruimte'], streetName]);
                    map.setFilter('bag-verblijfsobjecten-selected', ['==', ['id'], '']);
                }
                
                // Create popup with address info
                const popupContent = `
                    <div class="bag-popup">
                        <div class="bag-popup-street">${escapeHtml(streetName)}</div>
                        <div class="bag-popup-details">
                            <span class="bag-popup-number">${escapeHtml(huisnummer)}</span>
                            <span class="bag-popup-postcode">${escapeHtml(postcode)}</span>
                        </div>
                    </div>
                `;
                
                bagPopup = new mapboxgl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    className: 'bag-address-popup'
                })
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map);
                
                // Clear highlight when popup is closed
                bagPopup.on('close', () => {
                    clearBagHighlight(map);
                });
            }
        });
        
        // Clear highlight when clicking elsewhere on the map
        map.on('click', (e) => {
            // Check if click was on the BAG layer
            const features = map.queryRenderedFeatures(e.point, { layers: ['bag-verblijfsobjecten-points'] });
            if (features.length === 0 && currentHighlightedStreet) {
                clearBagHighlight(map);
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
 * Escapes HTML special characters for popup content
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Clears the BAG street highlight and closes popup
 * @param {Object} map - The Mapbox map instance
 */
function clearBagHighlight(map) {
    currentHighlightedStreet = null;
    currentSelectedFeatureId = null;
    currentSelectedFeatureCoords = null;
    if (map.getLayer('bag-verblijfsobjecten-highlight')) {
        map.setFilter('bag-verblijfsobjecten-highlight', ['==', ['get', 'openbare_ruimte'], '']);
    }
    if (map.getLayer('bag-verblijfsobjecten-selected')) {
        map.setFilter('bag-verblijfsobjecten-selected', ['==', ['id'], '']);
    }
    if (bagPopup) {
        // Set to null BEFORE remove() to prevent recursive loop
        // (remove() fires 'close' event which would call this function again)
        const popup = bagPopup;
        bagPopup = null;
        popup.remove();
    }
}

/**
 * Gets the coordinates of the currently selected BAG feature
 * @returns {[number, number] | null} [lng, lat] coordinates or null if no feature is selected
 */
export function getSelectedBagFeatureCoords() {
    return currentSelectedFeatureCoords;
}

/**
 * Loads all BAG verblijfsobjecten for a specific municipality.
 * @param {Object} map - The Mapbox map instance.
 * @param {Object|null} municipalityFeature - The GeoJSON feature for the municipality. Null to clear data.
 */
export async function loadBagDataForMunicipality(map, municipalityFeature) {
    const source = map.getSource('bag-verblijfsobjecten');
    if (!source) {
        addBagLayer(map); // Ensure layer and source exist
    }

    if (!municipalityFeature) {
        if (source) {
            source.setData({ type: 'FeatureCollection', features: [] });
        }
        lastLoadedMunicipalityCode = null;
        cachedBagData = null;
        updateBagProgress('');
        return;
    }

    const newMunicipalityCode = municipalityFeature.properties.gemeentecode;
    if (lastLoadedMunicipalityCode === newMunicipalityCode) {
        // If already loaded and data exists in memory, restore it
        if (cachedBagData && source) {
            source.setData(cachedBagData);
        }
        return;
    }
    
    isFetchCancelled = false;
    
    // Check in-memory cache first
    if (cachedBagData && lastLoadedMunicipalityCode === newMunicipalityCode) {
        updateBagProgress('Loading from memory...');
        source.setData(cachedBagData);
        updateBagProgress(`Loaded ${cachedBagData.features.length} buildings from cache.`);
        setTimeout(() => updateBagProgress(''), 2000);
        return;
    }
    
    // Check IndexedDB cache
    updateBagProgress('Checking cache...');
    try {
        const cachedEntry = await cache.get(newMunicipalityCode);
        if (cachedEntry && cachedEntry.data && cachedEntry.timestamp) {
            const age = Date.now() - cachedEntry.timestamp;
            if (age < CACHE_DURATION_MS) {
                // Cache is valid, use it
                updateBagProgress('Loading cached BAG data...');
                cachedBagData = cachedEntry.data;
                lastLoadedMunicipalityCode = newMunicipalityCode;
                source.setData(cachedBagData);
                updateBagProgress(`Loaded ${cachedBagData.features.length} buildings from cache.`);
                setTimeout(() => updateBagProgress(''), 2000);
                return;
            }
        }
    } catch (error) {
        console.warn('Error reading from cache:', error);
        // Continue to fetch from API
    }
    
    lastLoadedMunicipalityCode = newMunicipalityCode;
    source.setData({ type: 'FeatureCollection', features: [] });
    updateBagProgress('Gathering BAG data...');

    try {
        const setProgress = (text) => updateBagProgress(text);

        const initialResponse = await fetch(`api/bag.php?municipality_code=${newMunicipalityCode}`);
        if (isFetchCancelled) return;

        const initialData = await initialResponse.json();

        if (initialData.type === 'FeatureCollection') {
            // Cached data is returned from server
            setProgress('Loading cached BAG data from server...');
            cachedBagData = initialData;
            source.setData(cachedBagData);
            
            // Store in IndexedDB for future use
            try {
                await cache.set(newMunicipalityCode, {
                    data: cachedBagData,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.warn('Error storing to cache:', error);
            }
            
            setProgress(`Loaded ${cachedBagData.features.length} buildings.`);
            setTimeout(() => setProgress(''), 2000);
        } else if (initialData.status === 'fetch_postcodes') {
            // No cache, need to fetch per postcode
            const postcodes = initialData.postcodes;
            if (postcodes.length === 0) {
                setProgress('No postcodes found for BAG data.');
                setTimeout(() => setProgress(''), 2000);
                return;
            }

            let allFeatures = [];
            let loadedCount = 0;

            for (const postcode of postcodes) {
                if (isFetchCancelled) {
                    setProgress('Loading cancelled.');
                    return;
                }

                loadedCount++;
                // Set progress text in one place
                const getProgressText = (extra = '') =>
                    `This may take a while. Loading BAG data from PDOK API for ${postcode}... (${loadedCount}/${postcodes.length})${extra}`;

                setProgress(getProgressText());

                // Small delay to allow UI to update
                await new Promise(resolve => setTimeout(resolve, 100));

                // Fetch all pages for this postcode
                let startIndex = 0;
                let hasMore = true;
                let postcodeFeatureCount = 0;

                while (hasMore && !isFetchCancelled) {
                    const apiUrl = `api/bag.php?postcode4=${postcode}&startIndex=${startIndex}&maxFeatures=1000`;
                    const response = await fetch(apiUrl);
                    if (isFetchCancelled) return;

                    if (!response.ok) {
                        console.warn(`Failed to fetch BAG data for postcode ${postcode} at startIndex ${startIndex}.`);
                        break;
                    }

                    const data = await response.json();
                    if (data.features && data.features.length > 0) {
                        allFeatures.push(...data.features);
                        postcodeFeatureCount += data.features.length;
                        
                        // Update map immediately after each page
                        source.setData({ type: 'FeatureCollection', features: allFeatures });
                        setProgress(getProgressText(` - ${allFeatures.length} buildings loaded`));
                    }

                    // Check if there are more pages
                    if (data.pagination && data.pagination.hasMore) {
                        startIndex = data.pagination.nextStartIndex;
                        hasMore = true;
                    } else {
                        hasMore = false;
                    }

                    // Small delay between pages to prevent overwhelming the server
                    if (hasMore) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                if (postcodeFeatureCount > 0) {
                    console.log(`Loaded ${postcodeFeatureCount} features for postcode ${postcode}`);
                }
            }

            if (isFetchCancelled) return;
            
            // Store in both memory and IndexedDB
            const finalGeoJson = { type: 'FeatureCollection', features: allFeatures };
            cachedBagData = finalGeoJson;
            
            updateBagProgress(`Loaded ${allFeatures.length} buildings.`);
            setTimeout(() => updateBagProgress(''), 2000);

            // Store in IndexedDB for future use
            try {
                await cache.set(newMunicipalityCode, {
                    data: finalGeoJson,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.warn('Error storing to cache:', error);
            }

            // Post the final data to server for caching
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
    
    // Also explicitly clear the source data
    const source = map.getSource('bag-verblijfsobjecten');
    if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
    }

    // Clear highlight and popup
    clearBagHighlight(map);
    
    cleanupLayers(map, ['bag-verblijfsobjecten-points', 'bag-verblijfsobjecten-highlight', 'bag-verblijfsobjecten-selected'], ['bag-verblijfsobjecten']);
    lastLoadedMunicipalityCode = null; // Reset tracking
    cachedBagData = null; // Clear in-memory cache
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
        
        // Make layers visible
        const layer = map.getLayer('bag-verblijfsobjecten-points');
        if (layer) {
            map.setLayoutProperty('bag-verblijfsobjecten-points', 'visibility', 'visible');
        }
        const highlightLayer = map.getLayer('bag-verblijfsobjecten-highlight');
        if (highlightLayer) {
            map.setLayoutProperty('bag-verblijfsobjecten-highlight', 'visibility', 'visible');
        }
        const selectedLayer = map.getLayer('bag-verblijfsobjecten-selected');
        if (selectedLayer) {
            map.setLayoutProperty('bag-verblijfsobjecten-selected', 'visibility', 'visible');
        }
        
        // Restore cached data if available
        if (cachedBagData && lastLoadedMunicipalityCode) {
            const source = map.getSource('bag-verblijfsobjecten');
            if (source) {
                source.setData(cachedBagData);
                updateBagProgress(`Restored ${cachedBagData.features.length} buildings from memory.`);
                setTimeout(() => updateBagProgress(''), 2000);
            }
        }
    } else {
        isFetchCancelled = true; // Signal to stop fetching
        
        // Clear any highlight and popup
        clearBagHighlight(map);
        
        // Instead of cleaning up, just hide the layers
        const layer = map.getLayer('bag-verblijfsobjecten-points');
        if (layer) {
            map.setLayoutProperty('bag-verblijfsobjecten-points', 'visibility', 'none');
        }
        const highlightLayer = map.getLayer('bag-verblijfsobjecten-highlight');
        if (highlightLayer) {
            map.setLayoutProperty('bag-verblijfsobjecten-highlight', 'visibility', 'none');
        }
        const selectedLayer = map.getLayer('bag-verblijfsobjecten-selected');
        if (selectedLayer) {
            map.setLayoutProperty('bag-verblijfsobjecten-selected', 'visibility', 'none');
        }
        
        // Clear progress message
        updateBagProgress('');
        
        // Keep cachedBagData and lastLoadedMunicipalityCode intact for quick restoration
    }
    
    // Update state
    State.setShowBagLayer(isVisible);
} 
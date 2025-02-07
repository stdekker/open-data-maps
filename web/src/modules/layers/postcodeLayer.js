import { cleanupLayers, findFirstSymbolLayer, getDynamicFillColorExpression } from '../layerService.js';

const DB_NAME = 'postcodeDB';
const STORE_NAME = 'postcodes';
const DB_VERSION = 1;

let municipalityPostcodes = new Set();
let shouldCancelPostcodeLoading = false;
let progressMessageElement = null;

const INVALID_VALUES = [-99995, -99997];
let currentStatistic = 'aantalInwoners';

let hoveredPostcodeId = null;
let postcodePopup = null;

function getStatisticText(properties, statType) {
    if (!properties || !statType) return '';
    
    const value = properties[statType];
    // Convert invalid values to 0
    const effectiveValue = (typeof value === 'number' && !isNaN(value) && value !== null)
        ? (INVALID_VALUES.includes(value) ? 0 : value)
        : 0;
    
    let formattedValue;
    if (statType.startsWith('percentage') || statType === 'gemiddeldeHuishoudsgrootte') {
        formattedValue = effectiveValue.toLocaleString('nl-NL', { 
            minimumFractionDigits: 1,
            maximumFractionDigits: 1 
        });
    } else {
        formattedValue = effectiveValue.toLocaleString('nl-NL', { 
            maximumFractionDigits: 0 
        });
    }
    
    return formattedValue;
}

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'postcode4' });
            }
        };
    });
}

// Store postcode data
async function storePostcodeData(postcode4, data) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.put({
            postcode4,
            data,
            timestamp: Date.now()
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Retrieve postcode data
async function getStoredPostcodeData(postcode4) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.get(postcode4);
        
        request.onsuccess = () => {
            const result = request.result;
            // Check if data exists and is less than 24 hours old
            if (result && (Date.now() - result.timestamp) < 24 * 60 * 60 * 1000) {
                resolve(result.data);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Cleans up postcode6 layer and related resources
 * @param {Object} map - The Mapbox map instance
 */
export function cleanupPostcode6Layer(map) {
    if (!map) {
        console.error('Map instance is undefined in cleanupPostcode6Layer');
        return;
    }

    updateProgressMessage(''); // Clear progress message

    try {
        map.off('mouseenter', 'postcode6-fill');
        map.off('mouseleave', 'postcode6-fill');
        map.off('click', 'postcode6-fill');

        cleanupLayers(map, 
            ['postcode6-line', 'postcode6-fill'],
            ['postcode6']
        );

        const postcodeStatsSelector = document.getElementById('postcode-stats-selector');
        if (postcodeStatsSelector) {
            postcodeStatsSelector.style.display = 'none';
        }
    } catch (error) {
        console.error('Error in cleanupPostcode6Layer:', error);
    }
}

/**
 * Loads and displays postcode data on the map
 * @param {Object} map - The Mapbox map instance
 */
export async function loadAllPostcode6Data(map) {
    if (!map) {
        console.error('Map instance is undefined in loadAllPostcode6Data');
        return;
    }

    const postcode6Toggle = document.getElementById('postcode6Toggle');
    shouldCancelPostcodeLoading = false;

    // Setup cancel handler
    const cancelHandler = () => {
        shouldCancelPostcodeLoading = true;
        cleanupPostcode6Layer(map);
    };

    if (postcode6Toggle) {
        postcode6Toggle.addEventListener('change', cancelHandler);
    }

    try {
        // Clean up any existing layers first
        cleanupPostcode6Layer(map);

        // Create a new source and layer for postcode6 data
        map.addSource('postcode6', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        const firstSymbolLayer = findFirstSymbolLayer(map);

        map.addLayer({
            id: 'postcode6-fill',
            type: 'fill',
            source: 'postcode6',
            paint: {
                'fill-color': '#627BC1', // Default color, will be updated when data is loaded
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.8,
                    0.6
                ],
                'fill-outline-color': '#00509e'
            }
        }, firstSymbolLayer);

        map.addLayer({
            id: 'postcode6-line',
            type: 'line',
            source: 'postcode6',
            paint: {
                'line-color': '#666',
                'line-width': 1
            }
        }, firstSymbolLayer);

        // Load data for each postcode in the municipality
        const validPostcodes = Array.from(municipalityPostcodes)
            .filter(code => code && code.length === 4 && /^\d{4}$/.test(code));

        if (validPostcodes.length === 0) {
            console.warn('No valid postcodes found in municipality');
            updateProgressMessage('Geen geldige postcodes gevonden');
            if (postcode6Toggle) {
                postcode6Toggle.checked = false;
            }
            return;
        }

        let loadedCount = 0;
        let allFeatures = [];
        let featureId = 0; // Counter for unique feature IDs

        for (const postcode4 of validPostcodes) {
            if (shouldCancelPostcodeLoading) {
                console.log('Postcode loading cancelled');
                return;
            }

            try {
                // Try to get data from IndexedDB first
                let postcodeData = await getStoredPostcodeData(postcode4);

                if (!postcodeData) {
                    // If not in IndexedDB, fetch from server
                    const response = await fetch(`/api/postcode6.php?postcode4=${postcode4}`);
                    const contentType = response.headers.get('content-type');
                    
                    if (!contentType || !contentType.includes('application/json')) {
                        console.error(`Invalid content type for postcode6 ${postcode4}: ${contentType}`);
                        continue;
                    }

                    const responseData = await response.json();
                    
                    if (!response.ok) {
                        console.error(`Failed to fetch postcode6 data for ${postcode4}:`, responseData.error);
                        continue;
                    }

                    if (!responseData.type || responseData.type !== 'FeatureCollection' || !Array.isArray(responseData.features)) {
                        console.error(`Invalid GeoJSON structure for postcode6 ${postcode4}`);
                        continue;
                    }

                    postcodeData = responseData;
                    // Store in IndexedDB for future use
                    await storePostcodeData(postcode4, postcodeData);
                }

                // Validate the data structure before using it
                if (!postcodeData || !postcodeData.features || !Array.isArray(postcodeData.features)) {
                    console.error(`Invalid data structure for postcode6 ${postcode4}`);
                    continue;
                }

                // Add features to our collection with unique IDs
                if (postcodeData && postcodeData.features) {
                    postcodeData.features.forEach(feature => {
                        feature.id = featureId++; // Assign unique ID to each feature
                        allFeatures.push(feature);
                    });
                }

                loadedCount++;
                updateProgressMessage(`Laden postcode gebieden: ${loadedCount}/${validPostcodes.length}`);

                // Update the source data periodically to show progress
                if (loadedCount % 5 === 0 || loadedCount === validPostcodes.length) {
                    const source = map.getSource('postcode6');
                    if (source) {
                        source.setData({
                            type: 'FeatureCollection',
                            features: allFeatures
                        });
                    }
                }

            } catch (error) {
                console.error(`Error processing postcode6 ${postcode4}:`, error);
                continue;
            }
        }

        // Final update with all features
        const finalData = {
            type: 'FeatureCollection',
            features: allFeatures
        };
        
        const source = map.getSource('postcode6');
        if (source) {
            source.setData(finalData);
        }

        if (postcode6Toggle.checked && loadedCount === validPostcodes.length) {
            updateProgressMessage('Postcode gebieden geladen');
            setTimeout(() => {
                if (postcode6Toggle.checked) {
                    updateProgressMessage('');
                }
            }, 2000);
        }

        const postcodeStatsSelector = document.getElementById('postcode-stats-selector');
        if (postcodeStatsSelector && allFeatures.length > 0) {
            postcodeStatsSelector.style.display = 'block';
            populateStatisticsDropdown(allFeatures);
            updatePostcodeColors(map);
        }

        // Add hover effect for visual feedback only
        map.on('mouseenter', 'postcode6-fill', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            
            if (hoveredPostcodeId !== null) {
                try {
                    map.setFeatureState(
                        { source: 'postcode6', id: hoveredPostcodeId },
                        { hover: false }
                    );
                } catch (error) {
                    console.warn('Could not reset hover state:', error);
                }
            }

            if (e.features.length > 0) {
                const feature = e.features[0];
                if (feature.id !== undefined) {
                    hoveredPostcodeId = feature.id;
                    try {
                        map.setFeatureState(
                            { source: 'postcode6', id: hoveredPostcodeId },
                            { hover: true }
                        );
                    } catch (error) {
                        console.warn('Could not set hover state:', error);
                    }
                }
            }
        });

        map.on('mouseleave', 'postcode6-fill', () => {
            map.getCanvas().style.cursor = '';
            
            if (hoveredPostcodeId !== null) {
                try {
                    map.setFeatureState(
                        { source: 'postcode6', id: hoveredPostcodeId },
                        { hover: false }
                    );
                } catch (error) {
                    console.warn('Could not reset hover state:', error);
                }
            }
            hoveredPostcodeId = null;
        });

        // Add click handler for popup
        map.on('click', 'postcode6-fill', (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const statValue = getStatisticText(feature.properties, currentStatistic);
                
                if (statValue) {
                    if (!postcodePopup) {
                        postcodePopup = new mapboxgl.Popup({
                            closeButton: true,
                            className: 'postcode-popup'
                        });
                    }

                    const html = `
                        <div class="popup-content">
                            <strong>${feature.properties.postcode6}</strong>
                            <br>
                            ${statValue}
                        </div>
                    `;
                    
                    postcodePopup
                        .setLngLat(e.lngLat)
                        .setHTML(html)
                        .addTo(map);
                }
            }
        });

    } catch (error) {
        console.error('Error in loadAllPostcode6Data:', error);
        updateProgressMessage('Fout bij laden van postcode data');
        cleanupPostcode6Layer(map);
        if (postcode6Toggle) {
            postcode6Toggle.checked = false;
        }
    } finally {
        if (postcode6Toggle) {
            postcode6Toggle.removeEventListener('change', cancelHandler);
        }
    }
}

/**
 * Updates the progress message element
 * @param {String} message - The message to display
 */
function updateProgressMessage(message) {
    if (!progressMessageElement) {
        progressMessageElement = document.getElementById('postcode-progress');
    }
    if (progressMessageElement) {
        progressMessageElement.textContent = message;
        progressMessageElement.style.display = message ? 'block' : 'none';
    }
}

/**
 * Resets the postcode6 toggle to unchecked state
 */
export function resetPostcode6Toggle() {
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    if (postcode6Toggle) {
        postcode6Toggle.checked = false;
    }
}

/**
 * Updates the toggle states based on view type
 * @param {String} viewType - The type of view ('national' or 'municipal')
 */
export function updateToggleStates(viewType) {
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    
    if (viewType === 'national') {
        if (postcode6Toggle) {
            postcode6Toggle.checked = false;
            postcode6Toggle.disabled = true;
        }
    } else {
        if (postcode6Toggle) {
            postcode6Toggle.disabled = false;
            postcode6Toggle.checked = false; // Always start with postcode layer off
        }
    }
}

/**
 * Sets the municipality postcodes for filtering
 * @param {Object} geoJsonData - The GeoJSON data containing municipality features
 */
export function setMunicipalityPostcodes(geoJsonData) {
    municipalityPostcodes.clear();
    geoJsonData.features.forEach(feature => {
        if (feature.properties.meestVoorkomendePostcode) {
            const postcode4 = feature.properties.meestVoorkomendePostcode.substring(0, 4);
            // Only add valid 4-digit postcodes
            if (postcode4 && postcode4.length === 4 && /^\d{4}$/.test(postcode4)) {
                municipalityPostcodes.add(postcode4);
            }
        }
    });
}

/**
 * Initializes the postcode6 toggle functionality
 * @param {Object} mapInstance - The Mapbox map instance
 */
export function initializePostcode6Toggle(mapInstance) {
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    if (!postcode6Toggle) {
        console.error('Postcode6 toggle element not found in DOM');
        return;
    }
    
    if (postcode6Toggle.checked) {
        loadAllPostcode6Data(mapInstance);
    }

    postcode6Toggle.addEventListener('change', async (event) => {
        // If we're in national view, prevent the toggle from being changed
        if (window.currentView === 'national') {
            event.preventDefault();
            postcode6Toggle.checked = false;
            postcode6Toggle.disabled = true;
            return;
        }

        if (postcode6Toggle.checked) {
            await loadAllPostcode6Data(mapInstance);
        } else {
            cleanupPostcode6Layer(mapInstance);
        }
    });
}

function getValidStatistics(features) {
    const stats = new Map(); // Use Map to track which statistics have valid values
    
    features.forEach(feature => {
        Object.entries(feature.properties).forEach(([key, value]) => {
            // If we haven't seen a valid value for this stat yet, check this feature
            if (!stats.has(key) && typeof value === 'number' && !INVALID_VALUES.includes(value)) {
                stats.set(key, true);
            }
        });
    });
    
    return Array.from(stats.keys());
}

function populateStatisticsDropdown(features) {
    const statsSelect = document.getElementById('postcodeStatsSelect');
    if (!statsSelect) return;

    // Get all valid statistics from all features
    const validStats = getValidStatistics(features);
    
    if (validStats.length === 0) {
        console.warn('No valid statistics found in postcode data');
        return;
    }
    
    // Clear existing options
    statsSelect.innerHTML = '';
    
    // Sort statistics alphabetically
    validStats.sort();
    
    // Add options for each valid statistic
    validStats.forEach(stat => {
        const option = document.createElement('option');
        option.value = stat;
        option.textContent = stat;
        statsSelect.appendChild(option);
    });
    
    // Set default value if it exists in valid stats, otherwise use first available
    if (validStats.includes(currentStatistic)) {
        statsSelect.value = currentStatistic;
    } else {
        currentStatistic = validStats[0];
        statsSelect.value = currentStatistic;
    }
    
    // Remove old event listeners before adding new one
    const newStatsSelect = statsSelect.cloneNode(true);
    statsSelect.parentNode.replaceChild(newStatsSelect, statsSelect);
    
    // Add change handler
    newStatsSelect.addEventListener('change', (event) => {
        currentStatistic = event.target.value;
        updatePostcodeColors(map);
    });
}

function updatePostcodeColors(map) {
    if (!map.getLayer('postcode6-fill')) return;
    
    const source = map.getSource('postcode6');
    if (source) {
        const data = source._data;
        const paintProperty = getDynamicFillColorExpression(data, currentStatistic);
        map.setPaintProperty('postcode6-fill', 'fill-color', paintProperty);
    }
} 
import { cleanupLayers, findFirstSymbolLayer } from '../layerService.js';

const DB_NAME = 'postcodeDB';
const STORE_NAME = 'postcodes';
const DB_VERSION = 1;

let municipalityPostcodes = new Set();
let shouldCancelPostcodeLoading = false;
let progressMessageElement = null;

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
        console.error('Map instance is undefined');
        return;
    }

    shouldCancelPostcodeLoading = false;
    updateProgressMessage('Initialiseren postcode data...');

    const postcode6Toggle = document.getElementById('postcode6Toggle');
    const cancelHandler = () => {
        if (!postcode6Toggle.checked) {
            shouldCancelPostcodeLoading = true;
            updateProgressMessage('');
            cleanupPostcode6Layer(map);
        }
    };

    try {
        if (!map.loaded()) {
            await new Promise(resolve => {
                if (map.loaded()) {
                    resolve();
                } else {
                    map.once('load', resolve);
                }
            });
        }

        postcode6Toggle.addEventListener('change', cancelHandler);

        cleanupPostcode6Layer(map);

        const validPostcodes = Array.from(municipalityPostcodes).filter(code => 
            code && code.length === 4 && /^\d{4}$/.test(code)
        );

        if (validPostcodes.length === 0 || !postcode6Toggle.checked) {
            updateProgressMessage('');
            return;
        }

        updateProgressMessage('Laden van postcode gebieden...');

        if (!map.getSource('postcode6') && postcode6Toggle.checked) {
            map.addSource('postcode6', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
        }

        const beforeLayerId = findFirstSymbolLayer(map);

        if (!map.getLayer('postcode6-fill')) {
            map.addLayer({
                'id': 'postcode6-fill',
                'type': 'fill',
                'source': 'postcode6',
                'paint': {
                    'fill-color': '#627BC1',
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.5,
                        0.3
                    ]
                }
            }, beforeLayerId);
        }

        if (!map.getLayer('postcode6-line')) {
            map.addLayer({
                'id': 'postcode6-line',
                'type': 'line',
                'source': 'postcode6',
                'paint': {
                    'line-color': '#627BC1',
                    'line-width': 1,
                    'line-opacity': 0.3
                }
            }, beforeLayerId);
        }

        let allFeatures = [];
        let featureId = 0;
        let loadedCount = 0;

        // Process postcodes one at a time
        for (let i = 0; i < validPostcodes.length; i++) {
            if (!postcode6Toggle.checked) {
                updateProgressMessage('');
                break;
            }

            const postcode4 = validPostcodes[i];
            try {
                updateProgressMessage(`Laden van postcodegebied ${postcode4}... (${loadedCount}/${validPostcodes.length})`);
                
                // Try to get cached data first
                let data = await getStoredPostcodeData(postcode4);
                
                // If not in cache, fetch it
                if (!data) {
                    const response = await fetch(`api/postcode6.php?postcode4=${postcode4}`);
                    if (!response.ok) {
                        console.warn(`Failed to fetch postcode6 data for ${postcode4}: ${response.status}`);
                        continue;
                    }
                    data = await response.json();
                    
                    if (!data || !data.features) {
                        console.warn(`Invalid data received for postcode ${postcode4}`);
                        continue;
                    }

                    // Store the fetched data
                    await storePostcodeData(postcode4, data);
                }

                if (!postcode6Toggle.checked) {
                    updateProgressMessage('');
                    break;
                }

                // Process features
                if (data.features) {
                    data.features.forEach(feature => {
                        feature.id = featureId++;
                        allFeatures.push(feature);
                    });
                    loadedCount++;
                }

                updateProgressMessage(`Laden van postcodegebieden... (${loadedCount}/${validPostcodes.length})`);

                if (map.getSource('postcode6') && postcode6Toggle.checked) {
                    map.getSource('postcode6').setData({
                        type: 'FeatureCollection',
                        features: allFeatures
                    });
                }
            } catch (error) {
                console.error(`Error processing postcode6 ${postcode4}:`, error);
                continue;
            }
        }

        if (postcode6Toggle.checked && loadedCount === validPostcodes.length) {
            updateProgressMessage('Postcode gebieden geladen');
            setTimeout(() => {
                if (postcode6Toggle.checked) {
                    updateProgressMessage('');
                }
            }, 2000);
        }

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
            municipalityPostcodes.add(postcode4);
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
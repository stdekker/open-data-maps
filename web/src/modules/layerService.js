import { setupReportingUnitPopupHandlers } from './electionService.js';
import { populateStatisticsSelect } from './UIFeatureInfoBox.js';

let municipalityPostcodes = new Set();

const DB_NAME = 'postcodeDB';
const STORE_NAME = 'postcodes';
const DB_VERSION = 1;

// State variables 
let previousElectionState = false;
let shouldCancelPostcodeLoading = false;
let progressMessageElement = null;

/**
 * Returns the min and max values for a given statistic from the features array.
 *
 * @param {Object} geoJsonData - The GeoJSON data.
 * @param {String} statisticKey - The property key to look for in features.
 * @returns {Array} [minValue, maxValue]
 */
function getMinMaxFromGeoJson(geoJsonData, statisticKey) {
    const values = geoJsonData.features.map(f => f.properties[statisticKey])
        .filter(val => typeof val === 'number' && !isNaN(val) && val !== null);

    if (!values.length) {
        // No valid numeric data; fallback
        return [0, 0];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // If they are the same, create an artificial range to avoid domain errors
    if (minValue === maxValue) {
        return [minValue, minValue + 1];
    }

    return [minValue, maxValue];
}

/**
 * Updates the map colors based on the selected statistic
 * @param {Object} map - The Mapbox map instance
 * @param {String} statisticKey - The statistic key to color by
 */
export function updateMapColors(map, statisticKey) {
    if (map.getSource('municipalities')) {
        const source = map.getSource('municipalities');
        const data = source._data; // Get current GeoJSON data
        const fillColorExpression = getDynamicFillColorExpression(data, statisticKey);
        map.setPaintProperty('municipalities', 'fill-color', fillColorExpression);
    }
}

/**
 * Builds a dynamic 'fill-color' expression for Mapbox GL
 * such that the smallest value is lightest and the largest is darkest.
 *
 * @param {Object} geoJsonData     - The full GeoJSON data.
 * @param {String} statisticKey    - The property key to color by (e.g., "aantalInwoners").
 * @returns {Array} Mapbox GL Style expression for 'fill-color'.
 */
export function getDynamicFillColorExpression(geoJsonData, statisticKey) {
    const [minValue, maxValue] = getMinMaxFromGeoJson(geoJsonData, statisticKey);

    // Create a chroma scale from lightest to darkest
    const colorScale = chroma
        .scale(['#add8e6', '#4682b4', '#00008b'])
        .domain([minValue, maxValue])
        .mode('lab');

    // Here we construct a single expression which checks for hover,
    // then uses the scale's color for that data value.
    // We "brighten" colors a bit on hover.
    return [
        'case',
        // If hovered
        ['boolean', ['feature-state', 'hover'], false],
        [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', statisticKey], 0],
            minValue, colorScale(minValue).brighten().hex(),
            maxValue, colorScale(maxValue).brighten().hex()
        ],
        // Else (not hovered)
        [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', statisticKey], 0],
            minValue, colorScale(minValue).hex(),
            maxValue, colorScale(maxValue).hex()
        ]
    ];
}

/**
 * Adds municipality layers to the map with dynamic coloring based on statistics.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing municipality features
 * @param {Object} municipalityPopulations - Population data for municipalities
 * @param {String} statisticKey - The statistic to use for coloring (e.g. 'aantalInwoners')
 */
export function addMapLayers(map, geoJsonData, municipalityPopulations, statisticKey = 'aantalInwoners') {
    // Only clean up postcode6 layer if it exists
    if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-line') || map.getSource('postcode6')) {
        console.log('Cleaning up existing postcode6 layers in addMapLayers...');
        cleanupPostcode6Layer(map);
    }
    resetPostcode6Toggle();
    
    // Collect all unique postcode4 values from features
    municipalityPostcodes.clear();
    geoJsonData.features.forEach(feature => {
        if (feature.properties.meestVoorkomendePostcode) {
            const postcode4 = feature.properties.meestVoorkomendePostcode.substring(0, 4);
            municipalityPostcodes.add(postcode4);
        }
    });

    // Clean up existing layers and sources first
    const layersToRemove = ['municipality-borders', 'municipalities'];
    layersToRemove.forEach(layer => {
        if (map.getLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    if (map.getSource('municipalities')) {
        map.removeSource('municipalities');
    }

    // Get all existing layers
    const layers = map.getStyle().layers;
    
    // Find the first symbol layer in the map style
    let firstSymbolId;
    for (const layer of layers) {
        if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
        }
    }

    // Add the GeoJSON source immediately
    map.addSource('municipalities', {
        type: 'geojson',
        data: geoJsonData,
        generateId: true
    });

    // Populate statistics select with available data
    const statsSelect = document.getElementById('statsSelect');
    populateStatisticsSelect(statsSelect, geoJsonData);

    // Get a dynamic fill-color expression for this statisticKey
    const fillColorExpression = getDynamicFillColorExpression(geoJsonData, statisticKey);

    // Add GeoJSON geometry layers before symbol layers
    map.addLayer({
        'id': 'municipalities',
        'type': 'fill',
        'source': 'municipalities',
        'paint': {
            'fill-color': fillColorExpression,
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.8,
                0.6
            ],
            'fill-outline-color': '#00509e'
        }
    }, firstSymbolId);

    map.addLayer({
        'id': 'municipality-borders',
        'type': 'line',
        'source': 'municipalities',
        'paint': {
            'line-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#99c2ff',
                '#00509e'
            ],
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                2,
                1
            ]
        }
    }, firstSymbolId);
}

/**
 * Adds election reporting unit markers to the map.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing reporting unit locations
 * @param {Boolean} showElectionData - Whether election data should be displayed
 */
export function addReportingUnits(map, geoJsonData, showElectionData = false) {
    // Clean up existing reporting units first, before adding new ones
    cleanupReportingUnits(map);
    
    if (!showElectionData || !geoJsonData || !geoJsonData.features || !geoJsonData.features.length) {
        return;
    }

    if (map.getSource('reporting-units')) {
        // Update the data of the existing source
        map.getSource('reporting-units').setData(geoJsonData);
    } else {
        // Add the reporting units source with original data
        map.addSource('reporting-units', {
            type: 'geojson',
            data: geoJsonData
        });

        // Add reporting units layer with dynamic radius
        map.addLayer({
            'id': 'reporting-units',
            'type': 'circle',
            'source': 'reporting-units',
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['get', 'totalCounted'],
                    0, 6,
                    500, 8,
                    2000, 12,
                    5000, 16,
                    10000, 22,
                    20000, 30
                ],
                'circle-color': '#4CAF50',
                'circle-opacity': 0.6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        });

        // Setup popup handlers
        setupReportingUnitPopupHandlers(map);
    }
}

/**
 * Removes all reporting unit layers and sources from the map.
 * Used when switching views or cleaning up old election data.
 * @param {Object} map - The Mapbox map instance
 */
export function cleanupReportingUnits(map) {
    try {
        // Only remove layers if they exist
        if (map.getLayer('reporting-units')) {
            map.removeLayer('reporting-units');
        }
        if (map.getLayer('reporting-units-fill')) {
            map.removeLayer('reporting-units-fill');
        }
        if (map.getLayer('reporting-units-line')) {
            map.removeLayer('reporting-units-line');
        }
        if (map.getSource('reporting-units')) {
            map.removeSource('reporting-units');
        }
    } catch (error) {
        console.warn('Error cleaning up reporting units:', error);
    }
}

// Add new function to initialize postcode6 toggle
export function initializePostcode6Toggle(mapInstance) {
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    if (!postcode6Toggle) {
        console.error('Postcode6 toggle element not found in DOM');
        return;
    }
    
    if (postcode6Toggle.checked) {
        loadAllPostcode6Data(mapInstance);
    }

    postcode6Toggle.addEventListener('change', async () => {
        if (postcode6Toggle.checked) {
            await loadAllPostcode6Data(mapInstance);
        } else {
            cleanupPostcode6Layer(mapInstance);
        }
    });
}

// Modify the cleanupPostcode6Layer function
export function cleanupPostcode6Layer(map) {
    if (!map) {
        console.error('Map instance is undefined in cleanupPostcode6Layer');
        return;
    }

    updateProgressMessage(''); // Clear progress message

    const hasPostcode6Layers = map.getLayer('postcode6-fill') || map.getLayer('postcode6-line');
    const hasPostcode6Source = map.getSource('postcode6');

    if (!hasPostcode6Layers && !hasPostcode6Source) {
        return;
    }

    try {
        map.off('mouseenter', 'postcode6-fill');
        map.off('mouseleave', 'postcode6-fill');
        map.off('click', 'postcode6-fill');

        ['postcode6-line', 'postcode6-fill'].forEach(layerId => {
            if (map.getLayer(layerId)) {
                try {
                    map.removeLayer(layerId);
                } catch (e) {
                    console.warn(`Failed to remove layer ${layerId}:`, e);
                }
            }
        });

        if (hasPostcode6Source) {
            try {
                map.removeSource('postcode6');
            } catch (e) {
                console.warn('Failed to remove postcode6 source:', e);
            }
        }
    } catch (error) {
        console.error('Error in cleanupPostcode6Layer:', error);
    }
}

// Add function to initialize IndexedDB
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

// Add function to store postcode data
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

// Add function to retrieve postcode data
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

// Modify the loadAllPostcode6Data function
async function loadAllPostcode6Data(map) {
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
            if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-line') || map.getSource('postcode6')) {
                cleanupPostcode6Layer(map);
            }
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

        if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-line') || map.getSource('postcode6')) {
            cleanupPostcode6Layer(map);
        }

        const validPostcodes = Array.from(municipalityPostcodes).filter(code => 
            code && code.length === 4 && /^\d{4}$/.test(code)
        );

        if (validPostcodes.length === 0) {
            updateProgressMessage('');
            return;
        }

        if (!postcode6Toggle.checked) {
            updateProgressMessage('');
            return;
        }

        updateProgressMessage('Laden van postcode gebieden...');

        if (!map.getSource('postcode6') && postcode6Toggle.checked) {
            try {
                map.addSource('postcode6', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                });
            } catch (error) {
                console.error('Error adding postcode6 source:', error);
                updateProgressMessage('Fout bij laden van postcode data');
                return;
            }
        }

        let beforeLayerId = null;
        const layers = map.getStyle().layers;
        for (const layer of layers) {
            if (layer.id === 'reporting-units' || layer.type === 'symbol') {
                beforeLayerId = layer.id;
                break;
            }
        }

        if (!map.getLayer('postcode6-fill')) {
            try {
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
            } catch (error) {
                console.error('Error adding postcode6-fill layer:', error);
            }
        }

        if (!map.getLayer('postcode6-line')) {
            try {
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
            } catch (error) {
                console.error('Error adding postcode6-line layer:', error);
            }
        }

        let allFeatures = [];
        let featureId = 0;
        let loadedCount = 0;

        for (const postcode4 of validPostcodes) {
            if (!postcode6Toggle.checked) {
                updateProgressMessage('');
                break;
            }

            try {
                updateProgressMessage(`Laden van postcodegebied ${postcode4}... (${loadedCount}/${validPostcodes.length})`);
                let data = await getStoredPostcodeData(postcode4);
                
                if (!data) {
                    const response = await fetch(`api/postcode6.php?postcode4=${postcode4}`);
                    if (!response.ok) {
                        console.warn(`Failed to fetch postcode6 data for ${postcode4}: ${response.status}`);
                        continue;
                    }
                    data = await response.json();
                    
                    if (!data || !data.features) {
                        console.warn(`Invalid data received for postcode4 ${postcode4}`);
                        continue;
                    }
                    
                    await storePostcodeData(postcode4, data);
                }
                
                if (!postcode6Toggle.checked) {
                    updateProgressMessage('');
                    break;
                }

                data.features.forEach(feature => {
                    feature.id = featureId++;
                    allFeatures.push(feature);
                });

                loadedCount++;
                updateProgressMessage(`Laden van postcodegebieden... (${loadedCount}/${validPostcodes.length})`);

                if (map.getSource('postcode6') && postcode6Toggle.checked) {
                    try {
                        map.getSource('postcode6').setData({
                            type: 'FeatureCollection',
                            features: allFeatures
                        });
                    } catch (error) {
                        console.error('Error updating postcode6 source data:', error);
                    }
                }
            } catch (error) {
                console.error(`Error processing postcode6 data for ${postcode4}:`, error);
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
        if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-line') || map.getSource('postcode6')) {
            cleanupPostcode6Layer(map);
        }
        if (postcode6Toggle) {
            postcode6Toggle.checked = false;
        }
    } finally {
        if (postcode6Toggle) {
            postcode6Toggle.removeEventListener('change', cancelHandler);
        }
    }
}

// Add this function near the top with other exports
export function resetPostcode6Toggle() {
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    if (postcode6Toggle) {
        postcode6Toggle.checked = false;
    }
}

// Add this function to handle toggle states
export function updateToggleStates(viewType) {
    const electionToggle = document.getElementById('electionToggle');
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    
    if (viewType === 'national') {
        // Store election state before disabling
        if (electionToggle) {
            previousElectionState = electionToggle.checked;
            electionToggle.checked = false;
            electionToggle.disabled = true;
        }
        if (postcode6Toggle) {
            postcode6Toggle.checked = false;
            postcode6Toggle.disabled = true;
        }
        // Update showElectionData state temporarily
        window.showElectionData = false;
    } else {
        // Enable toggles in municipal view
        if (electionToggle) {
            electionToggle.disabled = false;
            // Restore previous election state
            electionToggle.checked = previousElectionState;
            window.showElectionData = previousElectionState;
            localStorage.setItem('showElectionData', previousElectionState);
        }
        if (postcode6Toggle) {
            postcode6Toggle.disabled = false;
            postcode6Toggle.checked = false; // Always start with postcode layer off
        }
    }
} 

function updateProgressMessage(message) {
    if (!progressMessageElement) {
        progressMessageElement = document.getElementById('postcode-progress');
    }
    if (progressMessageElement) {
        progressMessageElement.textContent = message;
        progressMessageElement.style.display = message ? 'block' : 'none';
    }
} 
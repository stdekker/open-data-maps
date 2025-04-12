import { cleanupLayers, findFirstSymbolLayer, getDynamicFillColorExpression, addMapLayers } from '../layerService.js';
import { Modal } from '../modalService.js';
import { INVALID_VALUES, STYLE_VARIANTS, updateLayerColors } from '../colorService.js';

const DB_NAME = 'postcodeDB';
const STORE_NAME = 'postcodes';
const DB_VERSION = 1;

let municipalityPostcodes = new Set();
let shouldCancelPostcodeLoading = false;
let progressMessageElement = null;

let currentStatistic = 'aantalInwoners';

let hoveredPostcodeId = null;
let postcodePopup = null;
let postcodeStatsModal;
let modalHtmlAdded = false;

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
        map.off('mousemove', 'postcode6-fill');
        map.off('mouseleave', 'postcode6-fill');
        map.off('click', 'postcode6-fill');

        cleanupLayers(map, 
            ['postcode6-fill', 'postcode6-borders', 'postcode6-hover'],
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

    // Setup cancel handler (now listens for the toggle becoming inactive)
    const cancelHandler = () => {
        // Check if the toggle is now inactive
        if (postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'false') {
            shouldCancelPostcodeLoading = true;
            cleanupPostcode6Layer(map);

            // Remove this specific listener once cancellation is triggered
            postcode6Toggle.removeEventListener('click', cancelHandler);
            postcode6Toggle.removeEventListener('keydown', handleCancelKeydown);
        }
    };

    // Keydown handler specifically for cancellation
    const handleCancelKeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Simulate click to trigger cancelHandler if state becomes false
            if (postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true') {
                // If it's currently true, a click/enter would toggle it to false
                // Manually call cleanup as the state hasn't changed yet in the main handler
                shouldCancelPostcodeLoading = true;
                cleanupPostcode6Layer(map);
                postcode6Toggle.removeEventListener('click', cancelHandler);
                postcode6Toggle.removeEventListener('keydown', handleCancelKeydown);
            }
        }
    };

    if (postcode6Toggle) {
        // Add temporary listeners to handle cancellation if user toggles off during load
        postcode6Toggle.addEventListener('click', cancelHandler);
        postcode6Toggle.addEventListener('keydown', handleCancelKeydown);
    }

    try {
        // Ensure modal HTML exists at layer initialization
        ensureModalHtmlExists();

        // Clean up any existing layers first
        cleanupPostcode6Layer(map);

        // Create a new source for postcode6 data
        map.addSource('postcode6', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            },
            generateId: true
        });

        const firstSymbolLayer = findFirstSymbolLayer(map);

        // Define minimal configuration for the generic addMapLayers function
        const postcodeLayerConfig = {
            idBase: 'postcode6',
            source: 'postcode6',
            data: { features: [] }, // Empty features array initially
            statisticKey: currentStatistic,
            styleVariant: STYLE_VARIANTS.DYNAMIC_RANGE,
            insertBeforeLayer: firstSymbolLayer
        };

        // Add postcode layers using the generic function
        addMapLayers(map, postcodeLayerConfig);

        // If postcodes are empty, wait a short time for potential async loading (from wijken view)
        if (municipalityPostcodes.size === 0) {
            updateProgressMessage('Wachten op postcode data...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Load data for each postcode in the municipality
        const validPostcodes = Array.from(municipalityPostcodes)
            .filter(code => code && code.length === 4 && /^\d{4}$/.test(code));

        if (validPostcodes.length === 0) {
            console.warn('No valid postcodes found in municipality');
            updateProgressMessage('Geen geldige postcodes gevonden');
            // Reset the toggle state visually if needed (handled by resetPostcode6Toggle call usually)
            resetPostcode6Toggle();
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
                    const response = await fetch(`api/postcode6.php?postcode4=${postcode4}`);
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

        // Final update with all features and update color expression
        const finalData = {
            type: 'FeatureCollection',
            features: allFeatures
        };
        
        const source = map.getSource('postcode6');
        if (source) {
            source.setData(finalData);
            // Update the fill color expression now that we have data
            const updatedFillColorExpression = getDynamicFillColorExpression(finalData, currentStatistic);
            map.setPaintProperty('postcode6-fill', 'fill-color', updatedFillColorExpression);
        }

        // Check aria-pressed state after loading completes
        const isToggleActive = postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true';
        if (isToggleActive && loadedCount === validPostcodes.length) {
            updateProgressMessage('Postcode gebieden geladen');
            setTimeout(() => {
                // Check again in case it was toggled off during the timeout
                if (postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true') {
                    updateProgressMessage('');
                }
            }, 2000);
        }

        const postcodeStatsSelector = document.getElementById('postcode-stats-selector');
        if (postcodeStatsSelector && allFeatures.length > 0) {
            postcodeStatsSelector.style.display = 'block';
            populateStatisticsDropdown(allFeatures);
            updatePostcodeColors(map, currentStatistic);
        }

        // Remove previous hover state if any
        if (hoveredPostcodeId !== null) {
            try {
                 map.setFeatureState({ source: 'postcode6', id: hoveredPostcodeId }, { hover: false });
            } catch (e) { /* Ignore */ }
            hoveredPostcodeId = null;
        }

        // Add hover effect using feature state
        map.on('mousemove', 'postcode6-fill', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features.length > 0) {
                const currentFeatureId = e.features[0].id;
                if (hoveredPostcodeId !== null && hoveredPostcodeId !== currentFeatureId) {
                    try {
                        map.setFeatureState({ source: 'postcode6', id: hoveredPostcodeId }, { hover: false });
                    } catch (error) {
                        // console.warn('Could not reset previous hover state:', error); 
                    }
                }
                hoveredPostcodeId = currentFeatureId;
                try {
                    map.setFeatureState({ source: 'postcode6', id: hoveredPostcodeId }, { hover: true });
                } catch (error) {
                    // console.warn('Could not set hover state:', error); 
                }
            }
        });

        map.on('mouseleave', 'postcode6-fill', () => {
            map.getCanvas().style.cursor = '';
            if (hoveredPostcodeId !== null) {
                try {
                    map.setFeatureState({ source: 'postcode6', id: hoveredPostcodeId }, { hover: false });
                } catch (error) {
                    // console.warn('Could not reset hover state on mouseleave:', error); 
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

                    // Create popup content with clickable title
                    const html = `
                        <div class="popup-content">
                            <strong>${feature.properties.postcode6}</strong>
                            <br>
                            ${statValue}
                            <br>
                            <a href="#" class="postcode-more-link">meer...</a>
                        </div>
                    `;
                    
                    postcodePopup
                        .setLngLat(e.lngLat)
                        .setHTML(html)
                        .addTo(map);

                    // Ensure modal HTML exists before creating Modal instance
                    ensureModalHtmlExists();

                    // Initialize modal if not already done
                    if (!postcodeStatsModal) {
                        postcodeStatsModal = new Modal('postcode-stats-modal');
                    }

                    // Add click handler for the title link after a short delay to ensure DOM is updated
                    setTimeout(() => {
                        const popup = document.querySelector('.postcode-popup');
                        if (popup) {
                            const moreLink = popup.querySelector('.postcode-more-link');
                            if (moreLink) {
                                moreLink.addEventListener('click', (event) => {
                                    event.preventDefault();
                                    const content = createPostcodeStatsContent(feature);
                                    postcodeStatsModal.open(`Postcode ${feature.properties.postcode6}`, content);
                                });
                            }
                        }
                    }, 0);
                }
            }
        });

    } catch (error) {
        console.error('Error in loadAllPostcode6Data:', error);
        updateProgressMessage('Fout bij laden van postcode data');
        cleanupPostcode6Layer(map);
        resetPostcode6Toggle();
    } finally {
        if (postcode6Toggle) {
            // Clean up cancellation listeners regardless of success/failure
            postcode6Toggle.removeEventListener('click', cancelHandler);
            postcode6Toggle.removeEventListener('keydown', handleCancelKeydown);
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
        postcode6Toggle.setAttribute('aria-pressed', 'false');
    }
}

/**
 * Updates the toggle states based on view type
 * @param {String} viewType - The type of view ('national' or 'municipal')
 */
export function updateToggleStates(viewType) {
    // Helper to update a single toggle's disabled state and UI
    const updateSingleToggle = (toggleId, isDisabled) => {
        const toggleElement = document.getElementById(toggleId);
        if (!toggleElement) return;

        toggleElement.setAttribute('aria-disabled', isDisabled);
        if (isDisabled) {
            toggleElement.classList.add('disabled');
            toggleElement.removeAttribute('tabindex');
        } else {
            toggleElement.classList.remove('disabled');
            toggleElement.setAttribute('tabindex', '0');
        }
    };

    const postcode6Toggle = document.getElementById('postcode6Toggle');
    
    const isNational = viewType === 'national';

    // Update postcode toggle
    updateSingleToggle('postcode6Toggle', isNational);
    if (isNational && postcode6Toggle) {
        // Ensure it's visually off in national view
        postcode6Toggle.setAttribute('aria-pressed', 'false');
    }

    // Note: The main.js activateView function handles enabling/disabling
    // municipalityToggle and electionToggle directly using its own updateToggleUI.
    // This function now only needs to handle toggles specific to layerService modules,
    // like the postcode6 toggle.
}

/**
 * Sets the municipality postcodes for filtering
 * @param {Object} geoJsonData - The GeoJSON data containing municipality features
 */
export function setMunicipalityPostcodes(geoJsonData) {
    municipalityPostcodes.clear();
    
    // Check if we have valid postcode data in the current geoJsonData
    let hasValidPostcodes = false;
    
    geoJsonData.features.forEach(feature => {
        if (feature.properties.meestVoorkomendePostcode) {
            const postcode4 = feature.properties.meestVoorkomendePostcode.substring(0, 4);
            // Only add valid 4-digit postcodes
            if (postcode4 && postcode4.length === 4 && /^\d{4}$/.test(postcode4)) {
                municipalityPostcodes.add(postcode4);
                hasValidPostcodes = true;
            }
        }
    });
    
    // If no valid postcodes found and we're likely in wijken view, 
    // get them from the buurten data
    if (!hasValidPostcodes && window.currentView === 'municipal') {
        const lastMunicipality = localStorage.getItem('lastMunicipality');
        if (lastMunicipality) {
            const municipality = JSON.parse(lastMunicipality);
            
            // Fetch buurten data specifically to get postcodes, regardless of current view type
            fetch(`api/municipality.php?code=${municipality.code}&type=buurten`)
                .then(response => response.json())
                .then(buurtenData => {
                    if (buurtenData && buurtenData.features) {
                        buurtenData.features.forEach(feature => {
                            if (feature.properties.meestVoorkomendePostcode) {
                                const postcode4 = feature.properties.meestVoorkomendePostcode.substring(0, 4);
                                // Only add valid 4-digit postcodes
                                if (postcode4 && postcode4.length === 4 && /^\d{4}$/.test(postcode4)) {
                                    municipalityPostcodes.add(postcode4);
                                }
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error fetching buurten data for postcodes:', error);
                });
        }
    }
}

/**
 * Initializes the postcode6 toggle functionality
 * @param {Object} mapInstance - The Mapbox map instance
 */
export function initializePostcode6Toggle(mapInstance) {
    // This function now assumes the main.js handler manages the aria-pressed state.
    // It only needs to react to state changes if necessary, or be triggered externally.
    // Let's simplify: We will modify main.js to call load/cleanup directly.
    // So, this function might just become a placeholder or be removed if not needed elsewhere.

    // --- Keeping the structure for now, but the event listener needs adjustment --- 
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    if (!postcode6Toggle) {
        console.error('Postcode6 toggle element not found in DOM');
        return;
    }

    // Initial load check (if the page loads with the toggle active)
    if (postcode6Toggle.getAttribute('aria-pressed') === 'true' && window.currentView === 'municipal') {
        loadAllPostcode6Data(mapInstance);
    }

    // The actual toggle logic (loading/cleanup) should be triggered by the central
    // handler in main.js based on the 'data-layer' attribute.
    // We remove the standalone listener here.
    /*
    const handleInteraction = async (event) => {
        // If we're in national view, prevent the toggle from being changed
        if (window.currentView === 'national') {
            // This check should ideally happen in the main handler
            event.preventDefault();
            // updateToggleUI(postcode6Toggle, false, true); // Handled by activateView
            return;
        }

        const isActive = postcode6Toggle.getAttribute('aria-pressed') === 'true';

        // Important: The main handler should update aria-pressed *before* this logic runs
        // or this handler needs to manage it.

        if (isActive) {
            await loadAllPostcode6Data(mapInstance);
        } else {
            cleanupPostcode6Layer(mapInstance);
        }
    };

    postcode6Toggle.addEventListener('click', handleInteraction);
    postcode6Toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Manually toggle state for keydown before calling handler
            const currentState = postcode6Toggle.getAttribute('aria-pressed') === 'true';
            postcode6Toggle.setAttribute('aria-pressed', !currentState);
            handleInteraction(e);
        }
    });
    */
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
        updatePostcodeColors(map, currentStatistic);
    });
}

// Update the createPostcodeStatsContent function to remove the duplicate title
function createPostcodeStatsContent(feature) {
    if (!feature || !feature.properties) return '';
    
    const validStats = Object.entries(feature.properties)
        .filter(([key, value]) => 
            typeof value === 'number' && 
            !isNaN(value) && 
            !INVALID_VALUES.includes(value) &&
            !key.startsWith('party_votes_') // Exclude party vote properties
        );

    if (validStats.length === 0) return '<p>Geen statistieken beschikbaar</p>';

    return `
        <div class="postcode-stats-detail">
            <div class="stats-grid">
                ${validStats.map(([key, value]) => `
                    <div class="stat-item">
                        <span class="stat-label">${key}:</span>
                        <span class="stat-value">${getStatisticText(feature.properties, key)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Add this new function to create and add the modal HTML
function ensureModalHtmlExists() {
    if (modalHtmlAdded) return;
    
    // The modal HTML structure already exists in index.php, 
    // we just need to track that we've initialized
    modalHtmlAdded = true;
}

/**
 * Updates colors for the postcode layer using the style system
 * @param {Object} map - The Mapbox map instance
 * @param {String} statisticKey - The statistic key to color by
 * @param {String} styleVariant - Style variant to use (default: DYNAMIC_RANGE)
 */
export function updatePostcodeColors(map, statisticKey, styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE) {
    // Use the common updateLayerColors function with postcode-specific options
    updateLayerColors(
        map, 
        statisticKey, 
        'postcode6', 
        'postcode6', 
        styleVariant, 
        { hoverBorderColor: '#8aa0d1' }
    );
} 
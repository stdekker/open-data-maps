// Import configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';
import { loadElectionData } from './modules/electionService.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';
import { initializeMobileHandler } from './modules/mobileHandler.js';
import { addMapLayers, addReportingUnits, cleanupReportingUnits, setupFeatureNameBox } from './modules/layerDrawingService.js';
import { initializeElectionService } from './modules/electionService.js';
import { Modal } from './modules/modalService.js';
import { ensurePopulationData, loadOverviewData, loadGeoJsonData } from './modules/dataService.js';

let showElectionData = false;
let currentView = 'national';
let settingsModal;
let helpModal;

// Declare municipalityPopulations and feature name elements at the top
let municipalityPopulations = {};
let featureNameContent;
let featureNameBox;

// Map initialization
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Initialize map but don't add layers yet
const map = new mapboxgl.Map({
    container: 'map',
    style: MAP_STYLE,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    pitchWithRotate: false,
    dragRotate: false,
});

// Wait for both map and data to load before proceeding
map.on('load', async () => {
    try {
        // Process URL parameters first
        const params = getUrlParams();
        const data = await loadOverviewData();
        
        // Clear any existing layers before proceeding
        cleanupReportingUnits(map);
        if (map.getLayer('municipalities')) {
            map.removeLayer('municipalities');
        }
        if (map.getLayer('municipality-borders')) {
            map.removeLayer('municipality-borders');
        }
        if (map.getSource('municipalities')) {
            map.removeSource('municipalities');
        }

        let municipality = null;

        if (params.gemeente) {
            municipality = data.gemeenten.find(m => 
                m.naam.toLowerCase() === params.gemeente.toLowerCase()
            );
            
            // If URL parameter is invalid, clear it
            if (!municipality) {
                updateUrlParams(null);
            }
        }

        if (!municipality) {
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                municipality = JSON.parse(lastMunicipality);
            } else {
                municipality = data.gemeenten.find(m => 
                    m.naam === DEFAULT_MUNICIPALITY
                );
            }
        }

        // Wait for population data to be loaded
        await ensurePopulationData(municipalityPopulations);

        if (municipality) {
            await selectMunicipality(municipality);
        } else {
            // If no municipality is selected, show national view
            await loadNationalGeoJson();
        }

        const searchInput = document.getElementById('searchInput');
        const autocompleteList = document.getElementById('autocompleteList');

        setupSearch(searchInput, autocompleteList, data);

        // Initialize featureNameContent and featureNameBox after the DOM is ready
        featureNameContent = document.querySelector('.feature-name-content');
        featureNameBox = document.querySelector('.feature-name-box');

        // Check if featureNameContent and featureNameBox are initialized
        if (featureNameContent && featureNameBox) {
            // Initial call to update the feature name box
            updateFeatureNameBox();
        } else {
            console.error('Feature name content or box element not found.');
        }
    } catch (error) {
        console.error('Error during map initialization:', error);
    }
});

/**
 * Sets up the search functionality for municipalities.
 * Handles autocomplete suggestions and municipality selection.
 * @param {HTMLElement} searchInput - The search input element
 * @param {HTMLElement} autocompleteList - The autocomplete suggestions container
 * @param {Object} data - Municipality data for searching
 */
function setupSearch(searchInput, autocompleteList, data) {
    searchInput.addEventListener('input', function() {
        const value = this.value.trim().toLowerCase();
        autocompleteList.innerHTML = '';
        const searchError = document.querySelector('.search-error');
        
        if (value.length < 2) {
            searchError.classList.remove('visible');
            return;
        }

        const matches = data.gemeenten.filter(municipality => 
            municipality.naam.toLowerCase().includes(value)
        );

        if (matches.length === 0) {
            searchError.classList.add('visible');
        } else {
            searchError.classList.remove('visible');
        }

        matches.forEach(municipality => {
            const div = document.createElement('div');
            div.textContent = municipality.naam;
            div.addEventListener('click', () => {
                selectMunicipality(municipality, searchInput, autocompleteList);
            });
            autocompleteList.appendChild(div);
        });
    });

    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            const value = this.value.trim().toLowerCase();
            const matches = data.gemeenten.filter(municipality => 
                municipality.naam.toLowerCase().includes(value)
            );
            
            // First try to find an exact match
            const exactMatch = data.gemeenten.find(municipality =>
                municipality.naam.toLowerCase() === value
            );

            if (exactMatch) {
                // If there's an exact match, use that
                selectMunicipality(exactMatch, searchInput, document.getElementById('autocompleteList'));
            } else if (matches.length === 1) {
                // If there's only one partial match, use that
                selectMunicipality(matches[0], searchInput, document.getElementById('autocompleteList'));
            }
        }
    });
}

function initialMunicipalitySelection(data) {
    const params = getUrlParams();
    let municipality = null;
    
    if (params.gemeente) {
        municipality = data.gemeenten.find(m => 
            m.naam.toLowerCase() === params.gemeente.toLowerCase()
        );
    }
    
    if (!municipality) {
        const lastMunicipality = localStorage.getItem('lastMunicipality');
        if (lastMunicipality) {
            municipality = JSON.parse(lastMunicipality);
        } else {
            municipality = data.gemeenten.find(m => 
                m.naam === DEFAULT_MUNICIPALITY
            );
        }
    }
    
    if (municipality) {
        selectMunicipality(municipality);
    }
}

/**
 * Handles selection of a municipality.
 * Updates the UI, stores the selection, and loads municipality data.
 * @param {Object} municipality - The selected municipality object
 */
async function selectMunicipality(municipality) {
    const searchInput = document.getElementById('searchInput');
    const autocompleteList = document.getElementById('autocompleteList');
    const searchError = document.querySelector('.search-error');
 
    activateView('municipal', municipality.code);
    
    // Interface updates
    autocompleteList.innerHTML = '';
    searchError.classList.remove('visible');
    
    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
    updateUrlParams(municipality.naam);

    // Hide keyboard on mobile devices
    searchInput.blur();

    setTimeout(() => {
        searchInput.value = '';
    }, 585);

    // Update the feature name box with the selected municipality
    updateFeatureNameBox();

    // Wait for data loading to complete
    await loadGeoJson(municipality.code);
    if (showElectionData) {
        await loadElectionData(municipality.code, localStorage.getItem('lastElection') || 'TK2021');
    }
}

// ===== GeoJSON Loading & Display =====
/**
 * Loads and displays GeoJSON data for a municipality or region.
 * Sets up map layers and fits the view to the loaded data.
 * @param {String} code - The municipality/region code to load
 */
function loadGeoJson(code) {
    if (!map.loaded()) {
        map.on('load', () => loadGeoJson(code));
        return;
    }
    cleanupReportingUnits(map);

    Promise.all([
        loadGeoJsonData(code),
        loadElectionData(code)
    ])
    .then(([geoJsonData]) => {
        const geoJsonDataWithIds = {
            ...geoJsonData,
            features: geoJsonData.features.map((feature, index) => ({
                ...feature,
                id: index
            }))
        };
        addMapLayers(map, geoJsonDataWithIds, municipalityPopulations);
        setupFeatureNameBox(map, municipalityPopulations);

        // Fit bounds to the loaded GeoJSON
        try {
            const bounds = new mapboxgl.LngLatBounds();
            geoJsonDataWithIds.features.forEach(feature => {
                if (feature.geometry.type === 'Polygon') {
                    feature.geometry.coordinates[0].forEach(coord => {
                        bounds.extend(coord);
                    });
                } else if (feature.geometry.type === 'MultiPolygon') {
                    feature.geometry.coordinates.forEach(polygon => {
                        polygon[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    });
                }
            });
            
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 64 });
            }
        } catch (e) {
            console.error('Error fitting bounds:', e);
        }
    })
    .catch(error => console.error('Error loading data:', error));
}

// Add click handlers for menu items
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    settingsModal = new Modal('settings-modal');
    window.settingsModal = settingsModal;
    helpModal = new Modal('help-modal');

    // Add settings button handler
    const settingsButton = document.querySelector('.settings-button');
    settingsButton.addEventListener('click', () => {
        settingsModal.open('Settings');
    });

    // Add help button handler
    const helpButton = document.querySelector('.help-button');
    helpButton.addEventListener('click', () => {
        helpModal.openFromUrl('Help', 'content/help.php');
    });

    const menuItems = document.querySelectorAll('.menu-items li');
    const initialMenuItem = document.getElementById(DEFAULT_MENU_ITEM);

    if (initialMenuItem) {
        handleMenuItemActivation.call(initialMenuItem);
    }
    // Add keyboard support
    menuItems.forEach(item => {
        // Click handler
        item.addEventListener('click', handleMenuItemActivation);
        
        // Keyboard handler
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMenuItemActivation.call(item);
            }
        });
    });

    function handleMenuItemActivation() {
        // Remove active class and aria-selected from all items
        menuItems.forEach(i => {
            i.classList.remove('active');
        });
        
        // Add active class
        this.classList.add('active');
        
        if (this.id === 'national-view') {
            activateView('national');
        } else if (this.id === 'municipal-view') {
            activateView('municipal');
        }
    }

    // Add election toggle handler
    const electionToggle = document.getElementById('electionToggle');
    const statsView = document.querySelector('.stats-view');
    
    // Restore toggle state from localStorage
    showElectionData = localStorage.getItem('showElectionData') === 'true';
    electionToggle.checked = showElectionData;
    statsView.style.display = showElectionData ? 'block' : 'none';

    electionToggle.addEventListener('change', function() {
        showElectionData = this.checked;
        localStorage.setItem('showElectionData', showElectionData);
        statsView.style.display = showElectionData ? 'block' : 'none';
        
        if (showElectionData) {
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                const municipality = JSON.parse(lastMunicipality);
                const currentElection = localStorage.getItem('lastElection') || 'TK2021';
                // Only load election data if we're in municipal view
                if (currentView === 'municipal') {
                    loadElectionData(municipality.code, currentElection);
                }
            }
        } else {
            // Clean up reporting units when toggling off
            cleanupReportingUnits(map);
        }
    });

    // Initialize mobile handler
    initializeMobileHandler();
});

// Ensure population data is loaded before using it
ensurePopulationData(municipalityPopulations);

/**
 * Activates either the national or municipal view.
 * Updates menu state and loads appropriate data.
 * @param {String} viewType - Either 'national' or 'municipal'
 * @param {String} municipalityCode - Optional municipality code for municipal view
 */
function activateView(viewType, municipalityCode = null) {
    // Update current view
    currentView = viewType;

    // Update menu item states
    const viewItem = document.getElementById(`${viewType}-view`);
    document.querySelectorAll('.menu-items li').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    viewItem.classList.add('active');
    viewItem.setAttribute('aria-selected', 'true');

    // Clear and hide stats view when switching to national view
    const statsView = document.querySelector('.stats-view');
    if (viewType === 'national') {
        statsView.innerHTML = '';
        statsView.style.display = 'none';
        updateUrlParams(null); // Remove gemeente parameter
        
        // Load national view first, then clean up reporting units
        loadNationalGeoJson().then(() => {
            cleanupReportingUnits(map);
            map.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM });
        });
    } else if (viewType === 'municipal') {
        statsView.style.display = showElectionData ? 'block' : 'none';
        ensurePopulationData(municipalityPopulations).then(() => {
            if (municipalityCode) {
                loadGeoJson(municipalityCode);
                if (showElectionData) {
                    loadElectionData(municipalityCode, localStorage.getItem('lastElection') || 'TK2021');
                }
            } else {
                const lastMunicipality = localStorage.getItem('lastMunicipality');
                if (lastMunicipality) {
                    const municipality = JSON.parse(lastMunicipality);
                    loadGeoJson(municipality.code);
                    if (showElectionData) {
                        loadElectionData(municipality.code, localStorage.getItem('lastElection') || 'TK2021');
                    }
                }
            }
        });
    }
}

// Modify the loadNationalGeoJson function
function loadNationalGeoJson() {
    // Check if map is loaded
    if (!map.loaded()) {
        return new Promise(resolve => {
            map.on('load', () => {
                loadNationalGeoJson().then(resolve);
            });
        });
    }

    // Remove any existing event listeners to prevent duplicates
    map.off('dblclick', 'municipalities');

    return fetch('data/gemeenten.json')
        .then(response => response.json())
        .then(data => {
            // Store both population and household data
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = {
                    aantalInwoners: feature.properties.aantalInwoners,
                    aantalHuishoudens: feature.properties.aantalHuishoudens
                };
            });
            
            // Convert coordinates and add layers
            const geoJsonData = {
                ...data,
                features: data.features.map((feature, index) => ({
                    ...feature,
                    id: index,
                    geometry: {
                        type: feature.geometry.type,
                        coordinates: feature.geometry.coordinates
                    }
                }))
            };

            addMapLayers(map, geoJsonData, municipalityPopulations);
            setupFeatureNameBox(map, municipalityPopulations);

            // Remove previous double-click handler if it exists
            map.off('dblclick', 'municipalities');

            // Add the double-click handler
            map.on('dblclick', 'municipalities', (e) => {
                // Only handle double-click if we're in national view
                if (currentView !== 'national') {
                    return;
                }

                e.preventDefault();
                
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    const municipality = {
                        naam: feature.properties.gemeentenaam,
                        code: feature.properties.gemeentecode
                    };
                    
                    // Update menu state
                    const municipalView = document.getElementById('municipal-view');
                    document.querySelectorAll('.menu-items li').forEach(item => {
                        item.classList.remove('active');
                    });
                    municipalView.classList.add('active');

                    // Switch to municipal view
                    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
                    activateView('municipal', municipality.code);
                }
            });

            // When loading all municipalities, fit bounds to show all municipalities
            try {
                const bounds = new mapboxgl.LngLatBounds();
                geoJsonData.features.forEach(feature => {
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach(polygon => {
                            polygon[0].forEach(coord => {
                                bounds.extend(coord);
                            });
                        });
                    }
                });

                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 64 });
                }
            } catch (e) {
                console.error('Error fitting bounds:', e);
            }

            return data; // Return the data to indicate completion
        })
        .catch(error => {
            console.error('Error loading gemeenten data:', error);
            throw error;
        });
}

// Update the event listener for reporting units
window.addEventListener('reportingUnitsLoaded', (event) => {
    const { geoJsonData } = event.detail;
    addReportingUnits(map, geoJsonData, showElectionData);
});

// Update the feature name box to include the total of the selected statistic
function updateFeatureNameBox(feature = null) {
    if (!featureNameContent || !featureNameBox) {
        console.error('Feature name content or box element is not initialized.');
        return;
    }

    const storedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality'))
        : null;

    // Get statsSelect and check if it exists
    const statsSelect = document.getElementById('statsSelect');
    if (!statsSelect) {
        console.error('Stats select element not found.');
        return;
    }

    const selectedStat = statsSelect.value;

    const getNameWithStat = (name, properties) => {
        const statValue = properties[selectedStat];
        // Only format and show the value if it exists
        if (statValue !== undefined && statValue !== null) {
            let formattedValue;
            if (typeof statValue === 'number') {
                // Format numbers consistently
                if (selectedStat.startsWith('percentage')) {
                    // Format percentages with 1 decimal place
                    formattedValue = statValue.toLocaleString('nl-NL', { 
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1 
                    });
                } else if (selectedStat === 'gemiddeldeHuishoudsgrootte') {
                    // Format average household size with 1 decimal place
                    formattedValue = statValue.toLocaleString('nl-NL', { 
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1 
                    });
                } else {
                    // Format other numbers as integers
                    formattedValue = statValue.toLocaleString('nl-NL', { 
                        maximumFractionDigits: 0 
                    });
                }
            } else {
                formattedValue = statValue;
            }
            return `${name} (${formattedValue})`;
        }
        return name; // Return just the name if no statistic is available
    };

    let content = '';
    if (storedMunicipality) {
        const municipalityData = municipalityPopulations[storedMunicipality.code];
        if (municipalityData) {
            content = `<div>${getNameWithStat(storedMunicipality.naam, municipalityData)}</div>`;
        }
    }

    if (feature) {
        const currentGemeentenaam = feature.properties.gemeentenaam || storedMunicipality?.naam;
        if (currentGemeentenaam && (!storedMunicipality || currentGemeentenaam !== storedMunicipality.naam)) {
            content = `<div>${getNameWithStat(currentGemeentenaam, feature.properties)}</div>`;
        }
        if (feature.properties?.buurtnaam) {
            content += `<div class="hovered-name">${getNameWithStat(feature.properties.buurtnaam, feature.properties)}</div>`;
        }
    }

    featureNameContent.innerHTML = content;
    featureNameBox.style.display = content ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize feature name elements
    featureNameContent = document.querySelector('.feature-name-content');
    featureNameBox = document.querySelector('.feature-name-box');
    
    if (!featureNameContent || !featureNameBox) {
        console.error('Feature name elements not found in DOM');
    }
});

// Add event listener for popstate to handle back/forward navigation
window.addEventListener('popstate', async () => {
    const params = getUrlParams();
    if (params.gemeente) {
        const data = await loadOverviewData();
        const municipality = data.gemeenten.find(m => 
            m.naam.toLowerCase() === params.gemeente.toLowerCase()
        );
        if (municipality) {
            selectMunicipality(municipality);
        }
    }
});
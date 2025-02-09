// Import configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';
import { Modal } from './modules/modalService.js';
import { fetchData } from './modules/dataService.js';
import { initializeMobileHandler } from './modules/mobileHandler.js';
import { addMunicipalityLayers, addReportingUnits, cleanupReportingUnits, updateToggleStates, cleanupPostcode6Layer, initializePostcode6Toggle } 
    from './modules/layerService.js';
import { setupFeatureNameBox, updateFeatureNameBox } from './modules/UIFeatureInfoBox.js';
import { loadElectionData } from './modules/electionService.js';

let showElectionData = false;
let settingsModal;
let helpModal;
let municipalityPopulations = {};
let municipalityData = null;

// Map initialization
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
const map = new mapboxgl.Map({
    container: 'map',
    style: MAP_STYLE,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    pitchWithRotate: false,
    dragRotate: false,
    animationDuration: 1500
});

// Global variables
window.map = map;
window.currentView = 'national';

// Load municipality data first, then proceed with map initialization
async function initializeMapAndData() {
    try {
        // Load municipality data first
        const response = await fetch('data/gemeenten.json');
        municipalityData = await response.json();

        // Store both population and household data
        municipalityData.features.forEach(feature => {
            municipalityPopulations[feature.properties.gemeentecode] = {
                aantalInwoners: feature.properties.aantalInwoners,
                aantalHuishoudens: feature.properties.aantalHuishoudens,
                ...feature.properties // Include all properties for comprehensive data access
            };
        });

        // Make the data globally available
        window.municipalityData = municipalityData;
        window.municipalityPopulations = municipalityPopulations;

        // Process URL parameters
        const params = getUrlParams();

        // Create simplified data structure for search
        const data = {
            gemeenten: municipalityData.features.map(feature => ({
                naam: feature.properties.gemeentenaam,
                code: feature.properties.gemeentecode
            })).sort((a, b) => a.naam.localeCompare(b.naam))
        };

        // Initialize search functionality
        setupSearch(data);
        
        // Initialize election toggle based on URL parameter or localStorage
        const electionToggle = document.getElementById('electionToggle');
        
        // URL parameter takes precedence over localStorage
        if (params.elections !== null) {
            showElectionData = params.elections;
            localStorage.setItem('showElectionData', showElectionData);
        } else {
            showElectionData = localStorage.getItem('showElectionData') === 'true';
        }
        
        electionToggle.checked = showElectionData;

        const statsView = document.querySelector('.stats-view');
        statsView.style.display = showElectionData ? 'block' : 'none';

        // Initialize the map on the municipality from the URL parameter or localStorage
        let municipality = null;

        // If URL parameter is not an existing or valid municipality, clear it
        if (params.gemeente && !(municipality = data.gemeenten.find(m => 
            m.naam.toLowerCase() === params.gemeente.toLowerCase()
        ))) {
            updateUrlParams(null);
        }

        // If no municipality is chosen through the url or localStorage, 
        // show the default municipality
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
            await viewMunicipality(municipality);
        } else {
            // If no municipality is selected, show national view
            await viewNational();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Map and data need to be loaded before proceeding
await map.on('load', initializeMapAndData);

/**
 * Sets up the search functionality for municipalities.
 * Handles autocomplete suggestions and municipality selection.
 * @param {Object} data - Municipality data for searching
 */
function setupSearch(data) {
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
                viewMunicipality(municipality, searchInput, autocompleteList);
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
                viewMunicipality(exactMatch, searchInput, document.getElementById('autocompleteList'));
            } else if (matches.length === 1) {
                // If there's only one partial match, use that
                viewMunicipality(matches[0], searchInput, document.getElementById('autocompleteList'));
            }
        }
    });
}

/**
 * Handles the display of the municipality View
 * Updates the UI, stores the selection, and loads municipality data.
 * @param {Object} municipality - The selected municipality object
 */
async function viewMunicipality(municipality) {
    const searchInput = document.getElementById('searchInput');
    const autocompleteList = document.getElementById('autocompleteList');
    const searchError = document.querySelector('.search-error');
 
    activateView('municipal', municipality.code);
    
    // Interface updates
    autocompleteList.innerHTML = '';
    searchError.classList.remove('visible');
    
    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
    updateUrlParams(municipality.naam, showElectionData);

    // Hide keyboard on mobile devices
    searchInput.blur();

    setTimeout(() => {
        searchInput.value = '';
    }, 585);

    // Update the feature name box with the selected municipality
    updateFeatureNameBox();

    // Wait for data loading to complete
    await loadGeoJson(municipality.code);
}

// Modify the viewNational function
async function viewNational() {
    try {
        // Remove any existing event listeners to prevent duplicates
        if (map.getLayer('municipalities')) {
            map.off('dblclick', 'municipalities');
        }

        // Convert coordinates and add layers using the already loaded data
        const geoJsonData = {
            ...municipalityData,
            features: municipalityData.features.map((feature, index) => ({
                ...feature,
                id: index,
                geometry: {
                    type: feature.geometry.type,
                    coordinates: feature.geometry.coordinates
                }
            }))
        };

        // Add new layers
        addMunicipalityLayers(map, geoJsonData, municipalityPopulations);
        setupFeatureNameBox(map, municipalityPopulations);

        // Add double-click handler for municipality selection
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
                
                // Store selected municipality
                localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
                
                // Switch to municipal view
                activateView('municipal', municipality.code);
            }
        });

        return municipalityData;
    } catch (error) {
        console.error('Error loading national view:', error);
        throw error;
    }
}

// ===== GeoJSON Loading & Display =====
/**
 * Loads and displays GeoJSON data for a municipality or region.
 * Sets up map layers and fits the view to the loaded data.
 * @param {String} code - The municipality/region code to load
 */
function loadGeoJson(code) {
    return new Promise((resolve, reject) => {
        if (!map.loaded()) {
            map.on('load', () => {
                Promise.all([
                    fetchData(`api/municipality.php?code=${code}`),
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
                    addMunicipalityLayers(map, geoJsonDataWithIds, municipalityPopulations);
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

                    resolve();
                })
                .catch(error => {
                    console.error('Error loading data:', error);
                    reject(error);
                });
            });
            return;
        }

        // If map IS already loaded, do the same fetch/add, and resolve
        Promise.all([
            fetchData(`api/municipality.php?code=${code}`),
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
            addMunicipalityLayers(map, geoJsonDataWithIds, municipalityPopulations);
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

            resolve();
        })
        .catch(error => {
            console.error('Error loading data:', error);
            reject(error);
        });
    });
}

// Add click handlers for menu items
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    settingsModal = new Modal('settings-modal');
    window.settingsModal = settingsModal;
    helpModal = new Modal('help-modal');

    // Initialize postcode6 toggle with map instance
    initializePostcode6Toggle(map);

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
    
    // Restore toggle state from localStorage or URL parameter
    const params = getUrlParams();
    if (params.elections !== null) {
        showElectionData = params.elections;
        localStorage.setItem('showElectionData', showElectionData);
    } else {
        showElectionData = localStorage.getItem('showElectionData') === 'true';
    }
    electionToggle.checked = showElectionData;
    statsView.style.display = showElectionData ? 'block' : 'none';

    electionToggle.addEventListener('change', function() {
        showElectionData = this.checked;
        localStorage.setItem('showElectionData', showElectionData);
        statsView.style.display = showElectionData ? 'block' : 'none';
        
        // Update URL parameter
        const lastMunicipality = localStorage.getItem('lastMunicipality');
        if (lastMunicipality) {
            const municipality = JSON.parse(lastMunicipality);
            updateUrlParams(municipality.naam, showElectionData);
        } else {
            updateUrlParams(null, showElectionData);
        }
        
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

    // Add municipality toggle handler
    const municipalityToggle = document.getElementById('municipalityToggle');
    municipalityToggle.addEventListener('change', function() {
        const isVisible = this.checked;
        if (map.getLayer('municipalities')) {
            map.setLayoutProperty('municipalities', 'visibility', isVisible ? 'visible' : 'none');
            map.setLayoutProperty('municipality-borders', 'visibility', isVisible ? 'visible' : 'none');
        }
        localStorage.setItem('showMunicipalityLayer', isVisible);
    });

    // Restore municipality layer visibility state
    const showMunicipalityLayer = localStorage.getItem('showMunicipalityLayer') !== 'false';
    municipalityToggle.checked = showMunicipalityLayer;
    if (map.getLayer('municipalities')) {
        map.setLayoutProperty('municipalities', 'visibility', showMunicipalityLayer ? 'visible' : 'none');
        map.setLayoutProperty('municipality-borders', 'visibility', showMunicipalityLayer ? 'visible' : 'none');
    }

    // Initialize mobile handler
    initializeMobileHandler();
});

/**
 * Activates either the national or municipal view.
 * Updates menu state and loads appropriate data.
 * @param {String} viewType - Either 'national' or 'municipal'
 * @param {String} municipalityCode - Optional municipality code for municipal view
 */
async function activateView(viewType, municipalityCode = null) {
    // Update menu item states
    const viewItem = document.getElementById(`${viewType}-view`);
    document.querySelectorAll('.menu-items li').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    
    viewItem.classList.add('active');
    viewItem.setAttribute('aria-selected', 'true');
    
    // Update current view
    currentView = viewType;  
    window.currentView = viewType; // Update global view
    
    if (viewType === 'national') {
        try {
            // Store current election state in localStorage before switching
            localStorage.setItem('previousElectionState', showElectionData);
            
            // Only clean up postcode6 layer if it exists
            if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-line')) {
                cleanupPostcode6Layer(map);
            }
            
            // Clean up reporting units
            cleanupReportingUnits(map);
            
            // Hide stats view
            const statsView = document.querySelector('.stats-view');
            statsView.innerHTML = '';
            statsView.style.display = 'none';
            
            // Load national view and update map
            await viewNational();
            
            // Ensure map is centered correctly
            map.flyTo({ 
                center: MAP_CENTER, 
                zoom: MAP_ZOOM,
                duration: 1500 // 1 second animation
            });
    
            // Remove gemeente parameter from URL
            updateUrlParams(null);
    
            // --- Update sidebar toggles for national view ---
            const electionToggle = document.getElementById('electionToggle');
            const municipalityToggle = document.getElementById('municipalityToggle');
            if (electionToggle) {
                electionToggle.disabled = true;
                electionToggle.checked = false; // No election data in national view
            }
            if (municipalityToggle) {
                municipalityToggle.disabled = true;
                municipalityToggle.checked = true; // National view always shows municipalities
            }
            // Update other toggles (e.g., postcode6) via layerService
            updateToggleStates(viewType);
    
            return; // Exit early after national view is set up
        } catch (error) {
            console.error('Error switching to national view:', error);
        }
    }
    
    if (viewType === 'municipal') {      
        // Restore election state from localStorage
        showElectionData = localStorage.getItem('showElectionData') === 'true'; // ALWAYS from localStorage
        const electionToggle = document.getElementById('electionToggle'); // Get the toggle
        if (electionToggle) {
            electionToggle.checked = showElectionData; // Sync the toggle
        }

        const code = municipalityCode || (JSON.parse(localStorage.getItem('lastMunicipality'))?.code);
        if (code) {
            await loadGeoJson(code);
            if (showElectionData) {
                await loadElectionData(code, localStorage.getItem('lastElection') || 'TK2023');
            }
            // Force the municipality layers to be visible
            if (map.getLayer('municipalities')) {
                map.setLayoutProperty('municipalities', 'visibility', 'visible');
                map.setLayoutProperty('municipality-borders', 'visibility', 'visible');
            }
            // Override any stored state so that buurten toggle is always on
            localStorage.setItem('showMunicipalityLayer','true');
        }
    
        // Show stats view if election toggle is checked
        const statsView = document.querySelector('.stats-view');
        statsView.style.display = showElectionData ? 'block' : 'none';
        
        // --- Update sidebar toggles for municipal view ---
        //const electionToggle = document.getElementById('electionToggle'); // ALREADY DEFINED ABOVE
        const municipalityToggle = document.getElementById('municipalityToggle');
        if (electionToggle) {
            electionToggle.disabled = false;
            //electionToggle.checked = !!showElectionData; // ALREADY DONE ABOVE
        }
        if (municipalityToggle) {
            municipalityToggle.disabled = false;
            municipalityToggle.checked = true;
        }

        // Explicitly add or remove reporting units based on showElectionData
        if (showElectionData) {
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                const municipality = JSON.parse(lastMunicipality);
                // Re-fetch the election data to get the geoJsonData
                loadElectionData(municipality.code, localStorage.getItem('lastElection') || 'TK2021')
                .then(() => {
                    // The 'reportingUnitsLoaded' event will trigger addReportingUnits
                });
            }
        } else {
            cleanupReportingUnits(map);
        }
    }
    
    // Update additional toggles (e.g., postcode6) based on the view type
    updateToggleStates(viewType);
}

// Update the event listener for reporting units
window.addEventListener('reportingUnitsLoaded', (event) => {
    const { geoJsonData } = event.detail;
    addReportingUnits(map, geoJsonData, showElectionData);
});

/**
 * Loads a municipality by name, handling both initial load and URL parameter changes.
 * @param {string} municipalityName - The name of the municipality to load.
 */
async function loadMunicipalityByName(municipalityName) {
    if (!municipalityData) {
        // If municipalityData isn't loaded yet, wait for it.
        await initializeMapAndData();
    }

    const municipality = municipalityData.features.find(feature =>
        feature.properties.gemeentenaam.toLowerCase() === municipalityName.toLowerCase()
    );

    if (municipality) {
        await viewMunicipality({
            naam: municipality.properties.gemeentenaam,
            code: municipality.properties.gemeentecode
        });
    } else {
        console.warn(`Municipality not found: ${municipalityName}`);
        // Optionally, you could show an error message to the user here.
        viewNational(); // Fallback to national view
    }
}

// Add event listener for popstate to handle back/forward navigation
window.addEventListener('popstate', async (event) => {
    const params = getUrlParams();

    // Handle elections parameter
    if (params.elections !== null) {
        showElectionData = params.elections;
        localStorage.setItem('showElectionData', showElectionData);

        const electionToggle = document.getElementById('electionToggle');
        if (electionToggle) {
            electionToggle.checked = showElectionData;
        }

        const statsView = document.querySelector('.stats-view');
        if (statsView) {
            statsView.style.display = showElectionData ? 'block' : 'none';
        }
    }

    if (params.gemeente) {
        // Simulate search input
        const searchInput = document.getElementById('searchInput');
        searchInput.value = params.gemeente; // Set the value

        // Create and dispatch an 'input' event.  This is the key.
        const inputEvent = new Event('input', {
            bubbles: true,  //  Important:  Allow the event to bubble up
            cancelable: true, //  Important: Allow the event to be cancelled
        });
        searchInput.dispatchEvent(inputEvent);

        // Trigger Enter keyup event to simulate search
        const keyupEvent = new KeyboardEvent('keyup', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        });
        searchInput.dispatchEvent(keyupEvent);

    } else {
        // If no gemeente parameter, view national
        viewNational(true);
    }

    // Load election data if needed
    if (showElectionData && currentView === 'municipal') {
        const lastMunicipality = localStorage.getItem('lastMunicipality');
        if (lastMunicipality) {
            const municipality = JSON.parse(lastMunicipality);
            const currentElection = localStorage.getItem('lastElection') || 'TK2021';
            loadElectionData(municipality.code, currentElection);
        }
    }
});
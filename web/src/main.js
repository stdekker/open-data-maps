// Import configuration
// Core configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';

// Core services
import { fetchData } from './modules/dataService.js';
import { Modal } from './modules/modalService.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';

// UI components and handlers
import { initializeMobileHandler } from './modules/mobileHandler.js';
import { setupFeatureNameBox, updateFeatureNameBox } from './modules/UIFeatureInfoBox.js';
import { setupSearch, findMunicipalityByName, createSearchData } from './modules/searchService.js';
import { initializeFeatureSelect } from './modules/UIFeatureSelectList.js';

// Map layers and data
import { 
    addMunicipalityLayers, 
    addReportingUnits, 
    cleanupReportingUnits, 
    updateToggleStates, 
    cleanupPostcode6Layer, 
    initializePostcode6Toggle, 
    loadAllPostcode6Data 
} from './modules/layerService.js';

// Additional features
import { loadElectionData } from './modules/electionService.js';

let showElectionData = false;
let settingsModal;
let helpModal;
let municipalityPopulations = {};
let municipalityData = null;
let currentRegionType = 'buurten'; // Default region type

// Helper function to update toggle UI state
function updateToggleUI(toggleElement, isActive, isDisabled = false) {
    if (!toggleElement) return;
    toggleElement.setAttribute('aria-pressed', isActive);
    if (isDisabled) {
        toggleElement.classList.add('disabled');
        toggleElement.setAttribute('aria-disabled', 'true');
        toggleElement.removeAttribute('tabindex'); // Remove from tab order when disabled
    } else {
        toggleElement.classList.remove('disabled');
        toggleElement.setAttribute('aria-disabled', 'false');
        toggleElement.setAttribute('tabindex', '0'); // Add back to tab order
    }
}

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

// Initialize the feature selection module after map is loaded
map.on('load', () => {
    // Get the feature info box element
    const featureInfoBox = document.querySelector('.feature-info-box');
    if (featureInfoBox) {
        // Initialize the feature selection module (moved from UIFeatureInfoBox.js)
        initializeFeatureSelect(map, featureInfoBox);
    }
});

// Load municipality data first, then proceed with map initialization
async function initializeMapAndData() {
    try {
        // Load municipality data first
        const response = await fetch('data/gemeenten.json');
        municipalityData = await response.json();


        // Store both population and household data
        municipalityData.features.forEach(feature => {
            municipalityPopulations[feature.properties.gemeentecode] = {
                ...feature.properties // Include all properties for comprehensive data access
            };
        });

        // Make the data globally available
        window.municipalityData = municipalityData;
        window.municipalityPopulations = municipalityPopulations;

        // Process URL parameters
        const params = getUrlParams();

        // Create simplified data structure for search
        const searchData = createSearchData(municipalityData);

        // Initialize search functionality with callback
        setupSearch(searchData, async (municipality) => {
            await viewMunicipality(municipality);
        });
        
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
        if (params.gemeente) {
            municipality = findMunicipalityByName(municipalityData, params.gemeente);
            if (!municipality) {
                updateUrlParams(null);
            }
        }

        // If no municipality is chosen through the url or found in localStorage, 
        // show the default municipality
        if (!municipality) {
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                municipality = JSON.parse(lastMunicipality);
            } else {
                municipality = findMunicipalityByName(municipalityData, DEFAULT_MUNICIPALITY);
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
    }, 444);

    // Update the feature name box with the selected municipality
    updateFeatureNameBox();

    // Wait for data loading to complete
    await loadGeoJson(municipality.code, currentRegionType);
}

// Modify the viewNational function
async function viewNational() {
    try {
        // Remove any existing event listeners to prevent duplicates
        if (map.getLayer('municipalities-fill')) {
            map.off('dblclick', 'municipalities-fill');
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
        map.on('dblclick', 'municipalities-fill', (e) => {
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
 * @param {String} regionType - The region type ('buurten' or 'wijken')
 */
function loadGeoJson(code, regionType = 'buurten') {
    return new Promise((resolve, reject) => {
        if (!map.loaded()) {
            map.on('load', () => {
                Promise.all([
                    fetchData(`api/municipality.php?code=${code}&type=${regionType}`),
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
            fetchData(`api/municipality.php?code=${code}&type=${regionType}`),
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

    // Initialize region type toggles
    initializeRegionTypeToggles();

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

    // Add click/keydown handlers for layer toggles
    const layerToggles = document.querySelectorAll('.layer-toggle-item');
    layerToggles.forEach(toggle => {
        toggle.addEventListener('click', handleToggleInteraction);
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevent space from scrolling
                handleToggleInteraction.call(toggle, e); // Call handler with toggle as 'this'
            }
        });
    });

    // Common handler for toggle interaction (click or keydown)
    function handleToggleInteraction(event) {
        // 'this' refers to the toggle element
        if (this.classList.contains('disabled')) {
            return; // Do nothing if disabled
        }

        const layerType = this.dataset.layer;
        const currentlyActive = this.getAttribute('aria-pressed') === 'true';
        const shouldBeActive = !currentlyActive;

        // Update UI immediately
        updateToggleUI(this, shouldBeActive);

        // Handle specific layer logic
        switch (layerType) {
            case 'municipality':
                handleMunicipalityToggle(shouldBeActive);
                break;
            case 'postcode':
                // Postcode toggle is handled by initializePostcode6Toggle in postcodeLayer.js
                // We just trigger the state change here, the existing handler should pick it up if initialized correctly.
                // The event listener in initializePostcode6Toggle needs adjustment.
                if (shouldBeActive) {
                    // Make sure mapInstance is accessible or passed correctly
                    if (window.map) { 
                        loadAllPostcode6Data(window.map); 
                    } else {
                        console.error("Map instance not available for postcode load.");
                    }
                } else {
                    if (window.map) { 
                        cleanupPostcode6Layer(window.map);
                    } else {
                        console.error("Map instance not available for postcode cleanup.");
                    }
                }
                break;
            case 'election':
                handleElectionToggle(shouldBeActive);
                break;
        }
    }

    // Specific handler for municipality toggle
    function handleMunicipalityToggle(isActive) {
        if (map.getLayer('municipalities-fill')) {
            map.setLayoutProperty('municipalities-fill', 'visibility', isActive ? 'visible' : 'none');
            map.setLayoutProperty('municipalities-borders', 'visibility', isActive ? 'visible' : 'none');
        }
        localStorage.setItem('showMunicipalityLayer', isActive);
    }

    // Specific handler for election toggle
    function handleElectionToggle(isActive) {
        showElectionData = isActive;
        localStorage.setItem('showElectionData', showElectionData);
        statsView.style.display = showElectionData ? 'block' : 'none';

        // Update URL parameter
        const lastMunicipality = localStorage.getItem('lastMunicipality');
        const municipality = lastMunicipality ? JSON.parse(lastMunicipality) : null;
        updateUrlParams(municipality?.naam || null, showElectionData);

        if (showElectionData && currentView === 'municipal' && municipality) {
            const currentElection = localStorage.getItem('lastElection') || 'TK2021';
            loadElectionData(municipality.code, currentElection);
            // Reporting units are added via the 'reportingUnitsLoaded' event listener
        } else {
            cleanupReportingUnits(map);
        }
    }

    // Restore initial toggle states
    const initialShowMunicipality = localStorage.getItem('showMunicipalityLayer') !== 'false';
    const municipalityToggleElement = document.getElementById('municipalityToggle');
    updateToggleUI(municipalityToggleElement, initialShowMunicipality);
    
    // Show the active region type 
    updateRegionTypeUI();
    
    // Initial map layer visibility is set within activateView

    const initialShowElection = localStorage.getItem('showElectionData') === 'true';
    const electionToggleElement = document.getElementById('electionToggle');
    updateToggleUI(electionToggleElement, initialShowElection);
    const statsView = document.querySelector('.stats-view'); // Ensure statsView is defined
    statsView.style.display = initialShowElection ? 'block' : 'none';

    // Initialize mobile handler
    initializeMobileHandler();
});

/**
 * Initializes the region type toggle functionality
 */
function initializeRegionTypeToggles() {
    // Load from localStorage or use default
    currentRegionType = localStorage.getItem('regionType') || 'buurten';
    
    // Get region type elements
    const buurtToggle = document.getElementById('buurtToggle');
    const wijkToggle = document.getElementById('wijkToggle');
    
    if (!buurtToggle || !wijkToggle) {
        console.error('Region type toggle elements not found');
        return;
    }
    
    // Update UI to match current setting
    updateRegionTypeUI();
    
    // Add click handlers to region type toggles
    buurtToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the parent toggle from being triggered
        
        // Update region type even if it's already 'buurten'
        currentRegionType = 'buurten';
        localStorage.setItem('regionType', currentRegionType);
        updateRegionTypeUI();
        
        // Check if municipality toggle is off and turn it on
        const municipalityToggle = document.getElementById('municipalityToggle');
        const isMunicipalityActive = municipalityToggle && municipalityToggle.getAttribute('aria-pressed') === 'true';
        
        if (!isMunicipalityActive && municipalityToggle) {
            // Update the toggle UI
            updateToggleUI(municipalityToggle, true);
            
            // Update localStorage
            localStorage.setItem('showMunicipalityLayer', 'true');
            
            // Ensure the layer is visible if it exists
            if (map.getLayer('municipalities-fill')) {
                map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }
            
            // Force reload of the municipality data to make sure it's displayed
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality && window.currentView === 'municipal') {
                const municipality = JSON.parse(lastMunicipality);
                loadGeoJson(municipality.code, currentRegionType);
            }
        } else {
            reloadCurrentMunicipality();
        }
    });
    
    wijkToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the parent toggle from being triggered
        
        // Update region type even if it's already 'wijken'
        currentRegionType = 'wijken';
        localStorage.setItem('regionType', currentRegionType);
        updateRegionTypeUI();
        
        // Check if municipality toggle is off and turn it on
        const municipalityToggle = document.getElementById('municipalityToggle');
        const isMunicipalityActive = municipalityToggle && municipalityToggle.getAttribute('aria-pressed') === 'true';
        
        if (!isMunicipalityActive && municipalityToggle) {
            // Update the toggle UI
            updateToggleUI(municipalityToggle, true);
            
            // Update localStorage
            localStorage.setItem('showMunicipalityLayer', 'true');
            
            // Ensure the layer is visible if it exists
            if (map.getLayer('municipalities-fill')) {
                map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }
            
            // Force reload of the municipality data to make sure it's displayed
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality && window.currentView === 'municipal') {
                const municipality = JSON.parse(lastMunicipality);
                loadGeoJson(municipality.code, currentRegionType);
            }
        } else {
            reloadCurrentMunicipality();
        }
    });
}

/**
 * Updates the UI to show the active region type
 */
function updateRegionTypeUI() {
    const buurtToggle = document.getElementById('buurtToggle');
    const wijkToggle = document.getElementById('wijkToggle');
    
    if (buurtToggle && wijkToggle) {
        if (currentRegionType === 'buurten') {
            buurtToggle.classList.add('active');
            wijkToggle.classList.remove('active');
        } else {
            buurtToggle.classList.remove('active');
            wijkToggle.classList.add('active');
        }
    }
}

/**
 * Reloads the current municipality with the selected region type
 */
function reloadCurrentMunicipality() {
    const lastMunicipality = localStorage.getItem('lastMunicipality');
    if (lastMunicipality && window.currentView === 'municipal') {
        const municipality = JSON.parse(lastMunicipality);
        
        // Check if postcode toggle is active before reloading
        const postcode6Toggle = document.getElementById('postcode6Toggle');
        const isPostcodeActive = postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true';
        
        // Clean up postcode layer if it exists to avoid stale data
        if (isPostcodeActive && (map.getLayer('postcode6-fill') || map.getLayer('postcode6-borders') || map.getSource('postcode6'))) {
            cleanupPostcode6Layer(map);
        }
        
        // Load new municipality data with current region type
        loadGeoJson(municipality.code, currentRegionType)
            .then(() => {
                // If postcode toggle was active, reload postcode data with the new region type
                if (isPostcodeActive) {
                    // Small delay to ensure postcodes are properly set after loading municipality data
                    setTimeout(() => {
                        loadAllPostcode6Data(map);
                    }, 500);
                }
            });
    }
}

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
            updateToggleUI(electionToggle, false, true); // Inactive, Disabled
            updateToggleUI(municipalityToggle, true, true); // Active, Disabled (National view always shows municipalities)

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
        updateToggleUI(electionToggle, showElectionData, false); // Update UI, Not disabled

        const code = municipalityCode || (JSON.parse(localStorage.getItem('lastMunicipality'))?.code);
        if (code) {
            await loadGeoJson(code, currentRegionType);
            if (showElectionData) {
                await loadElectionData(code, localStorage.getItem('lastElection') || 'TK2023');
            }
            // Force the municipality layers to be visible
            if (map.getLayer('municipalities-fill')) {
                map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
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
        updateToggleUI(electionToggle, showElectionData, false); // Already updated above, ensure not disabled
        const showMunicipalityLayer = localStorage.getItem('showMunicipalityLayer') !== 'false'; // Restore state
        updateToggleUI(municipalityToggle, showMunicipalityLayer, false); // Set state from storage, Not disabled

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


// Update the event listener for popstate to use findMunicipalityByName
window.addEventListener('popstate', async (event) => {
    const params = getUrlParams();

    // Handle elections parameter
    if (params.elections !== null) {
        showElectionData = params.elections;
        localStorage.setItem('showElectionData', showElectionData);

        const electionToggle = document.getElementById('electionToggle');
        updateToggleUI(electionToggle, showElectionData);

        const statsView = document.querySelector('.stats-view');
        if (statsView) {
            statsView.style.display = showElectionData ? 'block' : 'none';
        }
    }

    if (params.gemeente) {
        const municipality = findMunicipalityByName(municipalityData, params.gemeente);
        if (municipality) {
            await viewMunicipality(municipality);
        } else {
            await viewNational();
        }
    } else {
        // If no gemeente parameter, view national
        await viewNational(true);
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
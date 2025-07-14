// Import configuration
// Core configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';

// Core services
import { fetchData } from './modules/services/dataService.js';
import { Modal } from './modules/services/modalService.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';
import * as State from './modules/state.js';

// UI components and handlers
import { initializeMobileHandler } from './modules/mobileHandler.js';
import { setupFeatureNameBox, updateFeatureNameBox } from './modules/UIFeatureInfoBox.js';
import { setupSearch, findMunicipalityByName, createSearchData } from './modules/services/searchService.js';
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
} from './modules/services/layerService.js';

// Additional features
import { 
    loadElectionData, 
    loadNationalElectionData, 
    getAvailableElections,
    resetNationalMapColors
} from './modules/services/electionService.js';

let settingsModal;
let helpModal;
let municipalityPopulations = {};
let municipalityData = null;

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
State.setCurrentView('national');

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
            State.setShowElectionData(params.elections);
        }
        
        electionToggle.checked = State.getShowElectionData();

        const statsView = document.querySelector('.stats-view');
        statsView.style.display = State.getShowElectionData() ? 'block' : 'none';

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
            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality) {
                municipality = lastMunicipality;
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
    
    State.setLastMunicipality(municipality);
    updateUrlParams(municipality.naam, State.getShowElectionData());

    // Hide keyboard on mobile devices
    searchInput.blur();

    setTimeout(() => {
        searchInput.value = '';
    }, 444);

    // Update the feature name box with the selected municipality
    updateFeatureNameBox();

    // Wait for data loading to complete
    await loadGeoJson(municipality.code, State.getCurrentRegionType());
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
            if (State.getCurrentView() !== 'national') {
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
                State.setLastMunicipality(municipality);
                
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
function initializeDOMElements() {
    // Initialize modals
    settingsModal = new Modal('settings-modal');
    window.settingsModal = settingsModal;
    helpModal = new Modal('help-modal');

     // Initialize region type toggles
     initializeRegionTypeToggles();

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

    // Update handleMenuItemActivation to handle the case when an event is not available
    function handleMenuItemActivation(event, menuItem) {
        // If menuItem is not provided (for backward compatibility)
        if (!menuItem) {
            // Handle the case when called without proper parameters
            console.warn('handleMenuItemActivation called without a menuItem');
            return;
        }
        
        // Remove active class from all items
        menuItems.forEach(i => {
            i.classList.remove('active');
        });
        
        // Add active class
        menuItem.classList.add('active');
        
        if (menuItem.id === 'national-view') {
            activateView('national');
        } else if (menuItem.id === 'municipal-view') {
            activateView('municipal');
        }
    }

    // Add click/keydown handlers
    menuItems.forEach(item => {
        // Click handler
        item.addEventListener('click', function(event) {
            // Always use event.currentTarget which is more reliable across browsers
            handleMenuItemActivation(event, event.currentTarget);
        });
        
        // Keyboard handler
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Always use e.currentTarget which is more reliable across browsers
                handleMenuItemActivation(e, e.currentTarget);
            }
        });
    });
    
    // Handle initial activation separately after defining the function
    if (initialMenuItem) {
        // Directly call with the initialMenuItem as parameter
        handleMenuItemActivation(null, initialMenuItem);
    }

    // Add click/keydown handlers for layer toggles
    const layerToggles = document.querySelectorAll('.layer-toggle-item');
    layerToggles.forEach(toggle => {
        toggle.addEventListener('click', function(event) {
            // Always use event.currentTarget which is more reliable across browsers
            handleToggleInteraction(event, event.currentTarget);
        });
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevent space from scrolling
                // Always use e.currentTarget which is more reliable across browsers
                handleToggleInteraction(e, e.currentTarget);
            }
        });
    });

    // Common handler for toggle interaction (click or keydown)
    function handleToggleInteraction(event, toggleElement) {
        // Use toggleElement instead of 'this'
        if (toggleElement.classList.contains('disabled')) {
            return; // Do nothing if disabled
        }

        const layerType = toggleElement.dataset.layer;
        const currentlyActive = toggleElement.getAttribute('aria-pressed') === 'true';
        const shouldBeActive = !currentlyActive;

        // Update UI immediately
        updateToggleUI(toggleElement, shouldBeActive);

        // Handle specific layer logic
        switch (layerType) {
            case 'municipality':
                handleMunicipalityToggle(shouldBeActive);
                break;
            case 'postcode':
                // Postcode toggle is handled by initializePostcode6Toggle in postcodeLayer.js
                // We just trigger the state change here, the existing handler should pick it up if initialized correctly.
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
        State.setShowMunicipalityLayer(isActive);
    }

    // Specific handler for election toggle
    function handleElectionToggle(isActive) {
        State.setShowElectionData(isActive);
        const statsView = document.querySelector('.stats-view'); // Ensure statsView is available here
        statsView.style.display = State.getShowElectionData() ? 'block' : 'none';

        // Update URL parameter
        const lastMunicipality = State.getLastMunicipality();
        const municipality = lastMunicipality ? lastMunicipality : null;
        // Only include municipality name in URL if in municipal view
        updateUrlParams(State.getCurrentView() === 'municipal' ? municipality?.naam : null, State.getShowElectionData());

        // Fetch data or clean up based on view and toggle state
        const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);

        if (isActive && currentElection) {
            if (State.getCurrentView() === 'municipal' && municipality) {
                loadElectionData(municipality.code, currentElection);
                // Reporting units are added via the 'reportingUnitsLoaded' event listener
            } else if (State.getCurrentView() === 'national') {
                loadNationalElectionData(currentElection);
            }
        } else {
            // Clean up reporting units only if they exist (relevant for municipal view)
            if (map.getLayer('reporting-units')) {
                cleanupReportingUnits(map);
            }
            // Clear stats view if toggle is turned off
            if (!isActive && statsView) {
                 statsView.innerHTML = '';
                 statsView.style.display = 'none';
            }
             // If in national view and toggling OFF, reset map colors
            if (!isActive && State.getCurrentView() === 'national') {
                resetNationalMapColors(); 
            }
        }
    }

    // Restore initial toggle states
    const initialShowMunicipality = State.getShowMunicipalityLayer();
    const municipalityToggleElement = document.getElementById('municipalityToggle');
    updateToggleUI(municipalityToggleElement, initialShowMunicipality);
    
    // Show the active region type 
    updateRegionTypeUI();
    
    // Initial map layer visibility is set within activateView

    const initialShowElection = State.getShowElectionData();
    const electionToggleElement = document.getElementById('electionToggle');
    updateToggleUI(electionToggleElement, initialShowElection);
    const statsView = document.querySelector('.stats-view'); // Ensure statsView is defined
    statsView.style.display = initialShowElection ? 'block' : 'none';

    // Initialize mobile handler
    initializeMobileHandler();
}

// Check if DOM is already loaded (needed for Safari compatibility)
if (document.readyState === 'loading') {
    // DOM still loading, add event listener
    document.addEventListener('DOMContentLoaded', initializeDOMElements);
} else {
    // DOM already loaded (Safari sometimes triggers this), run initialization immediately
    initializeDOMElements();
}

/**
 * Initializes the region type toggle functionality
 */
function initializeRegionTypeToggles() {
    // Load from localStorage or use default
    let currentRegionType = State.getCurrentRegionType();
    
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
        State.setCurrentRegionType(currentRegionType);
        updateRegionTypeUI();
        
        handleRegionToggleBehavior(e.currentTarget);
    });
    
    wijkToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the parent toggle from being triggered
        
        // Update region type even if it's already 'wijken'
        currentRegionType = 'wijken';
        State.setCurrentRegionType(currentRegionType);
        updateRegionTypeUI();
        
        handleRegionToggleBehavior(e.currentTarget);
    });
    
    // Function to handle common behavior after region toggle click
    function handleRegionToggleBehavior(toggleElement) {
        // Check if municipality toggle is off and turn it on
        const municipalityToggle = document.getElementById('municipalityToggle');
        const isMunicipalityActive = municipalityToggle && municipalityToggle.getAttribute('aria-pressed') === 'true';
        
        if (!isMunicipalityActive && municipalityToggle) {
            // Update the toggle UI
            updateToggleUI(municipalityToggle, true);
            
            // Update localStorage
            State.setShowMunicipalityLayer(true);
            
            // Ensure the layer is visible if it exists
            if (map.getLayer('municipalities-fill')) {
                map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }
            
            // Force reload of the municipality data to make sure it's displayed
            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality && State.getCurrentView() === 'municipal') {
                const municipality = lastMunicipality;
                loadGeoJson(municipality.code, State.getCurrentRegionType());
            }
        } else {
            reloadCurrentMunicipality();
        }
    }
}

/**
 * Updates the UI to show the active region type
 */
function updateRegionTypeUI() {
    const buurtToggle = document.getElementById('buurtToggle');
    const wijkToggle = document.getElementById('wijkToggle');
    
    if (buurtToggle && wijkToggle) {
        if (State.getCurrentRegionType() === 'buurten') {
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
    const lastMunicipality = State.getLastMunicipality();
    if (lastMunicipality && State.getCurrentView() === 'municipal') {
        const municipality = lastMunicipality;
        
        // Check if postcode toggle is active before reloading
        const postcode6Toggle = document.getElementById('postcode6Toggle');
        const isPostcodeActive = postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true';
        
        // Clean up postcode layer if it exists to avoid stale data
        if (isPostcodeActive && (map.getLayer('postcode6-fill') || map.getLayer('postcode6-borders') || map.getSource('postcode6'))) {
            cleanupPostcode6Layer(map);
        }
        
        // Load new municipality data with current region type
        loadGeoJson(municipality.code, State.getCurrentRegionType())
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

    // Get previous view before updating
    const previousView = State.getCurrentView();
    
    // Update current view
    State.setCurrentView(viewType);  
    
    if (viewType === 'national') {
        try {
            // Store current election state in localStorage before switching
            localStorage.setItem('previousElectionState', State.getShowElectionData());
            
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
            // Restore election state but keep it enabled
            let showElectionData = State.getShowElectionData(); 
            updateToggleUI(electionToggle, showElectionData, false); // Reflect state, Not Disabled
            updateToggleUI(municipalityToggle, true, true); // Active, Disabled (National view always shows municipalities)

            // Load national election data if toggle is active
             if (showElectionData) {
                const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);
                if (currentElection) {
                    loadNationalElectionData(currentElection);
                    statsView.style.display = 'block'; // Show stats view if loading data
                }
             }

            // Update other toggles (e.g., postcode6) via layerService
            updateToggleStates(viewType);
            
            // Reset national map colors only if election data is NOT being shown
            // Only reset if municipality data is available to prevent errors
            if (!State.getShowElectionData() && window.municipalityData) {
                resetNationalMapColors();
            }
            
            return; // Exit early after national view is set up
        } catch (error) {
            console.error('Error switching to national view:', error);
        }
    }
    
    if (viewType === 'municipal') {   
        
        // Restore election state from localStorage
        let showElectionData = State.getShowElectionData(); // ALWAYS from localStorage
        const electionToggle = document.getElementById('electionToggle'); // Get the toggle
        updateToggleUI(electionToggle, showElectionData, false); // Update UI, Not disabled

        const code = municipalityCode || (State.getLastMunicipality()?.code);
        if (code) {
            await loadGeoJson(code, State.getCurrentRegionType());
            if (showElectionData) {
                await loadElectionData(code, State.getLastElection() || 'TK2023');
            }
            // Force the municipality layers to be visible
            if (map.getLayer('municipalities-fill')) {
                map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }
            // Override any stored state so that buurten toggle is always on
            State.setShowMunicipalityLayer(true);
        }
    
        // Show stats view if election toggle is checked
        const statsView = document.querySelector('.stats-view');
        statsView.style.display = showElectionData ? 'block' : 'none';
        
        // --- Update sidebar toggles for municipal view ---
        //const electionToggle = document.getElementById('electionToggle'); // ALREADY DEFINED ABOVE
        const municipalityToggle = document.getElementById('municipalityToggle');
        updateToggleUI(electionToggle, showElectionData, false); // Already updated above, ensure not disabled
        const showMunicipalityLayer = State.getShowMunicipalityLayer(); // Restore state
        updateToggleUI(municipalityToggle, showMunicipalityLayer, false);

        // Explicitly add or remove reporting units based on showElectionData
        if (showElectionData) {
            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality) {
                const municipality = lastMunicipality;
                // Re-fetch the election data to get the geoJsonData
                loadElectionData(municipality.code, State.getLastElection() || 'TK2021')
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
    addReportingUnits(map, geoJsonData, State.getShowElectionData());
});


// Update the event listener for popstate to use findMunicipalityByName
window.addEventListener('popstate', async (event) => {
    const params = getUrlParams();

    // Handle elections parameter
    if (params.elections !== null) {
        State.setShowElectionData(params.elections);

        const electionToggle = document.getElementById('electionToggle');
        updateToggleUI(electionToggle, State.getShowElectionData());

        const statsView = document.querySelector('.stats-view');
        if (statsView) {
            statsView.style.display = State.getShowElectionData() ? 'block' : 'none';
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
    if (State.getShowElectionData() && State.getCurrentView() === 'municipal') {
        const lastMunicipality = State.getLastMunicipality();
        if (lastMunicipality) {
            const municipality = lastMunicipality;
            const currentElection = State.getLastElection() || 'TK2021';
            loadElectionData(municipality.code, currentElection);
        }
    }
});
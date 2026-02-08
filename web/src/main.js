// Import configuration

// Core configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';

// Core services
import { fetchData } from './modules/services/dataService.js';
import { Modal } from './modules/services/modalService.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';
import * as State from './modules/state.js';
import { ViewManager, updateToggleUI } from './modules/ViewManager.js';

// UI components and handlers
import { setupSearch, findMunicipalityByName, createSearchData } from './modules/services/searchService.js';
import { setupFeatureNameBox, updateFeatureNameBox } from './modules/UI/featureInfoBox.js';
import { initializeFeatureSelect } from './modules/UI/featureSelectList.js';
import { initializeWalkingListModal } from './modules/UI/walkingList.js';
import { initializeMobileUI } from './modules/UI/mobile.js';

// Map layers and data
import {
    addMunicipalityLayers,
    addReportingUnits,
    cleanupReportingUnits,
    updateToggleStates,
    cleanupPostcode6Layer,
    initializePostcode6Toggle,
    loadAllPostcode6Data,
    addBagLayer,
    cleanupBagLayer,
    toggleBagLayer,
    loadBagDataForMunicipality,
    debugLayerOrder
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
let viewManager = null;

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

// Expose debug utility for layer order testing (accessible via browser console)
window.debugLayerOrder = () => debugLayerOrder(map);

// Initialize the feature selection module after map is loaded
map.on('load', () => {
    const featureInfoBox = document.querySelector('.feature-info-box');
    if (featureInfoBox) {
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
                ...feature.properties
            };
        });

        // Make the data globally available
        window.municipalityData = municipalityData;
        window.municipalityPopulations = municipalityPopulations;

        // Initialize ViewManager
        viewManager = new ViewManager(map, municipalityData, municipalityPopulations);
        viewManager.setupPopstateHandler();
        viewManager.setupReportingUnitsHandler();

        // Process URL parameters
        const params = getUrlParams();

        // Create simplified data structure for search
        const searchData = createSearchData(municipalityData);

        // Initialize search functionality with callback
        setupSearch(searchData, async (municipality) => {
            await viewManager.viewMunicipality(municipality);
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
            await viewManager.viewMunicipality(municipality);
        } else {
            await viewManager.viewNational();
        }

        // Now that viewManager is ready, update menu to show correct initial state
        const initialMenuItem = document.getElementById(DEFAULT_MENU_ITEM);
        if (initialMenuItem) {
            const menuItems = document.querySelectorAll('.menu-items li');
            menuItems.forEach(item => {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });
            initialMenuItem.classList.add('active');
            initialMenuItem.setAttribute('aria-selected', 'true');
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Map and data need to be loaded before proceeding
await map.on('load', initializeMapAndData);

// Add click handlers for menu items and sidebar UI
function initializeSidebarAndUI() {
    // Initialize modals
    settingsModal = new Modal('settings-modal');
    window.settingsModal = settingsModal;
    helpModal = new Modal('help-modal');
    initializeWalkingListModal();

    // Initialize region type toggles
    initializeRegionTypeToggles();

    // Initialize postcode6 toggle with map instance
    initializePostcode6Toggle(map);

    // Add settings button handler
    const settingsButton = document.querySelector('.settings-button');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            settingsModal.open('Settings');
        });
    }

    // Add help button handler
    const helpButton = document.querySelector('.help-button');
    if (helpButton) {
        helpButton.addEventListener('click', () => {
            helpModal.openFromUrl('Help', 'content/help.php');
        });
    }

    const menuItems = document.querySelectorAll('.menu-items li');
    const initialMenuItem = document.getElementById(DEFAULT_MENU_ITEM);

    // Define the menu item activation handler
    function handleMenuItemActivation(event, element) {
        const menuItem = element || this;
        const viewType = menuItem.id.replace('-view', '');

        menuItems.forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });

        menuItem.classList.add('active');
        menuItem.setAttribute('aria-selected', 'true');

        // Guard against viewManager not being initialized yet
        if (!viewManager) {
            console.warn('ViewManager not yet initialized');
            return;
        }

        if (viewType === 'national') {
            viewManager.activateView('national');
        } else if (viewType === 'municipal') {
            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality) {
                viewManager.activateView('municipal', lastMunicipality.code);
            }
        }
    }

    // Add keyboard and click support for menu items
    menuItems.forEach(item => {
        item.addEventListener('click', function (event) {
            handleMenuItemActivation(event, event.currentTarget);
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMenuItemActivation(e, e.currentTarget);
            }
        });
    });

    // Don't call handleMenuItemActivation here - it will be called after viewManager is ready
    // in initializeMapAndData()

    // Add click/keydown handlers for layer toggles
    const layerToggles = document.querySelectorAll('.layer-toggle-item');
    layerToggles.forEach(toggle => {
        toggle.addEventListener('click', function (event) {
            handleToggleInteraction(event, event.currentTarget);
        });
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleInteraction(e, e.currentTarget);
            }
        });
    });

    // Common handler for toggle interaction (click or keydown)
    function handleToggleInteraction(event, toggleElement) {
        if (toggleElement.classList.contains('disabled')) {
            return;
        }

        const layerType = toggleElement.dataset.layer;
        const currentlyActive = toggleElement.getAttribute('aria-pressed') === 'true';
        const shouldBeActive = !currentlyActive;

        updateToggleUI(toggleElement, shouldBeActive);

        switch (layerType) {
            case 'municipality':
                handleMunicipalityToggle(shouldBeActive);
                break;
            case 'postcode':
                if (shouldBeActive) {
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
            case 'bag':
                toggleBagLayer(map, shouldBeActive);
                if (shouldBeActive && State.getCurrentView() === 'municipal') {
                    const municipality = State.getLastMunicipality();
                    if (municipality && window.municipalityData) {
                        const municipalityFeature = window.municipalityData.features.find(f => f.properties.gemeentecode === municipality.code);
                        if (municipalityFeature) {
                            loadBagDataForMunicipality(map, municipalityFeature);
                        }
                    }
                }
                break;
            case 'election':
                handleElectionToggle(shouldBeActive);
                break;
        }
    }

    function handleMunicipalityToggle(isActive) {
        if (map.getLayer('municipalities-fill')) {
            map.setLayoutProperty('municipalities-fill', 'visibility', isActive ? 'visible' : 'none');
            map.setLayoutProperty('municipalities-borders', 'visibility', isActive ? 'visible' : 'none');
        }
        State.setShowMunicipalityLayer(isActive);
    }

    function handleElectionToggle(isActive) {
        State.setShowElectionData(isActive);
        const statsView = document.querySelector('.stats-view');
        statsView.style.display = State.getShowElectionData() ? 'block' : 'none';

        const lastMunicipality = State.getLastMunicipality();
        const municipality = lastMunicipality ? lastMunicipality : null;
        updateUrlParams(State.getCurrentView() === 'municipal' ? municipality?.naam : null, State.getShowElectionData());

        const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);

        if (isActive && currentElection) {
            if (State.getCurrentView() === 'municipal' && municipality) {
                loadElectionData(municipality.code, currentElection);
            } else if (State.getCurrentView() === 'national') {
                loadNationalElectionData(currentElection);
            }
        } else {
            if (map.getLayer('reporting-units')) {
                cleanupReportingUnits(map);
            }
            if (!isActive && statsView) {
                statsView.innerHTML = '';
                statsView.style.display = 'none';
            }
            if (!isActive && State.getCurrentView() === 'national') {
                resetNationalMapColors();
            }
        }
    }

    // Restore initial toggle states
    const initialShowMunicipality = State.getShowMunicipalityLayer();
    const municipalityToggleElement = document.getElementById('municipalityToggle');
    updateToggleUI(municipalityToggleElement, initialShowMunicipality);

    updateRegionTypeUI();

    const initialShowElection = State.getShowElectionData();
    const electionToggleElement = document.getElementById('electionToggle');
    updateToggleUI(electionToggleElement, initialShowElection);
    const statsView = document.querySelector('.stats-view');
    if (statsView) {
        statsView.style.display = initialShowElection ? 'block' : 'none';
    }

    initializeMobileUI();
}

// Ensure sidebar/UI initialization runs even if DOMContentLoaded timing differs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebarAndUI);
} else {
    initializeSidebarAndUI();
}

/**
 * Initializes the region type toggle functionality
 */
function initializeRegionTypeToggles() {
    let currentRegionType = State.getCurrentRegionType();

    const buurtToggle = document.getElementById('buurtToggle');
    const wijkToggle = document.getElementById('wijkToggle');

    if (!buurtToggle || !wijkToggle) {
        console.error('Region type toggle elements not found');
        return;
    }

    updateRegionTypeUI();

    buurtToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        currentRegionType = 'buurten';
        State.setCurrentRegionType(currentRegionType);
        updateRegionTypeUI();
        handleRegionToggleBehavior(e.currentTarget);
    });

    wijkToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        currentRegionType = 'wijken';
        State.setCurrentRegionType(currentRegionType);
        updateRegionTypeUI();
        handleRegionToggleBehavior(e.currentTarget);
    });

    function handleRegionToggleBehavior(toggleElement) {
        const municipalityToggle = document.getElementById('municipalityToggle');
        const isMunicipalityActive = municipalityToggle && municipalityToggle.getAttribute('aria-pressed') === 'true';

        if (!isMunicipalityActive && municipalityToggle) {
            updateToggleUI(municipalityToggle, true);
            State.setShowMunicipalityLayer(true);

            if (map.getLayer('municipalities-fill')) {
                map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }

            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality && State.getCurrentView() === 'municipal' && viewManager) {
                viewManager.loadGeoJson(lastMunicipality.code, State.getCurrentRegionType());
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
    if (lastMunicipality && State.getCurrentView() === 'municipal' && viewManager) {
        const postcode6Toggle = document.getElementById('postcode6Toggle');
        const isPostcodeActive = postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true';

        if (isPostcodeActive && (map.getLayer('postcode6-fill') || map.getLayer('postcode6-borders') || map.getSource('postcode6'))) {
            cleanupPostcode6Layer(map);
        }

        viewManager.loadGeoJson(lastMunicipality.code, State.getCurrentRegionType())
            .then(() => {
                if (isPostcodeActive) {
                    setTimeout(() => {
                        loadAllPostcode6Data(map);
                    }, 500);
                }
            });
    }
}
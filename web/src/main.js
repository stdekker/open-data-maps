// Import configuration

// Core configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';

// Core services
import { Modal } from './modules/services/modalService.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';
import * as State from './modules/state.js';
import { ViewManager } from './modules/ViewManager.js';
import { ToggleManager, updateToggleUI } from './modules/ToggleManager.js';

// UI components and handlers
import { setupSearch, findMunicipalityByName, createSearchData } from './modules/services/searchService.js';
import { initializeFeatureSelect } from './modules/UI/featureSelectList.js';
import { initializeWalkingListModal } from './modules/UI/walkingList.js';
import { initializeMobileUI } from './modules/UI/mobile.js';

// Map layers and data
import {
    initializePostcode6Toggle,
    debugLayerOrder
} from './modules/services/layerService.js';

let settingsModal;
let helpModal;
let municipalityPopulations = {};
let municipalityData = null;
let viewManager = null;
let toggleManager = null;

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

        // Connect ToggleManager to ViewManager now that it's ready
        if (toggleManager) {
            toggleManager.setViewManager(viewManager);
        }

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

    // Initialize ToggleManager (viewManager will be set later when ready)
    toggleManager = new ToggleManager(map);
    toggleManager.initialize();

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

    // Initialize menu items
    initializeMenuItems();

    // Initialize mobile UI
    initializeMobileUI();
}

/**
 * Initialize menu item event listeners.
 */
function initializeMenuItems() {
    const menuItems = document.querySelectorAll('.menu-items li');

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
}

// Ensure sidebar/UI initialization runs even if DOMContentLoaded timing differs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebarAndUI);
} else {
    initializeSidebarAndUI();
}
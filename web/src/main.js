// Import configuration

// Core configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY } from './config.js';

// Core services
import { Modal } from './modules/services/modalService.js';
import * as State from './modules/state.js';
import { loadPersistedState } from './modules/statePersistence.js';
import { ViewManager } from './modules/ViewManager.js';
import { ToggleManager } from './modules/ToggleManager.js';
import { createTransitionController } from './modules/transitionController.js';

// UI components and handlers
import { setupSearch, createSearchData } from './modules/services/searchService.js';
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
let transitionController = null;

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
State.hydrateState(loadPersistedState());
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
        viewManager.setupReportingUnitsHandler();

        // Create transition controller and connect to ViewManager
        transitionController = createTransitionController(map, viewManager, {
            municipalityData,
            defaultMunicipalityName: DEFAULT_MUNICIPALITY
        });
        transitionController.setViewManager(viewManager);
        transitionController.setMunicipalityData(municipalityData);
        transitionController.setDefaultMunicipalityName(DEFAULT_MUNICIPALITY);
        transitionController.bindRouter();
        viewManager.setController(transitionController);

        // Connect ToggleManager to ViewManager and controller
        if (toggleManager) {
            toggleManager.setViewManager(viewManager);
            toggleManager.setController(transitionController);
        }

        // Create simplified data structure for search
        const searchData = createSearchData(municipalityData);

        // Initialize search functionality with controller dispatch
        setupSearch(searchData, async (municipality) => {
            await transitionController.dispatch({
                type: 'NAVIGATE_MUNICIPAL',
                municipality,
                source: 'search',
                resetOverlays: true
            });
        });

        await transitionController.dispatch({ type: 'RESTORE_ROUTE' });
        transitionController.renderUI();
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

    // Initialize ToggleManager (viewManager and controller set later when ready)
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
        event?.preventDefault?.();
        const menuItem = element || this;
        const viewType = menuItem.id.replace('-view', '');

        if (!viewManager || !transitionController) {
            return;
        }

        if (viewType === 'national') {
            transitionController.dispatch({ type: 'NAVIGATE_NATIONAL' });
        } else if (viewType === 'municipal') {
            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality) {
                transitionController.dispatch({
                    type: 'NAVIGATE_MUNICIPAL',
                    municipality: lastMunicipality,
                    resetOverlays: false
                });
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
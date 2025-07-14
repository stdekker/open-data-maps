// src/modules/state.js

/**
 * @module state
 * This module centralizes the application's UI state, providing a single source of truth.
 * It handles state initialization from localStorage, and provides getters and setters for state properties.
 * This approach prevents state from being scattered across different modules and global variables.
 */

// Private state object
const _state = {
    showElectionData: false,
    currentRegionType: 'buurten',
    currentView: 'national',
    lastMunicipality: null,
    showMunicipalityLayer: true,
    lastElection: null,
    showBagLayer: false,
};

/**
 * Initializes the state from localStorage.
 * If a value is not found in localStorage, a default value is used.
 */
function initializeState() {
    _state.showElectionData = localStorage.getItem('showElectionData') === 'true';
    _state.currentRegionType = localStorage.getItem('regionType') || 'buurten';
    _state.showMunicipalityLayer = localStorage.getItem('showMunicipalityLayer') !== 'false';
    _state.lastElection = localStorage.getItem('lastElection');

    const lastMunicipalityJson = localStorage.getItem('lastMunicipality');
    if (lastMunicipalityJson) {
        try {
            _state.lastMunicipality = JSON.parse(lastMunicipalityJson);
        } catch (e) {
            console.error("Error parsing lastMunicipality from localStorage", e);
            _state.lastMunicipality = null;
        }
    }
}

// Initialize on module load
initializeState();

// --- Getters ---

export const getState = () => ({ ..._state });
export const getShowElectionData = () => _state.showElectionData;
export const getCurrentRegionType = () => _state.currentRegionType;
export const getCurrentView = () => _state.currentView;
export const getLastMunicipality = () => _state.lastMunicipality;
export const getShowMunicipalityLayer = () => _state.showMunicipalityLayer;
export const getLastElection = () => _state.lastElection;
export const getShowBagLayer = () => _state.showBagLayer;


// --- Setters ---

/**
 * Updates the showElectionData state and stores it in localStorage.
 * @param {boolean} show - The new value for showElectionData.
 */
export function setShowElectionData(show) {
    _state.showElectionData = show;
    localStorage.setItem('showElectionData', show);
}

/**
 * Updates the currentRegionType state and stores it in localStorage.
 * @param {string} type - The new region type ('buurten' or 'wijken').
 */
export function setCurrentRegionType(type) {
    _state.currentRegionType = type;
    localStorage.setItem('regionType', type);
}

/**
 * Updates the currentView state. This is not stored in localStorage.
 * @param {string} view - The new view ('national' or 'municipal').
 */
export function setCurrentView(view) {
    _state.currentView = view;
    // Note: window.currentView is also updated in main.js for now for compatibility.
}

/**
 * Updates the lastMunicipality state and stores it in localStorage.
 * @param {object} municipality - The municipality object to store.
 */
export function setLastMunicipality(municipality) {
    _state.lastMunicipality = municipality;
    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
}

/**
 * Updates the showMunicipalityLayer state and stores it in localStorage.
 * @param {boolean} show - The new value for showMunicipalityLayer.
 */
export function setShowMunicipalityLayer(show) {
    _state.showMunicipalityLayer = show;
    localStorage.setItem('showMunicipalityLayer', show);
}

/**
 * Updates the lastElection state and stores it in localStorage.
 * @param {string} election - The election identifier.
 */
export function setLastElection(election) {
    _state.lastElection = election;
    localStorage.setItem('lastElection', election);
}

/**
 * Updates the showBagLayer state and stores it in localStorage.
 * @param {boolean} show - The new value for showBagLayer.
 */
export function setShowBagLayer(show) {
    _state.showBagLayer = show;
    localStorage.setItem('showBagLayer', show);
} 
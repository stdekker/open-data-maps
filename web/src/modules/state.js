// src/modules/state.js

/**
 * @module state
 * This module centralizes the application's UI state, providing a single source of truth.
 * It handles state initialization from localStorage, and provides getters and setters for state properties.
 * This approach prevents state from being scattered across different modules and global variables.
 */

export const DEFAULT_STATE = {
    showElectionData: false,
    currentRegionType: 'buurten',
    currentView: 'national',
    lastMunicipality: null,
    showMunicipalityLayer: true,
    lastElection: null,
    showBagLayer: false,
    showPostcodeLayer: false,
    loading: {
        municipality: false,
        postcode: false,
        bag: false,
        election: false
    },
    /** Incremented on each transition; async loaders check this to ignore stale results */
    activeRequestToken: 0
};

// Private state object
const _state = structuredClone(DEFAULT_STATE);

/**
 * Hydrates the in-memory store from explicitly supplied data.
 * Persistence is handled outside this module.
 * @param {Partial<typeof DEFAULT_STATE>} initialState
 */
export function hydrateState(initialState = {}) {
    Object.assign(_state, structuredClone(DEFAULT_STATE), initialState);
    if (initialState.loading) {
        _state.loading = {
            ...DEFAULT_STATE.loading,
            ...initialState.loading
        };
    }
}

// --- Getters ---

export const getState = () => ({ ..._state });
export const getShowElectionData = () => _state.showElectionData;
export const getCurrentRegionType = () => _state.currentRegionType;
export const getCurrentView = () => _state.currentView;
export const getLastMunicipality = () => _state.lastMunicipality;
export const getShowMunicipalityLayer = () => _state.showMunicipalityLayer;
export const getLastElection = () => _state.lastElection;
export const getShowBagLayer = () => _state.showBagLayer;
export const getShowPostcodeLayer = () => _state.showPostcodeLayer;
export const getLoading = () => ({ ..._state.loading });
export const getActiveRequestToken = () => _state.activeRequestToken;


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
 * Updates the showBagLayer state.
 * Note: This state is NOT persisted to localStorage - BAG layer always starts disabled on reload.
 * @param {boolean} show - The new value for showBagLayer.
 */
export function setShowBagLayer(show) {
    _state.showBagLayer = show;
}

/**
 * Updates the showPostcodeLayer state (not persisted).
 * @param {boolean} show - The new value for showPostcodeLayer.
 */
export function setShowPostcodeLayer(show) {
    _state.showPostcodeLayer = show;
}

/**
 * Sets a loading flag for an async operation.
 * @param {'municipality'|'postcode'|'bag'|'election'} key - Which loader is running
 * @param {boolean} value - Whether it is loading
 */
export function setLoading(key, value) {
    if (_state.loading[key] !== undefined) {
        _state.loading[key] = value;
    }
}

/**
 * Invalidates the current request token and returns the new one.
 * Call at the start of a transition; async loaders receive the token and must check it before applying results.
 * @returns {number} New token
 */
export function invalidateRequestToken() {
    _state.activeRequestToken += 1;
    return _state.activeRequestToken;
} 
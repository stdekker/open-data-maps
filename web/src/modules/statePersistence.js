import { DEFAULT_STATE } from './state.js';

/**
 * Loads the persisted subset of sidebar/app state from localStorage.
 * This module owns persistence so state.js can stay pure.
 */
export function loadPersistedState() {
    const persistedState = {
        showElectionData: localStorage.getItem('showElectionData') === 'true',
        currentRegionType: localStorage.getItem('regionType') || DEFAULT_STATE.currentRegionType,
        showMunicipalityLayer: localStorage.getItem('showMunicipalityLayer') !== 'false',
        lastElection: localStorage.getItem('lastElection'),
        showBagLayer: false,
        showPostcodeLayer: false
    };

    // Clean up deprecated persisted BAG state from previous versions.
    localStorage.removeItem('showBagLayer');

    const lastMunicipalityJson = localStorage.getItem('lastMunicipality');
    if (lastMunicipalityJson) {
        try {
            persistedState.lastMunicipality = JSON.parse(lastMunicipalityJson);
        } catch (error) {
            console.error('Error parsing lastMunicipality from localStorage', error);
            persistedState.lastMunicipality = null;
        }
    } else {
        persistedState.lastMunicipality = null;
    }

    return persistedState;
}

/**
 * Persists the state fields that should survive reloads.
 * @param {object} state
 */
export function persistSidebarState(state) {
    localStorage.setItem('showElectionData', String(state.showElectionData));
    localStorage.setItem('regionType', state.currentRegionType);
    localStorage.setItem('showMunicipalityLayer', String(state.showMunicipalityLayer));

    if (state.lastElection) {
        localStorage.setItem('lastElection', state.lastElection);
    } else {
        localStorage.removeItem('lastElection');
    }

    if (state.lastMunicipality) {
        localStorage.setItem('lastMunicipality', JSON.stringify(state.lastMunicipality));
    } else {
        localStorage.removeItem('lastMunicipality');
    }
}

/**
 * Central transition controller: sidebar actions dispatch intents here.
 * One path updates State, runs loaders, and renders UI from canonical state.
 */
import * as State from './state.js';
import { renderSidebarFromState } from './UI/sidebarUI.js';
import { findMunicipalityByName } from './services/searchService.js';
import { bindPopstate, readRouteState, writeRouteState } from './sidebarRouter.js';
import { persistSidebarState } from './statePersistence.js';
import {
    cleanupPostcode6Layer,
    loadAllPostcode6Data,
    toggleBagLayer,
    loadBagDataForMunicipality,
    cleanupBagLayer
} from './services/layerService.js';
import {
    clearMunicipalElectionPresentation,
    loadElectionData,
    loadNationalElectionData,
    getAvailableElections,
    resetNationalMapColors
} from './services/electionService.js';

/**
 * @param {import('mapbox-gl').Map} map
 * @param {import('./ViewManager.js').ViewManager} [viewManager]
 */
export function createTransitionController(map, viewManager = null, options = {}) {
    let municipalityData = options.municipalityData || null;
    let defaultMunicipalityName = options.defaultMunicipalityName || null;

    function setViewManager(vm) {
        viewManager = vm;
    }

    function setMunicipalityData(data) {
        municipalityData = data;
    }

    function setDefaultMunicipalityName(name) {
        defaultMunicipalityName = name;
    }

    /**
     * Single place to sync sidebar DOM from State.
     */
    function renderUI() {
        renderSidebarFromState();
    }

    function persistState() {
        persistSidebarState(State.getState());
    }

    function syncRoute(options = {}) {
        writeRouteState({
            gemeente: State.getCurrentView() === 'municipal' ? State.getLastMunicipality()?.naam || null : null,
            elections: State.getShowElectionData()
        }, options);
    }

    function getCurrentElection() {
        return State.getLastElection() ||
            (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);
    }

    function resolveMunicipality(municipality) {
        if (!municipality) return null;
        if (municipality.code && municipality.naam) return municipality;

        if (!municipalityData) return null;

        if (municipality.code) {
            const feature = municipalityData.features.find(
                currentFeature => currentFeature.properties.gemeentecode === municipality.code
            );

            if (feature) {
                return {
                    naam: feature.properties.gemeentenaam,
                    code: feature.properties.gemeentecode
                };
            }
        }

        if (municipality.naam) {
            return findMunicipalityByName(municipalityData, municipality.naam);
        }

        return null;
    }

    function getMunicipalityFeature(municipalityCode) {
        if (!municipalityData || !municipalityCode) return null;
        return municipalityData.features.find(
            feature => feature.properties.gemeentecode === municipalityCode
        ) || null;
    }

    function persistAndRender(options = {}) {
        syncRoute(options);
        persistState();
        renderUI();
    }

    function setMunicipalityLayerVisibility(isVisible) {
        State.setShowMunicipalityLayer(isVisible);
        if (map.getLayer('municipalities-fill')) {
            map.setLayoutProperty('municipalities-fill', 'visibility', isVisible ? 'visible' : 'none');
        }
        if (map.getLayer('municipalities-borders')) {
            map.setLayoutProperty('municipalities-borders', 'visibility', isVisible ? 'visible' : 'none');
        }
    }

    function resetMunicipalBaseState() {
        State.setCurrentRegionType('buurten');
        cleanupBagLayer(map);
        cleanupPostcode6Layer(map);
        clearMunicipalElectionPresentation(map);
        State.setShowBagLayer(false);
        State.setShowPostcodeLayer(false);
        State.setShowElectionData(false);
        setMunicipalityLayerVisibility(true);
    }

    async function navigateNational(options = {}) {
        if (!viewManager) return;

        const { replaceHistory = false, skipHistory = false, invalidateToken = true } = options;

        if (invalidateToken) {
            State.invalidateRequestToken();
        }

        State.setCurrentView('national');
        State.setShowBagLayer(false);
        State.setShowPostcodeLayer(false);

        await viewManager.activateView('national');
        persistAndRender({ replace: replaceHistory, skipHistory });
    }

    async function navigateMunicipal(action = {}) {
        if (!viewManager) return;

        const {
            municipality: rawMunicipality,
            replaceHistory = false,
            skipHistory = false,
            invalidateToken = true,
            resetOverlays = false
        } = action;

        const municipality = resolveMunicipality(rawMunicipality);
        if (!municipality) return;

        if (invalidateToken) {
            State.invalidateRequestToken();
        }

        if (resetOverlays) {
            resetMunicipalBaseState();
        }

        State.setCurrentView('municipal');
        State.setLastMunicipality(municipality);

        await viewManager.viewMunicipality(municipality);
        persistAndRender({ replace: replaceHistory, skipHistory });
    }

    async function toggleLayerInternal(layer, enabled) {
        if (!viewManager) return;

        const nextState = typeof enabled === 'boolean' ? enabled : !getLayerState(layer);
        if (nextState) {
            State.invalidateRequestToken();
        }

        switch (layer) {
            case 'municipality': {
                setMunicipalityLayerVisibility(nextState);
                break;
            }
            case 'postcode': {
                State.setShowPostcodeLayer(nextState);
                if (nextState) {
                    loadAllPostcode6Data(map);
                } else {
                    cleanupPostcode6Layer(map);
                }
                break;
            }
            case 'bag': {
                State.setShowBagLayer(nextState);
                toggleBagLayer(map, nextState);
                if (nextState && State.getCurrentView() === 'municipal') {
                    const municipality = State.getLastMunicipality();
                    const municipalityFeature = municipality ? getMunicipalityFeature(municipality.code) : null;
                    if (municipalityFeature) {
                        loadBagDataForMunicipality(map, municipalityFeature);
                    }
                }
                break;
            }
            case 'election': {
                State.setShowElectionData(nextState);
                const currentElection = getCurrentElection();
                const municipality = State.getLastMunicipality();

                if (nextState && currentElection) {
                    if (State.getCurrentView() === 'municipal' && municipality) {
                        loadElectionData(municipality.code, currentElection);
                    } else if (State.getCurrentView() === 'national') {
                        loadNationalElectionData(currentElection);
                    }
                } else {
                    clearMunicipalElectionPresentation(map);
                    if (State.getCurrentView() === 'national') {
                        resetNationalMapColors();
                    }
                }
                break;
            }
        }

        persistAndRender();
    }

    function getLayerState(layer) {
        switch (layer) {
            case 'municipality':
                return State.getShowMunicipalityLayer();
            case 'postcode':
                return State.getShowPostcodeLayer();
            case 'bag':
                return State.getShowBagLayer();
            case 'election':
                return State.getShowElectionData();
            default:
                return false;
        }
    }

    async function setRegionTypeInternal(type) {
        State.invalidateRequestToken();
        State.setCurrentRegionType(type);

        if (!viewManager) {
            persistAndRender();
            return;
        }

        // Region switching always implies the municipal base layer is active.
        setMunicipalityLayerVisibility(true);

        if (State.getCurrentView() === 'municipal' && State.getLastMunicipality()) {
            await viewManager.reloadCurrentMunicipality();
            if (State.getShowPostcodeLayer()) {
                loadAllPostcode6Data(map);
            }
        }

        persistAndRender();
    }

    async function restoreRoute(routeState = readRouteState()) {
        if (routeState.elections !== null) {
            State.setShowElectionData(routeState.elections);
        }

        let municipality = null;
        if (routeState.gemeente && municipalityData) {
            municipality = findMunicipalityByName(municipalityData, routeState.gemeente);
            if (!municipality) {
                writeRouteState({ gemeente: null, elections: null }, { replace: true });
            }
        }

        if (!municipality) {
            municipality = State.getLastMunicipality();
        }

        if (!municipality && municipalityData && defaultMunicipalityName) {
            municipality = findMunicipalityByName(municipalityData, defaultMunicipalityName);
        }

        if (municipality) {
            await navigateMunicipal({
                municipality,
                replaceHistory: true,
                skipHistory: true,
                invalidateToken: true,
                resetOverlays: false
            });
            return;
        }

        await navigateNational({
            replaceHistory: true,
            skipHistory: true,
            invalidateToken: true
        });
    }

    function bindRouter() {
        bindPopstate(routeState => {
            dispatch({
                type: 'RESTORE_ROUTE',
                routeState
            });
        });
    }

    async function dispatch(action) {
        switch (action.type) {
            case 'NAVIGATE_NATIONAL':
                return navigateNational(action);
            case 'NAVIGATE_MUNICIPAL':
                return navigateMunicipal(action);
            case 'TOGGLE_LAYER':
            case 'SET_OVERLAY':
                return toggleLayerInternal(action.layer, action.enabled);
            case 'SET_REGION_TYPE':
                return setRegionTypeInternal(action.regionType);
            case 'RESTORE_ROUTE':
                return restoreRoute(action.routeState);
            default:
                return undefined;
        }
    }

    /**
     * Set national or municipal view. Call from menu.
     * @param {'national'|'municipal'} viewType
     * @param {string} [municipalityCode]
     */
    async function setView(viewType, municipalityCode = null) {
        if (viewType === 'national') {
            await dispatch({ type: 'NAVIGATE_NATIONAL' });
        } else if (viewType === 'municipal' && municipalityCode) {
            await dispatch({
                type: 'NAVIGATE_MUNICIPAL',
                municipality: { code: municipalityCode },
                resetOverlays: false
            });
        }
    }

    /**
     * Turn a layer on or off. Call from sidebar toggles.
     * @param {'municipality'|'postcode'|'bag'|'election'} layer
     * @param {boolean} isActive
     */
    function toggleLayer(layer, isActive) {
        return dispatch({
            type: 'SET_OVERLAY',
            layer,
            enabled: isActive
        });
    }

    /**
     * Set region type (buurten/wijken) and reload municipal data if needed.
     * @param {'buurten'|'wijken'} type
     */
    function setRegionType(type) {
        return dispatch({
            type: 'SET_REGION_TYPE',
            regionType: type
        });
    }

    return {
        bindRouter,
        dispatch,
        setDefaultMunicipalityName,
        setMunicipalityData,
        setViewManager,
        setView,
        toggleLayer,
        setRegionType,
        renderUI
    };
}

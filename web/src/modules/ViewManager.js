/**
 * ViewManager - Handles switching between national and municipal views.
 * 
 * This module encapsulates the view-switching logic previously in main.js.
 * It manages:
 * - Activating national/municipal views
 * - Cleanup of layers when switching views
 * - Updating UI toggle states based on view
 * - URL parameter updates
 */

import { MAP_CENTER, MAP_ZOOM } from '../config.js';
import * as State from './state.js';
import { updateUrlParams, getUrlParams } from './urlParams.js';
import { updateFeatureNameBox, setupFeatureNameBox } from './UI/featureInfoBox.js';
import { findMunicipalityByName } from './services/searchService.js';
import { fetchData } from './services/dataService.js';
import {
    addMunicipalityLayers,
    addReportingUnits,
    cleanupReportingUnits,
    updateToggleStates,
    cleanupPostcode6Layer,
    cleanupBagLayer
} from './services/layerService.js';
import {
    loadElectionData,
    loadNationalElectionData,
    getAvailableElections,
    resetNationalMapColors
} from './services/electionService.js';

/**
 * Helper function to update toggle UI state.
 * @param {HTMLElement} toggleElement - The toggle element
 * @param {boolean} isActive - Whether the toggle should be active
 * @param {boolean} isDisabled - Whether the toggle should be disabled
 */
export function updateToggleUI(toggleElement, isActive, isDisabled = false) {
    if (!toggleElement) return;
    toggleElement.setAttribute('aria-pressed', isActive);
    if (isDisabled) {
        toggleElement.classList.add('disabled');
        toggleElement.setAttribute('aria-disabled', 'true');
        toggleElement.removeAttribute('tabindex');
    } else {
        toggleElement.classList.remove('disabled');
        toggleElement.setAttribute('aria-disabled', 'false');
        toggleElement.setAttribute('tabindex', '0');
    }
}

/**
 * ViewManager class to handle view switching logic.
 */
export class ViewManager {
    constructor(map, municipalityData, municipalityPopulations) {
        this.map = map;
        this.municipalityData = municipalityData;
        this.municipalityPopulations = municipalityPopulations;
    }

    /**
     * Handles the display of the municipality View.
     * Updates the UI, stores the selection, and loads municipality data.
     * @param {Object} municipality - The selected municipality object
     */
    async viewMunicipality(municipality) {
        const searchInput = document.getElementById('searchInput');
        const autocompleteList = document.getElementById('autocompleteList');
        const searchError = document.querySelector('.search-error');

        // Check if we're switching to a different municipality
        const currentMunicipality = State.getLastMunicipality();
        const isSwitchingMunicipality = currentMunicipality && currentMunicipality.code !== municipality.code;

        if (isSwitchingMunicipality) {
            try {
                // Reset BAG layer
                if (State.getShowBagLayer()) {
                    cleanupBagLayer(this.map);
                    State.setShowBagLayer(false);
                    const bagToggle = document.getElementById('bagToggle');
                    updateToggleUI(bagToggle, false, false);
                }

                // Reset Postcode layer
                const postcode6Toggle = document.getElementById('postcode6Toggle');
                if (postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true') {
                    cleanupPostcode6Layer(this.map);
                    updateToggleUI(postcode6Toggle, false, false);
                }

                // Reset Election layer
                if (State.getShowElectionData()) {
                    State.setShowElectionData(false);
                    const electionToggle = document.getElementById('electionToggle');
                    updateToggleUI(electionToggle, false, false);
                    const statsView = document.querySelector('.stats-view');
                    if (statsView) statsView.style.display = 'none';
                    if (this.map.getLayer('reporting-units')) {
                        cleanupReportingUnits(this.map);
                    }
                }

                // Ensure municipality layer is active (default mode)
                State.setShowMunicipalityLayer(true);
                const municipalityToggle = document.getElementById('municipalityToggle');
                updateToggleUI(municipalityToggle, true, false);

            } catch (error) {
                console.warn('Error resetting layers during switch:', error);
            }
        }

        // Update state FIRST so activateView has correct municipality
        State.setLastMunicipality(municipality);
        updateUrlParams(municipality.naam, State.getShowElectionData());

        // Small delay to ensure layer cleanup is processed by Mapbox
        await new Promise(resolve => setTimeout(resolve, 50));

        await this.activateView('municipal', municipality.code);

        // Interface updates
        autocompleteList.innerHTML = '';
        searchError.classList.remove('visible');

        // Hide keyboard on mobile devices
        searchInput.blur();

        setTimeout(() => {
            searchInput.value = '';
        }, 444);

        // Update the feature name box with the selected municipality
        updateFeatureNameBox();
    }

    /**
     * Displays the national view with all municipalities.
     */
    async viewNational() {
        try {
            // Remove any existing event listeners to prevent duplicates
            if (this.map.getLayer('municipalities-fill')) {
                this.map.off('dblclick', 'municipalities-fill');
            }

            // Convert coordinates and add layers using the already loaded data
            const geoJsonData = {
                ...this.municipalityData,
                features: this.municipalityData.features.map((feature, index) => ({
                    ...feature,
                    id: index,
                    geometry: {
                        type: feature.geometry.type,
                        coordinates: feature.geometry.coordinates
                    }
                }))
            };

            // Add new layers
            addMunicipalityLayers(this.map, geoJsonData, this.municipalityPopulations);
            setupFeatureNameBox(this.map, this.municipalityPopulations);

            // Add double-click handler for municipality selection
            this.map.on('dblclick', 'municipalities-fill', (e) => {
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

                    State.setLastMunicipality(municipality);
                    this.activateView('municipal', municipality.code);
                }
            });

            return this.municipalityData;
        } catch (error) {
            console.error('Error loading national view:', error);
            throw error;
        }
    }

    /**
     * Loads and displays GeoJSON data for a municipality or region.
     * @param {String} code - The municipality/region code to load
     * @param {String} regionType - The region type ('buurten' or 'wijken')
     */
    loadGeoJson(code, regionType = 'buurten') {
        return new Promise((resolve, reject) => {
            const doLoad = () => {
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
                        addMunicipalityLayers(this.map, geoJsonDataWithIds, this.municipalityPopulations);
                        setupFeatureNameBox(this.map, this.municipalityPopulations);

                        // Force visibility
                        if (this.map.getLayer('municipalities-fill')) {
                            this.map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                            this.map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
                        }

                        // Fit bounds to the loaded GeoJSON
                        this._fitBoundsToGeoJson(geoJsonDataWithIds);
                        resolve();
                    })
                    .catch(error => {
                        console.error('Error loading data:', error);
                        reject(error);
                    });
            };

            if (!this.map.loaded()) {
                this.map.on('load', doLoad);
            } else {
                doLoad();
            }
        });
    }

    /**
     * Fit map bounds to a GeoJSON dataset.
     * @param {Object} geoJsonData - The GeoJSON data
     */
    _fitBoundsToGeoJson(geoJsonData) {
        try {
            const bounds = new mapboxgl.LngLatBounds();
            geoJsonData.features.forEach(feature => {
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
                this.map.fitBounds(bounds, { padding: 64 });
            }
        } catch (e) {
            console.error('Error fitting bounds:', e);
        }
    }

    /**
     * Activates either the national or municipal view.
     * @param {String} viewType - Either 'national' or 'municipal'
     * @param {String} municipalityCode - Optional municipality code for municipal view
     */
    async activateView(viewType, municipalityCode = null) {
        // Update menu item states
        const viewItem = document.getElementById(`${viewType}-view`);
        document.querySelectorAll('.menu-items li').forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });

        viewItem.classList.add('active');
        viewItem.setAttribute('aria-selected', 'true');

        // Update current view
        State.setCurrentView(viewType);

        if (viewType === 'national') {
            await this._activateNationalView();
        } else if (viewType === 'municipal') {
            await this._activateMunicipalView(municipalityCode);
        }

        // Update additional toggles (e.g., postcode6) based on the view type
        updateToggleStates(viewType);
    }

    /**
     * Internal handler for national view activation.
     */
    async _activateNationalView() {
        try {
            localStorage.setItem('previousElectionState', State.getShowElectionData());

            if (this.map.getLayer('postcode6-fill') || this.map.getLayer('postcode6-line')) {
                cleanupPostcode6Layer(this.map);
            }

            cleanupReportingUnits(this.map);
            cleanupBagLayer(this.map);
            State.setShowBagLayer(false);

            const statsView = document.querySelector('.stats-view');
            statsView.innerHTML = '';
            statsView.style.display = 'none';

            await this.viewNational();

            this.map.flyTo({
                center: MAP_CENTER,
                zoom: MAP_ZOOM,
                duration: 1500
            });

            updateUrlParams(null);

            const electionToggle = document.getElementById('electionToggle');
            const municipalityToggle = document.getElementById('municipalityToggle');
            const bagToggle = document.getElementById('bagToggle');

            const showElectionData = State.getShowElectionData();
            updateToggleUI(electionToggle, showElectionData, false);
            updateToggleUI(municipalityToggle, true, true);
            updateToggleUI(bagToggle, false, true);

            if (showElectionData) {
                const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);
                if (currentElection) {
                    loadNationalElectionData(currentElection);
                    statsView.style.display = 'block';
                }
            }

            updateToggleStates('national');

            if (!State.getShowElectionData() && window.municipalityData) {
                resetNationalMapColors();
            }
        } catch (error) {
            console.error('Error switching to national view:', error);
        }
    }

    /**
     * Internal handler for municipal view activation.
     * @param {String} municipalityCode - The municipality code
     */
    async _activateMunicipalView(municipalityCode) {
        const showElectionData = State.getShowElectionData();
        const electionToggle = document.getElementById('electionToggle');
        updateToggleUI(electionToggle, showElectionData, false);

        const code = municipalityCode || (State.getLastMunicipality()?.code);
        if (code) {
            await this.loadGeoJson(code, State.getCurrentRegionType());
            if (showElectionData) {
                await loadElectionData(code, State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null));
            }
            if (this.map.getLayer('municipalities-fill')) {
                this.map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                this.map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }
            State.setShowMunicipalityLayer(true);
        }

        const statsView = document.querySelector('.stats-view');
        statsView.style.display = showElectionData ? 'block' : 'none';

        const municipalityToggle = document.getElementById('municipalityToggle');
        updateToggleUI(municipalityToggle, State.getShowMunicipalityLayer(), false);

        const bagToggle = document.getElementById('bagToggle');
        updateToggleUI(bagToggle, State.getShowBagLayer(), false);

        if (showElectionData && code) {
            loadElectionData(code, State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null));
        } else {
            cleanupReportingUnits(this.map);
        }
    }

    /**
     * Reloads the current municipality with the selected region type.
     */
    reloadCurrentMunicipality() {
        const lastMunicipality = State.getLastMunicipality();
        if (lastMunicipality && State.getCurrentView() === 'municipal') {
            const postcode6Toggle = document.getElementById('postcode6Toggle');
            const isPostcodeActive = postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true';

            if (isPostcodeActive && (this.map.getLayer('postcode6-fill') || this.map.getLayer('postcode6-borders') || this.map.getSource('postcode6'))) {
                cleanupPostcode6Layer(this.map);
            }

            // Note: loadAllPostcode6Data is handled elsewhere; this just reloads base layers
            return this.loadGeoJson(lastMunicipality.code, State.getCurrentRegionType());
        }
        return Promise.resolve();
    }

    /**
     * Sets up the popstate event listener for browser navigation.
     */
    setupPopstateHandler() {
        window.addEventListener('popstate', async () => {
            const params = getUrlParams();

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
                const municipality = findMunicipalityByName(this.municipalityData, params.gemeente);
                if (municipality) {
                    await this.viewMunicipality(municipality);
                } else {
                    await this.viewNational();
                }
            } else {
                await this.viewNational();
            }

            if (State.getShowElectionData() && State.getCurrentView() === 'municipal') {
                const lastMunicipality = State.getLastMunicipality();
                if (lastMunicipality) {
                    const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);
                    loadElectionData(lastMunicipality.code, currentElection);
                }
            }
        });
    }

    /**
     * Sets up the reportingUnitsLoaded event listener.
     */
    setupReportingUnitsHandler() {
        window.addEventListener('reportingUnitsLoaded', (event) => {
            const { geoJsonData } = event.detail;
            addReportingUnits(this.map, geoJsonData, State.getShowElectionData());
        });
    }
}

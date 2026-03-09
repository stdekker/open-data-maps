/**
 * ViewManager - Handles switching between national and municipal views.
 *
 * This module is map-focused: loading map data, fitting bounds, and
 * applying municipal/national layer effects. Sidebar rendering and route
 * orchestration now live outside this class.
 */

import { MAP_CENTER, MAP_ZOOM } from '../config.js';
import * as State from './state.js';
import { updateFeatureNameBox, setupFeatureNameBox } from './UI/featureInfoBox.js';
import { fetchData } from './services/dataService.js';
import {
    addMunicipalityLayers,
    addReportingUnits,
    cleanupReportingUnits,
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
 * ViewManager class to handle view switching logic.
 */
export class ViewManager {
    constructor(map, municipalityData, municipalityPopulations) {
        this.map = map;
        this.municipalityData = municipalityData;
        this.municipalityPopulations = municipalityPopulations;
        this.controller = null;
    }

    setController(controller) {
        this.controller = controller;
    }

    /**
     * Handles the display of the municipality View.
     * Updates the UI, stores the selection, and loads municipality data.
     * @param {Object} municipality - The selected municipality object
     */
    async viewMunicipality(municipality) {
        State.setLastMunicipality(municipality);
        await this.activateView('municipal', municipality.code);
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

                    if (this.controller) {
                        this.controller.dispatch({
                            type: 'NAVIGATE_MUNICIPAL',
                            municipality,
                            source: 'map',
                            resetOverlays: false
                        });
                    } else {
                        State.setLastMunicipality(municipality);
                        this.activateView('municipal', municipality.code);
                    }
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
        const requestToken = State.getActiveRequestToken();
        return new Promise((resolve, reject) => {
            const doLoad = () => {
                const promises = [fetchData(`api/municipality.php?code=${code}&type=${regionType}`)];

                if (State.getShowElectionData()) {
                    promises.push(loadElectionData(code));
                }

                Promise.all(promises)
                    .then(([geoJsonData]) => {
                        if (State.getActiveRequestToken() !== requestToken) {
                            resolve();
                            return;
                        }
                        const geoJsonDataWithIds = {
                            ...geoJsonData,
                            features: geoJsonData.features.map((feature, index) => ({
                                ...feature,
                                id: index
                            }))
                        };

                        try {
                            addMunicipalityLayers(this.map, geoJsonDataWithIds, this.municipalityPopulations);
                            setupFeatureNameBox(this.map, this.municipalityPopulations);

                            if (this.map.getLayer('municipalities-fill')) {
                                this.map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                                this.map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
                            }

                            this._fitBoundsToGeoJson(geoJsonDataWithIds);
                            resolve();
                        } catch (err) {
                            console.error('Error processing municipality layers/bounds:', err);
                            reject(err);
                        }
                    })
                    .catch(error => {
                        console.error('Error loading data:', error);
                        reject(error);
                    });
            };

            if (!this.map.isStyleLoaded()) {
                this.map.once('idle', doLoad);
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
     * @param {String} [municipalityCode] - Optional municipality code for municipal view
     * @param {{ fromPopstate?: boolean }} [options] - When true, use replaceState for URL updates (restoration)
     */
    async activateView(viewType, municipalityCode = null, options = {}) {
        State.setCurrentView(viewType);

        if (viewType === 'national') {
            await this._activateNationalView();
        } else if (viewType === 'municipal') {
            await this._activateMunicipalView(municipalityCode);
        }
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

            const showElectionData = State.getShowElectionData();

            if (showElectionData) {
                const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);
                if (currentElection) {
                    loadNationalElectionData(currentElection);
                    statsView.style.display = 'block';
                }
            }

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

        const code = municipalityCode || (State.getLastMunicipality()?.code);
        if (code) {
            await this.loadGeoJson(code, State.getCurrentRegionType());
            if (showElectionData) {
                const currentElection = State.getLastElection() || (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);
                await loadElectionData(code, currentElection);
            }
            if (this.map.getLayer('municipalities-fill')) {
                this.map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                this.map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }
            State.setShowMunicipalityLayer(true);
        }

        const statsView = document.querySelector('.stats-view');
        statsView.style.display = showElectionData ? 'block' : 'none';

        if (!showElectionData && code) {
            cleanupReportingUnits(this.map);
        }
    }

    /**
     * Reloads the current municipality with the selected region type.
     */
    reloadCurrentMunicipality() {
        const lastMunicipality = State.getLastMunicipality();
        if (lastMunicipality && State.getCurrentView() === 'municipal') {
            const isPostcodeActive = State.getShowPostcodeLayer();

            if (isPostcodeActive && (this.map.getLayer('postcode6-fill') || this.map.getLayer('postcode6-borders') || this.map.getSource('postcode6'))) {
                cleanupPostcode6Layer(this.map);
            }

            return this.loadGeoJson(lastMunicipality.code, State.getCurrentRegionType());
        }
        return Promise.resolve();
    }

    /**
     * Sets up the reportingUnitsLoaded event listener.
     */
    setupReportingUnitsHandler() {
        window.addEventListener('reportingUnitsLoaded', (event) => {
            const { geoJsonData, requestToken } = event.detail || {};
            if (requestToken !== undefined && requestToken !== State.getActiveRequestToken()) {
                return;
            }
            addReportingUnits(this.map, geoJsonData, State.getShowElectionData());
        });
    }
}

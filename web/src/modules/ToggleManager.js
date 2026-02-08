/**
 * ToggleManager - Handles UI toggle interactions for map layers.
 * 
 * This module manages:
 * - Layer toggles (municipality, postcode, BAG, election)
 * - Region type toggles (buurten/wijken)
 * - Toggle UI state updates
 */

import * as State from './state.js';
import { updateUrlParams } from './urlParams.js';
import {
    cleanupReportingUnits,
    cleanupPostcode6Layer,
    loadAllPostcode6Data,
    toggleBagLayer,
    loadBagDataForMunicipality
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
 * ToggleManager class to handle layer toggle interactions.
 */
export class ToggleManager {
    constructor(map, viewManager = null) {
        this.map = map;
        this.viewManager = viewManager;
    }

    /**
     * Set the ViewManager instance (for deferred initialization).
     * @param {ViewManager} viewManager 
     */
    setViewManager(viewManager) {
        this.viewManager = viewManager;
    }

    /**
     * Initialize all toggle event listeners.
     */
    initialize() {
        this._initializeLayerToggles();
        this._initializeRegionTypeToggles();
        this._restoreInitialToggleStates();
    }

    /**
     * Set up event listeners for layer toggle items.
     */
    _initializeLayerToggles() {
        const layerToggles = document.querySelectorAll('.layer-toggle-item');
        layerToggles.forEach(toggle => {
            toggle.addEventListener('click', (event) => {
                this._handleToggleInteraction(event.currentTarget);
            });
            toggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._handleToggleInteraction(e.currentTarget);
                }
            });
        });
    }

    /**
     * Common handler for toggle interaction (click or keydown).
     * @param {HTMLElement} toggleElement 
     */
    _handleToggleInteraction(toggleElement) {
        if (toggleElement.classList.contains('disabled')) {
            return;
        }

        const layerType = toggleElement.dataset.layer;
        const currentlyActive = toggleElement.getAttribute('aria-pressed') === 'true';
        const shouldBeActive = !currentlyActive;

        updateToggleUI(toggleElement, shouldBeActive);

        switch (layerType) {
            case 'municipality':
                this._handleMunicipalityToggle(shouldBeActive);
                break;
            case 'postcode':
                this._handlePostcodeToggle(shouldBeActive);
                break;
            case 'bag':
                this._handleBagToggle(shouldBeActive);
                break;
            case 'election':
                this._handleElectionToggle(shouldBeActive);
                break;
        }
    }

    /**
     * Handle municipality layer toggle.
     * @param {boolean} isActive 
     */
    _handleMunicipalityToggle(isActive) {
        if (this.map.getLayer('municipalities-fill')) {
            this.map.setLayoutProperty('municipalities-fill', 'visibility', isActive ? 'visible' : 'none');
            this.map.setLayoutProperty('municipalities-borders', 'visibility', isActive ? 'visible' : 'none');
        }
        State.setShowMunicipalityLayer(isActive);
    }

    /**
     * Handle postcode layer toggle.
     * @param {boolean} isActive 
     */
    _handlePostcodeToggle(isActive) {
        if (isActive) {
            if (this.map) {
                loadAllPostcode6Data(this.map);
            } else {
                console.error("Map instance not available for postcode load.");
            }
        } else {
            if (this.map) {
                cleanupPostcode6Layer(this.map);
            } else {
                console.error("Map instance not available for postcode cleanup.");
            }
        }
    }

    /**
     * Handle BAG layer toggle.
     * @param {boolean} isActive 
     */
    _handleBagToggle(isActive) {
        toggleBagLayer(this.map, isActive);
        if (isActive && State.getCurrentView() === 'municipal') {
            const municipality = State.getLastMunicipality();
            if (municipality && window.municipalityData) {
                const municipalityFeature = window.municipalityData.features.find(
                    f => f.properties.gemeentecode === municipality.code
                );
                if (municipalityFeature) {
                    loadBagDataForMunicipality(this.map, municipalityFeature);
                }
            }
        }
    }

    /**
     * Handle election layer toggle.
     * @param {boolean} isActive 
     */
    _handleElectionToggle(isActive) {
        State.setShowElectionData(isActive);
        const statsView = document.querySelector('.stats-view');
        statsView.style.display = State.getShowElectionData() ? 'block' : 'none';

        const lastMunicipality = State.getLastMunicipality();
        const municipality = lastMunicipality ? lastMunicipality : null;
        updateUrlParams(
            State.getCurrentView() === 'municipal' ? municipality?.naam : null,
            State.getShowElectionData()
        );

        const currentElection = State.getLastElection() ||
            (getAvailableElections().length > 0 ? getAvailableElections()[0] : null);

        if (isActive && currentElection) {
            if (State.getCurrentView() === 'municipal' && municipality) {
                loadElectionData(municipality.code, currentElection);
            } else if (State.getCurrentView() === 'national') {
                loadNationalElectionData(currentElection);
            }
        } else {
            if (this.map.getLayer('reporting-units')) {
                cleanupReportingUnits(this.map);
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

    /**
     * Initialize region type toggle functionality (buurten/wijken).
     */
    _initializeRegionTypeToggles() {
        const buurtToggle = document.getElementById('buurtToggle');
        const wijkToggle = document.getElementById('wijkToggle');

        if (!buurtToggle || !wijkToggle) {
            console.error('Region type toggle elements not found');
            return;
        }

        this.updateRegionTypeUI();

        buurtToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            State.setCurrentRegionType('buurten');
            this.updateRegionTypeUI();
            this._handleRegionToggleBehavior();
        });

        wijkToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            State.setCurrentRegionType('wijken');
            this.updateRegionTypeUI();
            this._handleRegionToggleBehavior();
        });
    }

    /**
     * Handle behavior after region type toggle change.
     */
    _handleRegionToggleBehavior() {
        const municipalityToggle = document.getElementById('municipalityToggle');
        const isMunicipalityActive = municipalityToggle &&
            municipalityToggle.getAttribute('aria-pressed') === 'true';

        if (!isMunicipalityActive && municipalityToggle) {
            updateToggleUI(municipalityToggle, true);
            State.setShowMunicipalityLayer(true);

            if (this.map.getLayer('municipalities-fill')) {
                this.map.setLayoutProperty('municipalities-fill', 'visibility', 'visible');
                this.map.setLayoutProperty('municipalities-borders', 'visibility', 'visible');
            }

            const lastMunicipality = State.getLastMunicipality();
            if (lastMunicipality && State.getCurrentView() === 'municipal' && this.viewManager) {
                this.viewManager.loadGeoJson(lastMunicipality.code, State.getCurrentRegionType());
            }
        } else {
            this.reloadCurrentMunicipality();
        }
    }

    /**
     * Updates the UI to show the active region type.
     */
    updateRegionTypeUI() {
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
     * Reloads the current municipality with the selected region type.
     */
    reloadCurrentMunicipality() {
        const lastMunicipality = State.getLastMunicipality();
        if (lastMunicipality && State.getCurrentView() === 'municipal' && this.viewManager) {
            const postcode6Toggle = document.getElementById('postcode6Toggle');
            const isPostcodeActive = postcode6Toggle &&
                postcode6Toggle.getAttribute('aria-pressed') === 'true';

            if (isPostcodeActive && (
                this.map.getLayer('postcode6-fill') ||
                this.map.getLayer('postcode6-borders') ||
                this.map.getSource('postcode6')
            )) {
                cleanupPostcode6Layer(this.map);
            }

            this.viewManager.loadGeoJson(lastMunicipality.code, State.getCurrentRegionType())
                .then(() => {
                    if (isPostcodeActive) {
                        setTimeout(() => {
                            loadAllPostcode6Data(this.map);
                        }, 500);
                    }
                });
        }
    }

    /**
     * Restore initial toggle states from persisted state.
     */
    _restoreInitialToggleStates() {
        const municipalityToggle = document.getElementById('municipalityToggle');
        updateToggleUI(municipalityToggle, State.getShowMunicipalityLayer());

        this.updateRegionTypeUI();

        const electionToggle = document.getElementById('electionToggle');
        updateToggleUI(electionToggle, State.getShowElectionData());

        const statsView = document.querySelector('.stats-view');
        if (statsView) {
            statsView.style.display = State.getShowElectionData() ? 'block' : 'none';
        }
    }
}

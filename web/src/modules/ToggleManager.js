/**
 * ToggleManager - Translates sidebar toggle and region clicks into controller intents.
 * Does not mutate map/state directly; delegates to TransitionController.
 */

/**
 * ToggleManager class: wires DOM events to the transition controller.
 */
export class ToggleManager {
    /**
     * @param {import('mapbox-gl').Map} map
     * @param {import('./ViewManager.js').ViewManager|null} [viewManager]
     * @param {{ dispatch: Function, renderUI: Function }|null} [controller]
     */
    constructor(map, viewManager = null, controller = null) {
        this.map = map;
        this.controller = controller;
    }

    setViewManager(viewManager) {
        // Kept for backwards compatibility; ToggleManager no longer uses ViewManager directly.
        void viewManager;
    }

    /**
     * Set the transition controller (for deferred init).
     * @param {{ dispatch: Function, renderUI: Function }} controller
     */
    setController(controller) {
        this.controller = controller;
    }

    initialize() {
        this._initializeLayerToggles();
        this._initializeRegionTypeToggles();
        if (this.controller) {
            this.controller.renderUI();
        }
    }

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

    _handleToggleInteraction(toggleElement) {
        if (toggleElement.classList.contains('disabled')) return;

        const layerType = toggleElement.dataset.layer;

        if (this.controller) {
            this.controller.dispatch({
                type: 'TOGGLE_LAYER',
                layer: layerType
            });
        }
    }

    _initializeRegionTypeToggles() {
        const buurtToggle = document.getElementById('buurtToggle');
        const wijkToggle = document.getElementById('wijkToggle');
        if (!buurtToggle || !wijkToggle) return;

        buurtToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.controller) {
                this.controller.dispatch({
                    type: 'SET_REGION_TYPE',
                    regionType: 'buurten'
                });
            }
        });

        wijkToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.controller) {
                this.controller.dispatch({
                    type: 'SET_REGION_TYPE',
                    regionType: 'wijken'
                });
            }
        });
    }
}

// Re-export for callers that still import updateToggleUI from ToggleManager
export { updateToggleUI } from './UI/sidebarUI.js';

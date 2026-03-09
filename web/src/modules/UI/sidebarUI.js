/**
 * Single place for sidebar toggle UI updates. Used by TransitionController, ViewManager, and ToggleManager
 * so DOM state is derived from canonical state.
 */
import * as State from '../state.js';

/**
 * Updates a single toggle element's aria and disabled state.
 * @param {HTMLElement|null} toggleElement - The toggle element
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
 * Renders menu and all layer toggles from canonical state. Call after any transition.
 */
export function renderSidebarFromState() {
    const viewType = State.getCurrentView();
    const menuItems = document.querySelectorAll('.menu-items li');
    const nationalItem = document.getElementById('national-view');
    const municipalItem = document.getElementById('municipal-view');
    menuItems.forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    if (viewType === 'national' && nationalItem) {
        nationalItem.classList.add('active');
        nationalItem.setAttribute('aria-selected', 'true');
    } else if (viewType === 'municipal' && municipalItem) {
        municipalItem.classList.add('active');
        municipalItem.setAttribute('aria-selected', 'true');
    }

    const municipalityToggle = document.getElementById('municipalityToggle');
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    const bagToggle = document.getElementById('bagToggle');
    const electionToggle = document.getElementById('electionToggle');
    const statsView = document.querySelector('.stats-view');

    const isNational = viewType === 'national';
    updateToggleUI(municipalityToggle, State.getShowMunicipalityLayer(), isNational);
    updateToggleUI(postcode6Toggle, State.getShowPostcodeLayer(), isNational);
    updateToggleUI(bagToggle, State.getShowBagLayer(), isNational);
    updateToggleUI(electionToggle, State.getShowElectionData(), false);

    if (statsView) {
        statsView.style.display = State.getShowElectionData() ? 'block' : 'none';
    }

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

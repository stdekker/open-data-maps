/**
 * UIShared.js - Shared UI utility functions for feature info and selection modules
 * Extracted from UIFeatureInfoBox.js and UIFeatureSelectList.js to avoid duplication.
 */
import { STATISTICS_CONFIG } from '../config.js';

/**
 * Gets the appropriate feature name based on feature properties and region type
 * @param {Object} feature - The feature object
 * @returns {String} The appropriate feature name
 */
export function getFeatureName(feature) {
    if (!feature || !feature.properties) return '';
    // For debugging - log all available property keys

    // Specific debug for postcode features
    // if (feature.properties.postcode6) {

    // }
    const regionType = window.currentRegionType || localStorage.getItem('regionType') || 'buurten';
    if (regionType === 'wijken' && feature.properties.wijknaam) {
        return feature.properties.wijknaam;
    }
    if (regionType === 'buurten' && feature.properties.buurtnaam) {
        return feature.properties.buurtnaam;
    }
    return feature.properties.buurtnaam || feature.properties.wijknaam || feature.properties.gemeentenaam || 'Unnamed feature';
}

/**
 * Formats a statistic value for display
 * @param {*} value - The value to format
 * @param {String} statType - The type of statistic
 * @returns {String} - Formatted value
 */
export function formatStatValue(value, statType) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') {
        if (statType.startsWith('percentage')) {
            return value.toLocaleString('nl-NL', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1
            });
        }
        return value.toLocaleString('nl-NL', { maximumFractionDigits: 0 });
    }
    return value;
}

/**
 * Adds a click event listener to an element (utility for DRY event binding)
 * @param {HTMLElement} element - The DOM element
 * @param {Function} handler - The event handler
 */
export function addClickListener(element, handler) {
    if (element) {
        element.addEventListener('click', handler);
    }
}

/**
 * Adds multiple click event listeners to a NodeList or array of elements
 * @param {NodeList|Array} elements - The elements
 * @param {Function} handler - The event handler
 */
export function addClickListeners(elements, handler) {
    if (!elements) return;
    elements.forEach(el => addClickListener(el, handler));
}

/**
 * Utility to clear all children from a DOM element
 * @param {HTMLElement} element
 */
export function clearChildren(element) {
    if (!element) return;
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

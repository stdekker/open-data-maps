/**
 * Feature Select List Module - Manages the UI and functionality for selecting map features.
 * This module allows users to select features on the map and track them in a list,
 * calculate statistics, and highlight selected features.
 */

import { STATISTICS_CONFIG } from '../config.js';
import { getFeatureName, formatStatValue, addClickListener, addClickListeners } from './UIShared.js';

// Array to store selected features
let selectedFeatures = [];
// Element to display the selected features list
let selectedFeaturesElement = null;
// Reference to feature info box (for positioning)
let featureInfoBox = null;
// Reference to the map object
let mapInstance = null;

/**
 * Initializes the feature selection module
 * @param {Object} map - The Mapbox map instance
 * @param {HTMLElement} infoBox - The feature info box element
 */
export function initializeFeatureSelect(map, infoBox) {
    mapInstance = map;
    featureInfoBox = infoBox;
    
    // Create the container for selected features
    createSelectedFeaturesElement();
    
    // Apply selection styling to map layers
    setupSelectionStyling(map);
    
    // Set up click handlers for feature selection
    setupFeatureSelectionHandlers(map);
}

/**
 * Creates the selected features container if it doesn't exist
 */
function createSelectedFeaturesElement() {
    if (!selectedFeaturesElement && featureInfoBox) {
        selectedFeaturesElement = document.createElement('div');
        selectedFeaturesElement.className = 'selected-features-container';
        selectedFeaturesElement.style.display = 'none';
        
        // Insert after the feature-info-box
        featureInfoBox.parentNode.insertBefore(selectedFeaturesElement, featureInfoBox.nextSibling);
    }
}

/**
 * Updates the feature states for all selected features on the map
 * @param {Object} map - The Mapbox map instance
 */
function updateSelectedFeatureStates(map) {
    if (!map) return;
    
    // First, reset all previously selected states
    // Unfortunately Mapbox doesn't have a way to list all features with state
    // So we need to reset our tracked features
    selectedFeatures.forEach(feature => {
        const source = feature.source || 'municipalities';
        try {
            map.setFeatureState(
                { source: source, id: feature.id },
                { selected: false }
            );
        } catch (err) {
            // Silently ignore any errors (feature might no longer exist)
        }
    });
    
    // Now set the new selected states
    selectedFeatures.forEach(feature => {
        const source = feature.source || 'municipalities';
        try {
            map.setFeatureState(
                { source: source, id: feature.id },
                { selected: true }
            );
        } catch (err) {
            console.warn("Could not set selected state for feature", feature.id);
        }
    });
}

/**
 * Gets the appropriate feature name based on feature properties and region type
 * @param {Object} feature - The feature object
 * @returns {String} The appropriate feature name
 */


/**
 * Formats a statistic value for display
 * @param {*} value - The value to format
 * @param {String} statType - The type of statistic
 * @returns {String} - Formatted value
 */


/**
 * Adds a feature to the selected features list
 * @param {Object} feature - The feature to add
 * @param {Object} map - The Mapbox map instance
 */
export function addSelectedFeature(feature, map) {
    // Debugging: log feature properties to see what's available

    
    // Check if feature is already in the list (by id or other unique property)
    const featureId = feature.id;
    const isDuplicate = selectedFeatures.some(f => f.id === featureId);
    
    if (!isDuplicate) {
        selectedFeatures.push(feature);
        updateSelectedFeaturesList();
        
        // Update the feature state on the map
        if (map) {
            updateSelectedFeatureStates(map);
        }
    }
}

/**
 * Removes a feature from the selected features list
 * @param {Number} index - The index of the feature to remove
 */
export function removeSelectedFeature(index) {
    if (index >= 0 && index < selectedFeatures.length) {
        // First, clear the selected state for this specific feature
        if (mapInstance) {
            const feature = selectedFeatures[index];
            const source = feature.source || 'municipalities';
            try {
                mapInstance.setFeatureState(
                    { source: source, id: feature.id },
                    { selected: false }
                );
            } catch (err) {
                console.warn("Could not reset feature state for feature", feature.id);
            }
        }
        
        // Then remove from array
        selectedFeatures.splice(index, 1);
        updateSelectedFeaturesList();
        
        // Update any remaining feature states on the map
        if (mapInstance) {
            updateSelectedFeatureStates(mapInstance);
        }
    }
}

/**
 * Clears all selected features
 */
export function clearSelectedFeatures() {
    // First, clear the selected state for all features
    if (mapInstance) {
        selectedFeatures.forEach(feature => {
            const source = feature.source || 'municipalities';
            try {
                mapInstance.setFeatureState(
                    { source: source, id: feature.id },
                    { selected: false }
                );
            } catch (err) {
                console.warn("Could not reset feature state for feature", feature.id);
            }
        });
    }
    
    // Then clear the array
    selectedFeatures = [];
    updateSelectedFeaturesList();
    
    // No need to update feature states again as we already cleared them all
}

/**
 * Updates the selected features list display
 */
export function updateSelectedFeaturesList() {
    if (!selectedFeaturesElement) {
        createSelectedFeaturesElement();
    }

    const statsSelect = document.getElementById('statsSelect');
    const selectedStat = statsSelect ? statsSelect.value : 'aantalInwoners';
    
    // Skip updating if no stat is selected
    if (!selectedStat) return;
    
    // Calculate the total or average for the selected statistic
    let total = 0;
    selectedFeatures.forEach(feature => {
        const value = Number(feature.properties[selectedStat]) || 0;
        total += value;
    });

    // If the statistic is a percentage, calculate the average instead of the sum
    const isPercentage = selectedStat.startsWith('percentage');
    let displayValue = total;
    let displayLabel = 'Totaal';
    if (isPercentage && selectedFeatures.length > 0) {
        displayValue = total / selectedFeatures.length;
        displayLabel = 'Gemiddeld';
    }
    
    // Only show container if there are selected features
    if (selectedFeatures.length > 0) {
        // Create the selected features list HTML
        let html = '<h3>Selectie</h3><ul>';
        
        selectedFeatures.forEach((feature, index) => {
            const featureName = getFeatureName(feature);
            const statValue = feature.properties[selectedStat];
            const formattedValue = formatStatValue(statValue, selectedStat);
            
            html += `<li>
                ${featureName} (${formattedValue})
                <button class="remove-feature" data-index="${index}">×</button>
            </li>`;
        });
        
        // Add the total/average row
        const formattedDisplayValue = formatStatValue(displayValue, selectedStat);
        const statUnit = STATISTICS_CONFIG.labels[selectedStat]?.unit || '';
        html += `</ul><div class="selected-features-total">${displayLabel}: ${formattedDisplayValue} ${statUnit}</div>`;
        
        // Add a clear all button
        html += '<button class="clear-selected-features">Wissen</button>';
        
        selectedFeaturesElement.innerHTML = html;
        selectedFeaturesElement.style.display = 'block';
        
        // Add event listeners to remove buttons
        const removeButtons = selectedFeaturesElement.querySelectorAll('.remove-feature');
        addClickListeners(removeButtons, (e) => {
            e.stopPropagation();
            const index = parseInt(e.currentTarget.dataset.index);
            removeSelectedFeature(index);
        });
        
        // Add event listener to clear all button
        const clearButton = selectedFeaturesElement.querySelector('.clear-selected-features');
        if (clearButton) {
            addClickListener(clearButton, () => {
                clearSelectedFeatures();
            });
        }
    } else {
        // Hide the container if no features are selected
        selectedFeaturesElement.style.display = 'none';
    }
}

/**
 * Sets up the styling for selected features
 * @param {Object} map - The Mapbox map instance
 */
function setupSelectionStyling(map) {
    // Modify the layer paint properties to add highlight for selected features
    const addSelectedHighlight = (layerId) => {
        if (map.getLayer(layerId)) {
            // Add or update the paint property for selected features
            const currentPaintProperty = map.getPaintProperty(layerId, 'line-color');
            
            // Only update if we haven't added the selected state yet
            if (!currentPaintProperty || !String(currentPaintProperty).includes('feature-state')) {
                map.setPaintProperty(layerId, 'line-color', [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    '#FFFFFF', // White border for selected features
                    ['boolean', ['feature-state', 'hover'], false],
                    '#000000', // Black border for hovered features
                    '#000000'  // Default border color
                ]);
                
                map.setPaintProperty(layerId, 'line-width', [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    2, // Thicker border for selected features
                    ['boolean', ['feature-state', 'hover'], false],
                    1.5, // Slightly thicker for hover
                    1   // Default border width
                ]);
                
                map.setPaintProperty(layerId, 'line-opacity', [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    0.8, // More visible for selected
                    ['boolean', ['feature-state', 'hover'], false],
                    0.6, // Default opacity for hover
                    0.2  // Default opacity
                ]);
            }
        }
    };
    
    // Apply selected highlight to municipality and postcode layers
    addSelectedHighlight('municipalities-borders');
    addSelectedHighlight('postcode6-borders');
    
    // Listen for when these layers get added to the map
    map.on('styledata', () => {
        addSelectedHighlight('municipalities-borders');
        addSelectedHighlight('postcode6-borders');
    });
}

/**
 * Sets up click handlers for feature selection
 * @param {Object} map - The Mapbox map instance
 */
function setupFeatureSelectionHandlers(map) {
    // Add click handler for ctrl+click to select features on all layer types
    const layerTypes = ['municipalities-fill', 'postcode6-fill'];
    
    layerTypes.forEach(layerType => {
        map.on('click', layerType, (e) => {
            
            if (e.originalEvent.ctrlKey && e.features.length > 0) {
                
                // Store source information in the feature for later use
                const feature = e.features[0];
                feature.source = layerType.split('-')[0]; // Extract source name from layer ID

                // Check if feature is already selected
                const featureId = feature.id;
                const existingIndex = selectedFeatures.findIndex(f => f.id === featureId);
                if (existingIndex !== -1) {
                    // Remove if already selected
                    removeSelectedFeature(existingIndex);
                } else {
                    // Add if not selected
                    addSelectedFeature(feature, map);
                }
            }
        });
    });
} 
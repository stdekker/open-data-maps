/**
 * Feature Select List UI Module - Manages the UI for selecting map features.
 * This module allows users to select features on the map and track them in a list,
 * calculate statistics, and highlight selected features.
 */

import { STATISTICS_CONFIG } from '../../config.js';
import { getFeatureName, formatStatValue, addClickListener, addClickListeners } from './shared.js';
import { getContextMenu } from './contextMenu.js';
import * as State from '../state.js';
import { showWalkingListModal } from './walkingList.js';
import { Modal } from '../services/modalService.js';
import { getSelectedBagFeatureCoords } from '../layers/bagLayer.js';

// Array to store selected features
let selectedFeatures = [];
// Element to display the selected features list
let selectedFeaturesElement = null;
// Reference to feature info box (for positioning)
let featureInfoBox = null;
// Reference to the map object
let mapInstance = null;
// Reference to the context menu
let contextMenu = null;

/**
 * Checks if a feature is currently selected
 * @param {Object} feature - The feature to check
 * @returns {boolean} True if the feature is selected
 */
export function isFeatureSelected(feature) {
    if (!feature || feature.id === undefined) return false;
    return selectedFeatures.some(f => f.id === feature.id);
}

/**
 * Gets the index of a selected feature
 * @param {Object} feature - The feature to find
 * @returns {number} The index or -1 if not found
 */
function getSelectedFeatureIndex(feature) {
    if (!feature || feature.id === undefined) return -1;
    return selectedFeatures.findIndex(f => f.id === feature.id);
}

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
    
    // Initialize the context menu
    setupContextMenu(map);
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

/**
 * Sets up the context menu with selection options
 * @param {Object} map - The Mapbox map instance
 */
function setupContextMenu(map) {
    // Get or create the context menu instance
    contextMenu = getContextMenu(map);
    
    // Register "Add to selection" menu item
    contextMenu.registerItem({
        id: 'add-to-selection',
        label: 'Toevoegen aan selectie',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>`,
        condition: (feature) => !isFeatureSelected(feature),
        action: (feature) => {
            addSelectedFeature(feature, map);
        },
        order: 10,
        group: 'selection'
    });
    
    // Register "Remove from selection" menu item
    contextMenu.registerItem({
        id: 'remove-from-selection',
        label: 'Verwijderen uit selectie',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>`,
        condition: (feature) => isFeatureSelected(feature),
        action: (feature) => {
            const index = getSelectedFeatureIndex(feature);
            if (index !== -1) {
                removeSelectedFeature(index);
            }
        },
        order: 11,
        group: 'selection'
    });
    
    // Register "Generate walking list" menu item
    contextMenu.registerItem({
        id: 'generate-walking-list',
        label: 'Looplijst genereren',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>`,
        condition: (feature) => {
            // Show if feature has geometry (always visible, even when BAG layer is off)
            return feature.geometry && 
                   (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon');
        },
        action: (feature, evt) => {
            // Check if BAG layer is enabled
            if (!State.getShowBagLayer()) {
                // Show instructional modal
                showBagLayerInstructionModal(map);
                return;
            }
            
            // Use the currently selected BAG feature's address as start point
            // If no BAG feature is selected, streets will be sorted alphabetically
            const startPoint = getSelectedBagFeatureCoords();
            showWalkingListModal(map, feature, { startPoint });
        },
        order: 20,
        group: 'tools'
    });
    
    // Set up right-click handlers for map layers
    const layerTypes = ['municipalities-fill', 'postcode6-fill'];
    
    layerTypes.forEach(layerType => {
        map.on('contextmenu', layerType, (e) => {
            // Prevent default browser context menu
            e.preventDefault();
            
            if (e.features && e.features.length > 0) {
                // Store source information in the feature for later use
                const feature = e.features[0];
                feature.source = layerType.split('-')[0]; // Extract source name from layer ID
                
                // Show context menu at click position
                contextMenu.show(
                    e.originalEvent.clientX,
                    e.originalEvent.clientY,
                    feature,
                    e
                );
            }
        });
    });
    
    // Prevent default context menu on the map container
    map.getContainer().addEventListener('contextmenu', (e) => {
        // Only prevent default if we're handling it ourselves
        // The layerType handlers above will show the menu when applicable
    });
}

/**
 * Shows an instructional modal when user tries to generate walking list without BAG layer enabled
 * @param {Object} map - The Mapbox map instance
 */
function showBagLayerInstructionModal(map) {
    // Use the walking list modal for consistency
    const instructionModal = new Modal('walking-list-modal');
    
    const instructionContent = `
        <div class="walking-list-instruction">
            <p><strong>BAG laag vereist</strong></p>
            <p>Om een looplijst te genereren, moet eerst de BAG laag worden ingeschakeld.</p>
            <ol class="walking-list-steps">
                <li>Schakel de <strong>"Verblijfsobjecten (BAG)"</strong> laag in via de sidebar</li>
                <li>Wacht tot de BAG data geladen is (dit kan even duren)</li>
                <li>Klik opnieuw met rechts op het gebied om de looplijst te genereren</li>
            </ol>
            <p class="walking-list-hint">De BAG laag bevat adresgegevens die nodig zijn voor het genereren van de looplijst.</p>
        </div>
    `;
    
    instructionModal.open('Looplijst genereren', instructionContent);
} 
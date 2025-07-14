import { createStyleConfig, STYLE_VARIANTS } from './colorService.js';

// Re-export functions from layer modules
export { updateMapColors, addMunicipalityLayers } from '../layers/municipalityLayer.js';
export { addReportingUnits, cleanupReportingUnits } from '../layers/electionsLayer.js';
export { addBagLayer, cleanupBagLayer, toggleBagLayer, loadBagDataForMunicipality } from '../layers/bagLayer.js';
export { 
    loadAllPostcode6Data,
    cleanupPostcode6Layer,
    resetPostcode6Toggle,
    updateToggleStates,
    setMunicipalityPostcodes,
    initializePostcode6Toggle
} from '../layers/postcodeLayer.js';

// Export color-related functions from colorService.js
export {
    getMinMaxFromGeoJson,
    createBalancedColorStops,
    getDynamicFillColorExpression,
    BORDER_COLOR,
    updateLayerColors
} from './colorService.js';

/**
 * Helper function to find the first symbol layer in the map style
 * @param {Object} map - The Mapbox map instance
 * @returns {String|null} The ID of the first symbol layer, or null if none found
 */
export function findFirstSymbolLayer(map) {
    const layers = map.getStyle().layers;
    for (const layer of layers) {
        if (layer.type === 'symbol') {
            return layer.id;
        }
    }
    return null;
}

/**
 * Helper function to safely remove layers and sources from the map
 * @param {Object} map - The Mapbox map instance
 * @param {Array} layerIds - Array of layer IDs to remove
 * @param {Array} sourceIds - Array of source IDs to remove
 */
export function cleanupLayers(map, layerIds, sourceIds) {
    // Prevent errors if style is not loaded
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
        return;
    }
    // Track which sources are in use by which layers
    const sourcesInUse = new Map();
    
    // Get all layers in the map
    const allLayers = map.getStyle().layers || [];
    
    // Build a mapping of sources and which layers use them
    allLayers.forEach(layer => {
        if (layer.source) {
            if (!sourcesInUse.has(layer.source)) {
                sourcesInUse.set(layer.source, []);
            }
            sourcesInUse.get(layer.source).push(layer.id);
        }
    });
    
    // Remove requested layers first
    layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
    });
    
    // Then try to remove sources, but only if no layers are using them anymore
    sourceIds.forEach(sourceId => {
        if (map.getSource(sourceId)) {
            // Get remaining layers using this source
            const layersUsingSource = allLayers
                .filter(layer => layer.source === sourceId && !layerIds.includes(layer.id))
                .map(layer => layer.id);
                
            // Only remove the source if no layers are using it
            if (layersUsingSource.length === 0) {
                try {
                    map.removeSource(sourceId);
                } catch (error) {
                    console.warn(`Could not remove source ${sourceId}:`, error.message);
                }
            } else {
                console.warn(`Source ${sourceId} still in use by layers: ${layersUsingSource.join(', ')}`);
            }
        }
    });
}

/**
 * Adds a standard set of layers (fill, border, hover outline) to the map.
 * Based on the pattern used in municipalityLayer.js.
 *
 * @param {Object} map - The Mapbox map instance.
 * @param {Object} config - Configuration object for the layers.
 * @param {string} config.idBase - Base name for layer IDs (e.g., 'municipalities').
 * @param {string} config.source - Source ID for the layers.
 * @param {Object} config.data - The GeoJSON data to style.
 * @param {string} config.statisticKey - The statistic key to color by.
 * @param {string} config.styleVariant - The style variant to use.
 * @param {Object} config.styleOptions - Optional style overrides.
 * @param {string|null} config.insertBeforeLayer - ID of the layer to insert before.
 */
export function addMapLayers(map, config) {
    const { 
        idBase, 
        source, 
        data, 
        statisticKey,
        styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE,
        styleOptions = {},
        insertBeforeLayer = null 
    } = config;

    // Get style configuration from colorService
    const styleConfig = createStyleConfig(
        data, 
        statisticKey, 
        styleVariant, 
        styleOptions
    );
    
    // Apply style configuration to the layers
    const { 
        fillColor, 
        baseFillOpacity, 
        hoverFillOpacity, 
        borderColor, 
        borderWidth, 
        borderOpacity, 
        hoverBorderColor, 
        hoverBorderWidth 
    } = styleConfig;

    // Add base fill layer
    if (!map.getLayer(`${idBase}-fill`)) {
        map.addLayer({
            id: `${idBase}-fill`, // Consistent naming convention
            type: 'fill',
            source: source,
            paint: {
                'fill-color': fillColor,
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    hoverFillOpacity,
                    baseFillOpacity
                ]
            }
        }, insertBeforeLayer);
    }

    // Add border layer
    if (!map.getLayer(`${idBase}-borders`)) {
        map.addLayer({
            id: `${idBase}-borders`,
            type: 'line',
            source: source,
            paint: {
                'line-color': borderColor,
                'line-width': borderWidth,
                'line-opacity': borderOpacity
            }
        }, insertBeforeLayer);
    }

    // Add hover outline layer on top
    if (!map.getLayer(`${idBase}-hover`)) {
        map.addLayer({
            id: `${idBase}-hover`,
            type: 'line',
            source: source,
            paint: {
                'line-color': hoverBorderColor,
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    hoverBorderWidth,   // Use configured hover width
                    0    // Hide line when not hovered
                ],
                'line-opacity': 1 // Keep hover outline fully opaque
            },
            filter: ['!=', ['get', 'id'], ''] // Ensure filter is valid
        }, insertBeforeLayer);
    }
} 
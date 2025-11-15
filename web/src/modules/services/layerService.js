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
 * Layer order constants (bottom to top)
 * Defines the stacking order of custom map layers
 */
export const LAYER_ORDER = {
    MUNICIPALITIES: 1,  // Bottom layer (buurten/wijken)
    POSTCODE: 2,        // Above municipalities
    BAG: 3,             // Above postcode
    ELECTIONS: 4        // Top layer (reporting units)
};

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
 * Debug utility: Logs the current layer order of custom layers to the console.
 * Useful for verifying the layer stacking order during development.
 * 
 * Expected order (bottom to top):
 * 1. Municipalities (buurten/wijken)
 * 2. Postcode
 * 3. BAG
 * 4. Elections (reporting units)
 * 
 * @param {Object} map - The Mapbox map instance
 */
export function debugLayerOrder(map) {
    const layers = map.getStyle().layers;
    const customLayerPrefixes = ['municipalities', 'postcode6', 'bag', 'reporting-units'];
    
    console.log('=== Current Layer Order (bottom to top) ===');
    layers.forEach((layer, index) => {
        const isCustomLayer = customLayerPrefixes.some(prefix => layer.id.startsWith(prefix));
        if (isCustomLayer) {
            console.log(`${index}: ${layer.id} (${layer.type})`);
        }
    });
    console.log('===========================================');
    
    // Provide a summary
    const municipalityIndices = layers.filter(l => l.id.startsWith('municipalities')).map(l => layers.indexOf(l));
    const postcodeIndices = layers.filter(l => l.id.startsWith('postcode6')).map(l => layers.indexOf(l));
    const bagIndices = layers.filter(l => l.id.startsWith('bag')).map(l => layers.indexOf(l));
    const electionIndices = layers.filter(l => l.id.startsWith('reporting-units')).map(l => layers.indexOf(l));
    
    console.log('\n=== Layer Index Ranges ===');
    if (municipalityIndices.length > 0) {
        console.log(`Municipalities: ${Math.min(...municipalityIndices)} - ${Math.max(...municipalityIndices)}`);
    }
    if (postcodeIndices.length > 0) {
        console.log(`Postcode: ${Math.min(...postcodeIndices)} - ${Math.max(...postcodeIndices)}`);
    }
    if (bagIndices.length > 0) {
        console.log(`BAG: ${Math.min(...bagIndices)} - ${Math.max(...bagIndices)}`);
    }
    if (electionIndices.length > 0) {
        console.log(`Elections: ${Math.min(...electionIndices)} - ${Math.max(...electionIndices)}`);
    }
    console.log('==========================\n');
    
    // Check if order is correct
    const maxMunicipality = municipalityIndices.length > 0 ? Math.max(...municipalityIndices) : -1;
    const minPostcode = postcodeIndices.length > 0 ? Math.min(...postcodeIndices) : Infinity;
    const maxPostcode = postcodeIndices.length > 0 ? Math.max(...postcodeIndices) : -1;
    const minBag = bagIndices.length > 0 ? Math.min(...bagIndices) : Infinity;
    const maxBag = bagIndices.length > 0 ? Math.max(...bagIndices) : -1;
    const minElection = electionIndices.length > 0 ? Math.min(...electionIndices) : Infinity;
    
    const isCorrectOrder = 
        maxMunicipality < minPostcode &&
        maxPostcode < minBag &&
        maxBag < minElection;
    
    if (isCorrectOrder) {
        console.log('✓ Layer order is CORRECT! (Municipalities → Postcode → BAG → Elections)');
    } else {
        console.warn('✗ Layer order may be INCORRECT!');
        console.warn('Expected: Municipalities (bottom) → Postcode → BAG → Elections (top)');
    }
}

/**
 * Determines the correct layer to insert before based on layer type and current map state.
 * This ensures consistent layer ordering: Municipalities (bottom) → Postcode → BAG → Elections (top)
 * 
 * The strategy is to insert each layer before the first layer that should be visually above it.
 * In Mapbox, map.addLayer(layer, beforeId) inserts the new layer immediately before the beforeId layer,
 * which means the new layer will be visually BELOW beforeId.
 * 
 * @param {Object} map - The Mapbox map instance
 * @param {Number} layerType - The type of layer being added (use LAYER_ORDER constants)
 * @returns {String|null} The ID of the layer to insert before, or null to add at top
 */
export function getBeforeLayerId(map, layerType) {
    const firstSymbolId = findFirstSymbolLayer(map);
    
    switch (layerType) {
        case LAYER_ORDER.MUNICIPALITIES:
            // Municipalities go at the bottom of our custom layers
            // Insert before postcode (if exists), otherwise before BAG, elections, or symbol layers
            if (map.getLayer('postcode6-fill')) {
                return 'postcode6-fill';
            }
            if (map.getLayer('bag-verblijfsobjecten-points')) {
                return 'bag-verblijfsobjecten-points';
            }
            if (map.getLayer('reporting-units-expected')) {
                return 'reporting-units-expected';
            }
            return firstSymbolId;
            
        case LAYER_ORDER.POSTCODE:
            // Postcode should be above municipalities, below BAG and elections
            // Insert before BAG (if exists), otherwise before elections or symbol layers
            if (map.getLayer('bag-verblijfsobjecten-points')) {
                return 'bag-verblijfsobjecten-points';
            }
            if (map.getLayer('reporting-units-expected')) {
                return 'reporting-units-expected';
            }
            return firstSymbolId;
            
        case LAYER_ORDER.BAG:
            // BAG should be above postcode and municipalities, below elections
            // Insert before elections (if exists), otherwise before symbol layers
            if (map.getLayer('reporting-units-expected')) {
                return 'reporting-units-expected';
            }
            return firstSymbolId;
            
        case LAYER_ORDER.ELECTIONS:
            // Elections go on top of all our custom layers (but still below symbol layers)
            // Insert before symbol layers
            return firstSymbolId;
            
        default:
            return firstSymbolId;
    }
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
 * @param {number|null} config.layerType - The layer type from LAYER_ORDER constants (preferred method).
 * @param {string|null} config.insertBeforeLayer - ID of the layer to insert before (deprecated, use layerType instead).
 */
export function addMapLayers(map, config) {
    const { 
        idBase, 
        source, 
        data, 
        statisticKey,
        styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE,
        styleOptions = {},
        layerType = null,
        insertBeforeLayer = null 
    } = config;
    
    // Determine the correct beforeLayer ID
    // If layerType is provided, use the layer ordering system; otherwise fall back to insertBeforeLayer
    const beforeLayerId = layerType !== null ? getBeforeLayerId(map, layerType) : insertBeforeLayer;

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
        }, beforeLayerId);
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
        }, beforeLayerId);
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
        }, beforeLayerId);
    }
} 
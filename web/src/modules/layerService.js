// Re-export functions from layer modules
export { updateMapColors, addMunicipalityLayers } from './layers/municipalityLayer.js';
export { addReportingUnits, cleanupReportingUnits } from './layers/electionsLayer.js';
export { 
    loadAllPostcode6Data,
    cleanupPostcode6Layer,
    resetPostcode6Toggle,
    updateToggleStates,
    setMunicipalityPostcodes,
    initializePostcode6Toggle
} from './layers/postcodeLayer.js';

/**
 * Returns the min and max values for a given statistic from the features array.
 *
 * @param {Object} geoJsonData - The GeoJSON data.
 * @param {String} statisticKey - The property key to look for in features.
 * @returns {Array} [minValue, maxValue]
 */
export function getMinMaxFromGeoJson(geoJsonData, statisticKey) {
    const INVALID_VALUES = [-99995, -99997];
    const values = geoJsonData.features
        .map(f => {
            const val = f.properties[statisticKey];
            // Convert invalid values to 0
            return (typeof val === 'number' && !isNaN(val) && val !== null)
                ? (INVALID_VALUES.includes(val) ? 0 : val)
                : 0;
        });

    if (!values.length) {
        return [0, 0];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // If they are the same, create an artificial range to avoid domain errors
    if (minValue === maxValue) {
        return [minValue, minValue + 1];
    }

    return [minValue, maxValue];
}

/**
 * Builds a dynamic 'fill-color' expression for Mapbox GL
 * such that the smallest value is lightest and the largest is darkest.
 *
 * @param {Object} geoJsonData     - The full GeoJSON data.
 * @param {String} statisticKey    - The property key to color by (e.g., "aantalInwoners").
 * @returns {Array} Mapbox GL Style expression for 'fill-color'.
 */
export function getDynamicFillColorExpression(geoJsonData, statisticKey) {
    const INVALID_VALUES = [-99995, -99997];
    const [minValue, maxValue] = getMinMaxFromGeoJson(geoJsonData, statisticKey);

    // Create an inverse exponential color scale from lightest to darkest
    const colorScale = chroma
        .scale(['#add8e6', '#4682b4', '#00008b'])
        .domain([minValue, maxValue])
        .mode('lab');

    return [
        'interpolate',
        ['linear'],
        [
            'case',
            ['any',
                ['==', ['get', statisticKey], -99995],
                ['==', ['get', statisticKey], -99997],
                ['==', ['get', statisticKey], null],
                ['==', ['typeof', ['get', statisticKey]], 'string']
            ],
            0,  // Convert invalid values to 0
            ['get', statisticKey]  // Use actual value for valid numbers
        ],
        minValue, colorScale(minValue).hex(),
        maxValue, colorScale(maxValue).hex()
    ];
}

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
    // Remove layers first
    layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
    });

    // Then remove sources
    sourceIds.forEach(sourceId => {
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });
} 
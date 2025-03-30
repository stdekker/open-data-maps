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
 * Creates stops for a more balanced color scale distribution for population data.
 * Uses logarithmic or quantile-based distribution to prevent skewing by outliers.
 *
 * @param {Object} geoJsonData - The GeoJSON data
 * @param {String} statisticKey - The property key (e.g., "aantalInwoners")
 * @param {Number} numStops - Number of color stops to generate
 * @param {Boolean} useLog - Whether to use logarithmic scale (true) or linear (false)
 * @returns {Array} Array of [value, color] stops for Mapbox GL
 */
export function createBalancedColorStops(geoJsonData, statisticKey, numStops = 7, useLog = true) {
    const INVALID_VALUES = [-99995, -99997];
    
    // Get valid values and sort them
    const values = geoJsonData.features
        .map(f => {
            const val = f.properties[statisticKey];
            return (typeof val === 'number' && !isNaN(val) && val !== null && !INVALID_VALUES.includes(val)) 
                ? val 
                : null;
        })
        .filter(val => val !== null)
        .sort((a, b) => a - b);
    
    if (!values.length) {
        return [[0, '#add8e6']];
    }

    // If all values are the same, return a simple two-stop gradient
    if (values[0] === values[values.length - 1]) {
        return [
            [values[0], '#add8e6'],
            [values[0] + 1, '#00008b']
        ];
    }
    
    // Create color scale
    const colorScale = chroma
        .scale(['#dcecf2','#add8e6', '#4682b4', '#00008b'])
        .mode('lab')
        .colors(numStops);
    
    // Create stops array
    const stops = [];
    
    if (useLog && values[0] >= 0) { 
        // Logarithmic scale for population-type values
        // Find min and max values for log scale
        const minVal = Math.max(1, values[0]); // Ensure we don't take log of 0 or negative
        const maxVal = values[values.length - 1];
        
        // Calculate log range
        const logMin = Math.log(minVal);
        const logMax = Math.log(maxVal);
        const logRange = logMax - logMin;
        
        // Create stops at logarithmically spaced intervals
        let lastValue = -Infinity;
        for (let i = 0; i < numStops; i++) {
            const logValue = logMin + (i / (numStops - 1)) * logRange;
            let value = Math.round(Math.exp(logValue));
            
            // Ensure the value is greater than the last one
            value = Math.max(value, lastValue + 1);
            lastValue = value;
            
            stops.push([value, colorScale[i]]);
        }
    } else {
        // For more evenly distributed data or non-population statistics, use quantiles
        const quantileInterval = 1 / (numStops - 1);
        let lastValue = -Infinity;
        
        for (let i = 0; i < numStops; i++) {
            const quantile = i * quantileInterval;
            const index = Math.floor(quantile * (values.length - 1));
            let value = values[index];
            
            // Ensure the value is greater than the last one
            value = Math.max(value, lastValue + 1);
            lastValue = value;
            
            stops.push([value, colorScale[i]]);
        }
    }
    
    return stops;
}

/**
 * Builds a dynamic 'fill-color' expression for Mapbox GL
 * such that the smallest value is lightest and the largest is darkest.
 * For population-type statistics, uses a more balanced distribution.
 *
 * @param {Object} geoJsonData - The full GeoJSON data.
 * @param {String} statisticKey - The property key to color by (e.g., "aantalInwoners").
 * @returns {Array} Mapbox GL Style expression for 'fill-color'.
 */
export function getDynamicFillColorExpression(geoJsonData, statisticKey) {
    const INVALID_VALUES = [-99995, -99997];
    
    // Check if this is a population-type statistic
    const isPopulationStat = statisticKey === 'aantalInwoners' || 
                            statisticKey === 'mannen' || 
                            statisticKey === 'vrouwen';
    
    // For population statistics, use logarithmic scale to better handle outliers like Amsterdam
    const colorStops = isPopulationStat 
        ? createBalancedColorStops(geoJsonData, statisticKey, 7, true)  // logarithmic for population
        : createBalancedColorStops(geoJsonData, statisticKey, 7, false); // linear for other stats
    
    // Build the expression
    const expression = [
        'interpolate',
        ['linear'],
        [
            'case',
            ['any',
                ['==', ['get', statisticKey], INVALID_VALUES[0]],
                ['==', ['get', statisticKey], INVALID_VALUES[1]],
                ['==', ['get', statisticKey], null],
                ['==', ['typeof', ['get', statisticKey]], 'string']
            ],
            0,  // Convert invalid values to 0
            ['get', statisticKey]  // Use actual value for valid numbers
        ]
    ];
    
    // Add all stops to the expression
    colorStops.forEach(stop => {
        expression.push(stop[0], stop[1]);
    });
    
    return expression;
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
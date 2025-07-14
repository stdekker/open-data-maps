/**
 * Color Service - Handles all map coloring functionality
 * 
 * This service centralizes all map feature coloring operations that were previously
 * spread across multiple files in the application.
 */

// Direct color constants
export const BORDER_COLOR = '#000000';
export const NO_DATA_COLOR = '#D3D3D3';

// Color gradient from lightest to darkest
const COLOR_RANGE = [
    '#f1eef6', // Lightest (very pale purple)
    '#d0d1e6', // Light lavender
    '#a6bddb', // Pale blue
    '#74a9cf', // Light blue
    '#3690c0', // Medium blue
    '#0570b0', // Deep blue
    '#161f40'  // Darkest (navy blue)
];

// Style variants available in the application
export const STYLE_VARIANTS = {
    // Dynamic range is our default style with a color gradient
    DYNAMIC_RANGE: 'dynamic_range',
    
    // Additional styles can be added here in the future
    // CATEGORICAL: 'categorical',
    // HEATMAP: 'heatmap',
    // CHOROPLETH: 'choropleth',
};

/**
 * Get default styling options for a given style variant
 * @param {string} styleVariant - The style variant to get options for
 * @returns {Object} Style options object
 */
export function getStyleOptions(styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE) {
    const styleOptions = {
        // Dynamic range style (default)
        [STYLE_VARIANTS.DYNAMIC_RANGE]: {
            colors: COLOR_RANGE,
            baseFillOpacity: 0.6,
            hoverFillOpacity: 0.8,
            borderColor: BORDER_COLOR,
            borderWidth: 1,
            borderOpacity: 0.2,
            hoverBorderColor: BORDER_COLOR,
            hoverBorderWidth: 1,
            noDataColor: NO_DATA_COLOR
        },
        
        // Additional style variants can be added here with their own default configurations
        // Each variant can have its own color scheme, opacities, etc.
    };
    
    return styleOptions[styleVariant] || styleOptions[STYLE_VARIANTS.DYNAMIC_RANGE];
}

// Invalid value constants
export const INVALID_VALUES = [-99995, -99997];

/**
 * Returns the min and max values for a given statistic from the features array.
 *
 * @param {Object} geoJsonData - The GeoJSON data.
 * @param {String} statisticKey - The property key to look for in features.
 * @returns {Array} [minValue, maxValue]
 */
export function getMinMaxFromGeoJson(geoJsonData, statisticKey) {
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
 * Uses Winsorization to handle outliers by clipping values at 5th and 95th percentiles.
 * For extreme outliers (like a single municipality with 900,000 population), a stronger
 * compression algorithm is applied to ensure the color scale is visually meaningful.
 *
 * @param {Object} geoJsonData - The GeoJSON data
 * @param {String} statisticKey - The property key (e.g., "aantalInwoners")
 * @param {Array} colorRange - Array of color stops to use
 * @returns {Array} Array of [value, color] stops for Mapbox GL
 */
// --- Helper: Percentile Calculation ---
function calculatePercentiles(values, percentiles = [0.02, 0.5, 0.98]) {
    if (!values.length) return [0, 0, 0];
    const sorted = [...values].sort((a, b) => a - b);
    return percentiles.map(p => {
        const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
        return sorted[idx];
    });
}

// --- Helper: Outlier Detection ---
function hasExtremeOutliers(values, median, threshold = 5) {
    if (!values.length || median === 0) return false;
    return values[values.length - 1] / median > threshold;
}

// --- Helper: Logarithmic Stops Calculation ---
function calculateLogStops(minVal, maxVal, numStops, compress = false) {
    const logMin = Math.log(minVal);
    const logMax = Math.log(maxVal);
    const logRange = logMax - logMin;
    const stopsPositions = [];
    for (let i = 0; i < numStops; i++) {
        const t = i / (numStops - 1);
        stopsPositions.push(compress ? Math.sqrt(t) : t);
    }
    const stops = [];
    let lastValue = -Infinity;
    for (let i = 0; i < numStops; i++) {
        const logValue = logMin + stopsPositions[i] * logRange;
        let value = Math.round(Math.exp(logValue));
        value = Math.max(value, lastValue + 1);
        lastValue = value;
        stops.push(value);
    }
    return stops;
}

/**
 * Creates stops for a more balanced color scale distribution for population data.
 * Uses Winsorization to handle outliers by clipping values at 5th and 95th percentiles.
 * For extreme outliers (like a single municipality with 900,000 population), a stronger
 * compression algorithm is applied to ensure the color scale is visually meaningful.
 *
 * @param {Object} geoJsonData - The GeoJSON data
 * @param {String} statisticKey - The property key (e.g., "aantalInwoners")
 * @param {Array} colorRange - Array of color stops to use
 * @returns {Array} Array of [value, color] stops for Mapbox GL
 */
export function createBalancedColorStops(geoJsonData, statisticKey, colorRange = COLOR_RANGE) {
    // Validation checks
    if (!geoJsonData || !geoJsonData.features || !Array.isArray(geoJsonData.features) || !statisticKey) {
        console.error('Invalid data or statisticKey in createBalancedColorStops');
        return [[0, colorRange[0]]]; // Default single stop
    }
    const numStops = colorRange.length;
    const values = geoJsonData.features
        .map(f => {
            const val = f.properties[statisticKey];
            return (typeof val === 'number' && !isNaN(val) && val !== null && !INVALID_VALUES.includes(val) && val !== 0)
                ? val
                : null;
        })
        .filter(val => val !== null)
        .sort((a, b) => a - b);
    if (!values || values.length === 0) {
        console.warn('No valid values found for statisticKey:', statisticKey);
        return [[0, colorRange[0]]];
    }
    if (values[0] === values[values.length - 1]) {
        return [
            [values[0], colorRange[0]],
            [values[0] + 0.5, colorRange[Math.floor(colorRange.length / 2)]],
            [values[0] + 1, colorRange[colorRange.length - 1]]
        ];
    }
    // Calculate percentiles for Winsorization, excluding zeros
    const nonZeroValues = values.filter(v => v > 0);
    if (!nonZeroValues.length) {
        console.warn('No positive values found for statisticKey:', statisticKey);
        return [[0, colorRange[0]]];
    }
    const [p5, p50, p95] = calculatePercentiles(nonZeroValues, [0.02, 0.5, 0.98]);
    const outliers = hasExtremeOutliers(values, p50, 5);
    const minVal = Math.max(1, p5);
    const maxVal = p95;
    const logStops = calculateLogStops(minVal, maxVal, numStops, outliers);
    const stops = logStops.map((val, i) => [val, colorRange[i]]);
    // Add stops for the extreme values
    if (stops[0][0] > values[0]) {
        stops.unshift([values[0], stops[0][1]]);
    }
    if (stops[stops.length - 1][0] < values[values.length - 1]) {
        stops.push([values[values.length - 1], stops[stops.length - 1][1]]);
    }
    return stops;
}


/**
 * Creates a set of styling options for the layer config based on the selected style variant and custom overrides
 * @param {Object} geoJsonData - The GeoJSON data for styling
 * @param {String} statisticKey - The statistic key to color by
 * @param {String} styleVariant - The style variant to use (from STYLE_VARIANTS)
 * @param {Object} customOptions - Optional custom style options to override defaults
 * @returns {Object} Complete style configuration 
 */
export function createStyleConfig(geoJsonData, statisticKey, styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE, customOptions = {}) {
    // Get base options for the selected style variant
    const baseOptions = getStyleOptions(styleVariant);
    
    // Create fill color expression based on the style variant
    let fillColorExpression;
    
    if (styleVariant === STYLE_VARIANTS.DYNAMIC_RANGE) {
        fillColorExpression = getDynamicFillColorExpression(geoJsonData, statisticKey, baseOptions.colors);
    } 
    // Add more style variants here as needed
    // else if (styleVariant === STYLE_VARIANTS.CATEGORICAL) { ... }
    // else if (styleVariant === STYLE_VARIANTS.HEATMAP) { ... }
    
    // Return the complete style configuration with custom overrides
    return {
        fillColor: fillColorExpression,
        ...baseOptions,
        ...customOptions
    };
}

/**
 * Builds a dynamic 'fill-color' expression for Mapbox GL
 * such that the smallest value is lightest and the largest is darkest.
 * For population-type statistics, uses a more balanced distribution.
 *
 * @param {Object} geoJsonData - The full GeoJSON data.
 * @param {String} statisticKey - The property key to color by (e.g., "aantalInwoners").
 * @param {Array} colorRange - Array of color stops to use
 * @returns {Array} Mapbox GL Style expression for 'fill-color'.
 */
export function getDynamicFillColorExpression(geoJsonData, statisticKey, colorRange = COLOR_RANGE) {
    // Ensure geoJsonData and features are not null/undefined
    if (!geoJsonData || !geoJsonData.features || !Array.isArray(geoJsonData.features) || !statisticKey) {
        console.error('Invalid data or statisticKey in getDynamicFillColorExpression');
        return ['literal', NO_DATA_COLOR]; // Return a simple literal expression with no-data color
    }
    
    // For population statistics, use logarithmic scale to better handle outliers like Amsterdam
    const colorStops = createBalancedColorStops(geoJsonData, statisticKey, colorRange);
    
    // If no color stops were generated, return a default color expression
    if (!colorStops || colorStops.length === 0) {
        console.warn('No color stops generated for statisticKey:', statisticKey);
        return ['literal', NO_DATA_COLOR];
    }
    
    // Build the expression
    const expression = [
        'case',
        ['any',
            ['==', ['get', statisticKey], INVALID_VALUES[0]],
            ['==', ['get', statisticKey], INVALID_VALUES[1]],
            ['==', ['get', statisticKey], null],
            ['==', ['typeof', ['get', statisticKey]], 'string'],
            ['==', ['get', statisticKey], 0] // Also treat zero values as no data
        ],
        NO_DATA_COLOR,  // Use light grey for invalid/no data values
        [
            'interpolate',
            ['linear'],
            ['get', statisticKey],
            // Add all stops to the expression
            ...colorStops.flatMap(stop => stop && stop.length === 2 ? [stop[0], stop[1]] : [])
        ]
    ];
    
    return expression;
}

/**
 * Updates map colors based on the selected statistic for municipality layer
 * @param {Object} map - The Mapbox map instance
 * @param {String} statisticKey - The statistic key to color by
 * @param {String} layerId - The base layer ID to update (default: 'municipalities')
 * @param {String} sourceId - The source ID to get data from (default: 'municipalities')
 * @param {String} styleVariant - Optional style variant to use
 * @param {Object} styleOptions - Optional style overrides
 */
export function updateLayerColors(map, statisticKey, layerId = 'municipalities', sourceId = 'municipalities', styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE, styleOptions = {}) {
    if (map.getSource(sourceId)) {
        const source = map.getSource(sourceId);
        const data = source._data; // Get current GeoJSON data
        
        // Get the style configuration
        const styleConfig = createStyleConfig(data, statisticKey, styleVariant, styleOptions);
        
        const fillLayerId = `${layerId}-fill`;
        
        // Update fill color for the main layer
        if (map.getLayer(fillLayerId)) {
            map.setPaintProperty(fillLayerId, 'fill-color', styleConfig.fillColor);
        }
    }
}

/**
 * Updates colors for postcode layer
 * @param {Object} map - The Mapbox map instance
 * @param {String} statisticKey - The statistic key to color by
 */
export function updatePostcodeColors(map, statisticKey) {
    if (map.getSource('postcode6')) {
        const source = map.getSource('postcode6');
        const data = source._data; // Get current GeoJSON data
        const fillColorExpression = getDynamicFillColorExpression(data, statisticKey);
        const borderColor = BORDER_COLOR;
        
        // Update fill color and its outline
        map.setPaintProperty('postcode6-fill', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#8aa0d1', // Hover color
            fillColorExpression
        ]);
        
        map.setPaintProperty('postcode6-fill', 'fill-outline-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#8aa0d1', // Hover color
            borderColor
        ]);
        
        // Update line color for separate border layer
        map.setPaintProperty('postcode6-line', 'line-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#8aa0d1', // Hover color
            borderColor
        ]);
    }
}

/**
 * Sets up color visualization for party votes in election reporting units
 * @param {Object} map - The Mapbox map instance
 * @param {String} partyName - The party name to visualize votes for
 * @param {Number} minVotes - The minimum votes value
 * @param {Number} maxVotes - The maximum votes value
 */
export function showPartyVotesColors(map, partyName, minVotes, maxVotes) {
    // Update the color of the existing reporting units layer
    map.setPaintProperty('reporting-units', 'circle-color', [
        'interpolate',
        ['linear'],
        ['get', partyName],
        minVotes, '#000000',  // Black for lowest votes
        minVotes + (maxVotes - minVotes) * 0.33, '#FF0000',  // Red for low-mid votes
        minVotes + (maxVotes - minVotes) * 0.66, '#FFFF00',  // Yellow for high-mid votes
        maxVotes, '#FFFFFF'   // White for highest votes
    ]);
}

/**
 * Sets up color visualization based on percentage of votes for a party in election reporting units
 * @param {Object} map - The Mapbox map instance
 * @param {String} partyName - The party name to visualize votes for
 * @param {String} totalVotesKey - The property key for total votes cast at each polling station
 */
export function showPartyVotePercentageColors(map, partyName, totalVotesKey = 'totalVotes') {
    // Create a percentage expression using MapboxGL expressions
    // This calculates the percentage on-the-fly for each feature
    const percentageExpression = [
        '/',
        ['*', 
            ['/', 
                ['get', partyName], 
                ['max', ['get', totalVotesKey], 1]  // Avoid division by zero
            ],
            100  // Convert to percentage
        ],
        1  // Ensure numeric result
    ];
    
    // Update the color of the reporting units based on percentage
    map.setPaintProperty('reporting-units', 'circle-color', [
        'interpolate',
        ['linear'],
        percentageExpression,
        0, '#000000',    // Black for 0%
        10, '#800000',   // Dark red for 10%
        20, '#FF0000',   // Red for 20%
        30, '#FF8000',   // Orange for 30%
        40, '#FFFF00',   // Yellow for 40%
        50, '#FFFF80',   // Light yellow for 50%
        60, '#FFFFFF',   // White for 60% and above
    ]);
}

/**
 * Resets party votes visualization colors
 * @param {Object} map - The Mapbox map instance
 */
export function resetPartyVotesColors(map) {
    // Reset the circle color back to white
    map.setPaintProperty('reporting-units', 'circle-color', '#FFFFFF');
}

/**
 * Creates a Mapbox GL Style expression for coloring based on party vote percentage.
 * Uses a sequential color scale from light (low %) to dark (high %).
 *
 * @param {Object} geoJsonData - The GeoJSON data (used to determine range if needed, though 0-100 is standard).
 * @param {String} partyPercentageKey - The property key holding the percentage (e.g., 'party_percentage_VVD').
 * @param {Number} minPercentage - The minimum percentage value for the current party/data.
 * @param {Number} maxPercentage - The maximum percentage value for the current party/data.
 * @param {Array} colorRange - Optional color range (defaults to a blue sequential scale).
 * @returns {Array} Mapbox GL Style expression for 'fill-color'.
 */
export function getPartyPercentageColorExpression(geoJsonData, partyPercentageKey, minPercentage = 0, maxPercentage = 100, colorRange = null) {
    // Define a default sequential color range suitable for percentages (light to dark)
    const defaultPercentageColors = [
        '#eff3ff', // Very light blue
        '#c6dbef', 
        '#9ecae1',
        '#6baed6',
        '#4292c6',
        '#2171b5',
        '#084594'  // Dark blue
    ];
    
    const colorsToUse = colorRange || defaultPercentageColors;
    const numSteps = colorsToUse.length;

    // Handle edge case: min and max are the same
    if (minPercentage === maxPercentage) {
        // Assign the middle color to this single value
        const middleColorIndex = Math.floor(numSteps / 2);
        return [
            'case',
            ['==', ['get', partyPercentageKey], null],
            NO_DATA_COLOR,
            ['==', ['to-number', ['get', partyPercentageKey]], minPercentage],
            colorsToUse[middleColorIndex],
            NO_DATA_COLOR // Fallback for any unexpected values
        ];
    }

    // Define percentage stops based on the provided min/max range
    const percentageStops = [];
    const range = maxPercentage - minPercentage;
    for (let i = 0; i < numSteps; i++) {
        // Calculate the value at this step within the min/max range
        const value = minPercentage + (range * (i / (numSteps - 1)));
        percentageStops.push(value);
    }
    
    // Build the interpolation steps
    const interpolationSteps = percentageStops.flatMap((stopValue, index) => {
        // Ensure we don't exceed the color array bounds
        const colorIndex = Math.min(index, colorsToUse.length - 1);
        return [stopValue, colorsToUse[colorIndex]];
    });
    
    // Build the final expression
    const expression = [
        'case',
        // Simplified Condition: Directly check for null
        ['==', ['get', partyPercentageKey], null],
        NO_DATA_COLOR, // Use no-data color if the percentage property is null
        // Default Case: Value is not null, proceed with interpolation
        [
            'interpolate',
            ['linear'],
            // Add coalesce and to-number for robustness against non-numeric values (though should be number or null)
            ['coalesce', ['to-number', ['get', partyPercentageKey]], 0],
            ...interpolationSteps
        ]
    ];

    return expression;
} 
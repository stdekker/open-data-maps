import { getDynamicFillColorExpression, findFirstSymbolLayer, cleanupLayers } from '../layerService.js';
import { populateStatisticsSelect } from '../UIFeatureInfoBox.js';
import { setMunicipalityPostcodes, cleanupPostcode6Layer, resetPostcode6Toggle } from './postcodeLayer.js';

/**
 * Updates the map colors based on the selected statistic
 * @param {Object} map - The Mapbox map instance
 * @param {String} statisticKey - The statistic key to color by
 */
export function updateMapColors(map, statisticKey) {
    if (map.getSource('municipalities')) {
        const source = map.getSource('municipalities');
        const data = source._data; // Get current GeoJSON data
        const fillColorExpression = getDynamicFillColorExpression(data, statisticKey);
        map.setPaintProperty('municipalities', 'fill-color', fillColorExpression);
    }
}

/**
 * Adds municipality layers to the map with dynamic coloring based on statistics.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing municipality features
 * @param {Object} municipalityPopulations - Population data for municipalities
 * @param {String} statisticKey - The statistic to use for coloring (e.g. 'aantalInwoners')
 */
export function addMunicipalityLayers(map, geoJsonData, municipalityPopulations, statisticKey = 'aantalInwoners') {
    // Clean up existing layers and sources first
    cleanupLayers(map, ['municipality-borders', 'municipalities'], ['municipalities']);

    // Clean up postcode layer if it exists
    if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-line') || map.getSource('postcode6')) {
        console.log('Cleaning up existing postcode6 layers in addMunicipalityLayers...');
        cleanupPostcode6Layer(map);
    }
    resetPostcode6Toggle();

    // Set municipality postcodes for postcode layer functionality
    setMunicipalityPostcodes(geoJsonData);

    // Find the first symbol layer in the map style
    const firstSymbolId = findFirstSymbolLayer(map);

    // Add the GeoJSON source immediately
    map.addSource('municipalities', {
        type: 'geojson',
        data: geoJsonData,
        generateId: true
    });

    // Populate statistics select with available data
    const statsSelect = document.getElementById('statsSelect');
    populateStatisticsSelect(statsSelect, geoJsonData);

    // Get a dynamic fill-color expression for this statisticKey
    const fillColorExpression = getDynamicFillColorExpression(geoJsonData, statisticKey);

    // Add GeoJSON geometry layers before symbol layers
    map.addLayer({
        'id': 'municipalities',
        'type': 'fill',
        'source': 'municipalities',
        'paint': {
            'fill-color': fillColorExpression,
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.8,
                0.6
            ],
            'fill-outline-color': '#00509e'
        }
    }, firstSymbolId);

    map.addLayer({
        'id': 'municipality-borders',
        'type': 'line',
        'source': 'municipalities',
        'paint': {
            'line-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#99c2ff',
                '#00509e'
            ],
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                2,
                1
            ]
        }
    }, firstSymbolId);
} 
import { findFirstSymbolLayer, cleanupLayers, addMapLayers } from '../services/layerService.js';
import { updateLayerColors, STYLE_VARIANTS } from '../services/colorService.js';
import { populateStatisticsSelect } from '../UIFeatureInfoBox.js';
import { setMunicipalityPostcodes, cleanupPostcode6Layer, resetPostcode6Toggle, loadAllPostcode6Data } from './postcodeLayer.js';
import * as State from '../state.js';

/**
 * Updates the map colors based on the selected statistic
 * @param {Object} map - The Mapbox map instance
 * @param {String} statisticKey - The statistic key to color by
 */
export function updateMapColors(map, statisticKey) {
    updateLayerColors(map, statisticKey, 'municipalities', 'municipalities', STYLE_VARIANTS.DYNAMIC_RANGE);
}

/**
 * Adds municipality layers to the map with dynamic coloring based on statistics.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing municipality features
 * @param {Object} municipalityPopulations - Population data for municipalities
 * @param {String} statisticKey - The statistic to use for coloring (e.g. 'aantalInwoners')
 * @param {String} styleVariant - The style variant to use (default: 'dynamic_range')
 */
export function addMunicipalityLayers(map, geoJsonData, municipalityPopulations, statisticKey = 'aantalInwoners', styleVariant = STYLE_VARIANTS.DYNAMIC_RANGE) {
    // Clean up existing layers and sources first
    cleanupLayers(map, 
        ['municipalities-fill', 'municipalities-borders', 'municipalities-hover'], 
        ['municipalities']
    );

    // Check if the postcode toggle is active
    const postcode6Toggle = document.getElementById('postcode6Toggle');
    const isPostcodeActive = postcode6Toggle && postcode6Toggle.getAttribute('aria-pressed') === 'true';

    // Always clean up existing postcode layers when switching municipalities
    if (map.getLayer('postcode6-fill') || map.getLayer('postcode6-borders') || map.getLayer('postcode6-hover') || map.getSource('postcode6')) {
        console.log('Cleaning up existing postcode6 layers when switching municipalities...');
        cleanupPostcode6Layer(map);
    }

    // Only handle postcode functionality in municipal view, not national view
    if (State.getCurrentView() === 'municipal') {
        // Set municipality postcodes for postcode layer functionality
        setMunicipalityPostcodes(geoJsonData);
        
        // If postcode toggle is active, reload postcodes for the new municipality
        if (isPostcodeActive) {
            // Small delay to ensure municipality data is fully loaded
            setTimeout(() => {
                loadAllPostcode6Data(map);
            }, 100);
        }
    }

    // Find the first symbol layer in the map style
    const firstSymbolId = findFirstSymbolLayer(map);

    // Check if the source already exists before adding it
    if (!map.getSource('municipalities')) {
        // Add the GeoJSON source
        map.addSource('municipalities', {
            type: 'geojson',
            data: geoJsonData,
            generateId: true
        });
    } else {
        // Update the existing source data
        map.getSource('municipalities').setData(geoJsonData);
    }

    // Populate statistics select with available data
    const statsSelect = document.getElementById('statsSelect');
    populateStatisticsSelect(statsSelect, geoJsonData);

    // Create simplified layer configuration that only specifies 
    // the fundamental layer properties and the style variant
    const layerConfig = {
        idBase: 'municipalities',
        source: 'municipalities',
        data: geoJsonData,
        statisticKey: statisticKey,
        styleVariant: styleVariant,
        insertBeforeLayer: firstSymbolId
    };

    // Add layers using the generic function
    addMapLayers(map, layerConfig);
} 
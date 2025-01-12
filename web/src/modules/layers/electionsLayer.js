import { cleanupLayers } from '../layerService.js';
import { setupReportingUnitPopupHandlers } from '../electionService.js';

/**
 * Adds election reporting unit markers to the map.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing reporting unit locations
 * @param {Boolean} showElectionData - Whether election data should be displayed
 */
export function addReportingUnits(map, geoJsonData, showElectionData = false) {
    // Clean up existing reporting units first, before adding new ones
    cleanupReportingUnits(map);
    
    if (!showElectionData || !geoJsonData || !geoJsonData.features || !geoJsonData.features.length) {
        return;
    }

    if (map.getSource('reporting-units')) {
        // Update the data of the existing source
        map.getSource('reporting-units').setData(geoJsonData);
    } else {
        // Add the reporting units source with original data
        map.addSource('reporting-units', {
            type: 'geojson',
            data: geoJsonData
        });

        // Add reporting units layer with dynamic radius
        map.addLayer({
            'id': 'reporting-units',
            'type': 'circle',
            'source': 'reporting-units',
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['get', 'totalCounted'],
                    0, 6,
                    500, 8,
                    2000, 12,
                    5000, 16,
                    10000, 22,
                    20000, 30
                ],
                'circle-color': '#4CAF50',
                'circle-opacity': 0.6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        });

        // Setup popup handlers
        setupReportingUnitPopupHandlers(map);
    }
}

/**
 * Removes all reporting unit layers and sources from the map.
 * Used when switching views or cleaning up old election data.
 * @param {Object} map - The Mapbox map instance
 */
export function cleanupReportingUnits(map) {
    try {
        cleanupLayers(map, 
            ['reporting-units', 'reporting-units-fill', 'reporting-units-line'],
            ['reporting-units']
        );
    } catch (error) {
        console.warn('Error cleaning up reporting units:', error);
    }
} 
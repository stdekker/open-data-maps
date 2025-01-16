import { cleanupLayers } from '../layerService.js';
import { setupReportingUnitPopupHandlers } from '../electionService.js';

// Global size factor for all circles (decrease to make circles smaller)
const CIRCLE_SIZE_FACTOR = 0.4;

// Zoom level at which reporting unit display mode switches
const REPORTING_UNIT_ZOOM_THRESHOLD = 13;

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

        // Add the expected turnout layer (black transparent circle)
        map.addLayer({
            'id': 'reporting-units-expected',
            'type': 'circle',
            'source': 'reporting-units',
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['get', 'cast'],
                    0, 0,
                    500, ['*', 15, CIRCLE_SIZE_FACTOR],
                    2000, ['*', 25, CIRCLE_SIZE_FACTOR],
                    5000, ['*', 35, CIRCLE_SIZE_FACTOR]
                ],
                'circle-radius-transition': {
                    'duration': 300
                },
                'circle-color': '#000000',
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    11, 0,  // Fully transparent before zoom 11
                    REPORTING_UNIT_ZOOM_THRESHOLD, 0.2 // Fade to 0.2 opacity at threshold
                ],
                'circle-opacity-transition': {
                    'duration': 300
                },
                'circle-stroke-width': 1,
                'circle-stroke-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    11, 0,
                    REPORTING_UNIT_ZOOM_THRESHOLD, 0.5
                ],
                'circle-stroke-opacity-transition': {
                    'duration': 300
                }
            }
        });

        // Add the actual turnout layer (white circle)
        map.addLayer({
            'id': 'reporting-units',
            'type': 'circle',
            'source': 'reporting-units',
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 4,    // Small fixed size when zoomed out
                    11, 4,   // Still fixed size
                    REPORTING_UNIT_ZOOM_THRESHOLD, [    // Start scaling based on turnout percentage
                        '*',
                        [
                            'interpolate',
                            ['linear'],
                            ['get', 'cast'],
                            0, 0,
                            500, ['*', 15, CIRCLE_SIZE_FACTOR],
                            2000, ['*', 25, CIRCLE_SIZE_FACTOR],
                            5000, ['*', 35, CIRCLE_SIZE_FACTOR]
                        ],
                        ['/', ['get', 'totalCounted'], ['get', 'cast']]  // Percentage of expected turnout
                    ]
                ],
                'circle-radius-transition': {
                    'duration': 300
                },
                'circle-color': '#FFFFFF',
                'circle-opacity': 0.8,
                'circle-opacity-transition': {
                    'duration': 300
                },
                'circle-stroke-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    11, 1,
                    REPORTING_UNIT_ZOOM_THRESHOLD, 0
                ],
                'circle-stroke-width-transition': {
                    'duration': 300
                },
                'circle-stroke-color': '#000000'
            }
        });

        // Setup popup handlers
        setupReportingUnitPopupHandlers(map);
    }
}

/**
 * Updates the party votes layer to show votes for a specific party
 * @param {Object} map - The Mapbox map instance
 * @param {String} partyName - The name of the party to show votes for
 * @param {Number} minVotes - The minimum votes for the party
 * @param {Number} maxVotes - The maximum votes for the party
 */
export function showPartyVotes(map, partyName, minVotes, maxVotes) {
    // Update the color of the existing reporting units layer
    map.setPaintProperty('reporting-units', 'circle-color', [
        'interpolate',
        ['linear'],
        ['get', partyName],
        minVotes, '#0000FF',  // Blue for lowest votes
        (minVotes + maxVotes) / 2, '#FF00FF', // Purple for average votes
        maxVotes, '#FF0000'   // Red for highest votes
    ]);
}

/**
 * Removes the party votes visualization
 * @param {Object} map - The Mapbox map instance
 */
export function hidePartyVotes(map) {
    // Reset the circle color back to white
    map.setPaintProperty('reporting-units', 'circle-color', '#FFFFFF');
}

/**
 * Removes all reporting unit layers and sources from the map.
 * Used when switching views or cleaning up old election data.
 * @param {Object} map - The Mapbox map instance
 */
export function cleanupReportingUnits(map) {
    try {
        cleanupLayers(map, 
            ['reporting-units', 'reporting-units-expected', 'party-votes'],
            ['reporting-units']
        );
    } catch (error) {
        console.warn('Error cleaning up reporting units:', error);
    }
} 
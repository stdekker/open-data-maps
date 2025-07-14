import { cleanupLayers } from '../services/layerService.js';
import { setupReportingUnitPopupHandlers } from '../services/electionService.js';
import { showPartyVotesColors, resetPartyVotesColors } from '../services/colorService.js';

// Global size factor for all circles (decrease to make circles smaller)
const CIRCLE_SIZE_FACTOR = 0.4;

// Zoom level at which reporting unit display mode switches
const REPORTING_UNIT_ZOOM_THRESHOLD = 13;

/**
 * Generates a circle radius calculation expression based on expected turnout.
 * @returns {Array} Mapbox expression for circle radius calculation
 */
function getExpectedTurnoutRadiusExpression() {
    return [
        'interpolate',
        ['linear'],
        ['get', 'cast'],
        0, 0,
        500, ['*', 15, CIRCLE_SIZE_FACTOR],
        2000, ['*', 25, CIRCLE_SIZE_FACTOR],
        5000, ['*', 35, CIRCLE_SIZE_FACTOR]
    ];
}

/**
 * Generates a circle radius calculation expression based on actual turnout and zoom level.
 * @returns {Array} Mapbox expression for circle radius calculation with zoom factor
 */
function getActualTurnoutRadiusExpression() {
    return [
        'interpolate',
        ['linear'],
        ['zoom'],
        8, 4,    // Small fixed size when zoomed out
        11, 4,   // Still fixed size
        REPORTING_UNIT_ZOOM_THRESHOLD, [    // Start scaling based on turnout percentage
            '*',
            getExpectedTurnoutRadiusExpression(),
            ['/', ['get', 'totalCounted'], ['get', 'cast']]  // Percentage of expected turnout
        ]
    ];
}

/**
 * Adds or updates the reporting units source on the map.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing reporting unit locations
 */
function addReportingUnitsSource(map, geoJsonData) {
    if (map.getSource('reporting-units')) {
        // Update the data of the existing source
        map.getSource('reporting-units').setData(geoJsonData);
    } else {
        // Add the reporting units source with original data
        map.addSource('reporting-units', {
            type: 'geojson',
            data: geoJsonData
        });
    }
}

/**
 * Adds reporting units layers to the map.
 * @param {Object} map - The Mapbox map instance
 */
function addReportingUnitsLayers(map) {
    // Check if layers already exist
    if (map.getLayer('reporting-units')) {
        return;
    }

    // Add the expected turnout layer (black transparent circle)
    map.addLayer({
        'id': 'reporting-units-expected',
        'type': 'circle',
        'source': 'reporting-units',
        'paint': {
            'circle-radius': getExpectedTurnoutRadiusExpression(),
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
            'circle-radius': getActualTurnoutRadiusExpression(),
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

    // Add the reporting units source
    addReportingUnitsSource(map, geoJsonData);
    
    // Add the reporting units layers
    addReportingUnitsLayers(map);
}

/**
 * Shows the party votes on the map
 * @param {Object} map - The Mapbox map instance
 * @param {String} partyName - The party name to visualize votes for
 * @param {Number} minVotes - The minimum votes value
 * @param {Number} maxVotes - The maximum votes value
 */
export function showPartyVotes(map, partyName, minVotes, maxVotes) {
    showPartyVotesColors(map, partyName, minVotes, maxVotes);
}

/**
 * Removes the party votes visualization
 * @param {Object} map - The Mapbox map instance
 */
export function hidePartyVotes(map) {
    resetPartyVotesColors(map);
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
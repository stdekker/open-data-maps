/**
 * Walking List Service - Generates walking lists of streets with house number ranges
 * for BAG verblijfsobjecten within a selected buurt/wijk feature.
 */

/**
 * Parses a house number string and extracts the numeric part and suffix
 * Handles formats like "12", "12A", "12-14", "12A-14B"
 * @param {string} huisnummer - The house number string
 * @returns {Object} Object with numeric value and suffix
 */
function parseHouseNumber(huisnummer) {
    if (!huisnummer) return { numeric: 0, suffix: '', full: '' };
    
    const str = String(huisnummer).trim();
    
    // Handle ranges like "12-14" or "12A-14B"
    if (str.includes('-')) {
        const parts = str.split('-');
        const start = parseHouseNumber(parts[0]);
        return { numeric: start.numeric, suffix: start.suffix, full: str, isRange: true };
    }
    
    // Extract numeric part and suffix
    const match = str.match(/^(\d+)([A-Za-z]*)$/);
    if (match) {
        return {
            numeric: parseInt(match[1], 10),
            suffix: match[2] || '',
            full: str
        };
    }
    
    // Fallback: try to extract any number
    const numMatch = str.match(/\d+/);
    if (numMatch) {
        return {
            numeric: parseInt(numMatch[0], 10),
            suffix: str.replace(numMatch[0], ''),
            full: str
        };
    }
    
    return { numeric: 0, suffix: '', full: str };
}

/**
 * Compares two house numbers for sorting
 * @param {string} a - First house number
 * @param {string} b - Second house number
 * @returns {number} Comparison result
 */
function compareHouseNumbers(a, b) {
    const parsedA = parseHouseNumber(a);
    const parsedB = parseHouseNumber(b);
    
    if (parsedA.numeric !== parsedB.numeric) {
        return parsedA.numeric - parsedB.numeric;
    }
    
    // If numeric parts are equal, compare suffixes
    return parsedA.suffix.localeCompare(parsedB.suffix);
}

/**
 * Calculates house number range from an array of house numbers
 * Returns only the lowest and highest house numbers separated by a dash
 * @param {Array<string>} houseNumbers - Array of house number strings
 * @returns {string} Formatted range string (e.g., "1-45")
 */
function calculateRanges(houseNumbers) {
    if (houseNumbers.length === 0) return '';
    if (houseNumbers.length === 1) return houseNumbers[0];
    
    // Sort house numbers
    const sorted = [...houseNumbers].sort(compareHouseNumbers);
    
    // Return lowest and highest separated by dash
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    
    // If they're the same, just return the single value
    if (lowest === highest) {
        return lowest;
    }
    
    return `${lowest}-${highest}`;
}

/**
 * Filters BAG points that are within the given polygon geometry
 * @param {Array<Object>} bagFeatures - Array of BAG feature objects
 * @param {Object} polygonGeometry - GeoJSON polygon geometry
 * @returns {Array<Object>} Filtered features within the polygon
 */
function filterPointsInPolygon(bagFeatures, polygonGeometry) {
    if (!bagFeatures || bagFeatures.length === 0) return [];
    if (!polygonGeometry || !polygonGeometry.coordinates) return [];
    
    // Create a Turf polygon/multipolygon from the geometry
    const polygonOrMultiPolygon =
        polygonGeometry.type === 'MultiPolygon'
            ? turf.multiPolygon(polygonGeometry.coordinates)
            : turf.polygon(polygonGeometry.coordinates);
    
    // Filter points that are inside the polygon
    return bagFeatures.filter(feature => {
        if (!feature.geometry || feature.geometry.type !== 'Point') {
            return false;
        }
        
        const point = turf.point(feature.geometry.coordinates);
        return turf.booleanPointInPolygon(point, polygonOrMultiPolygon);
    });
}

/**
 * Groups addresses by street name
 * @param {Array<Object>} features - Filtered BAG features
 * @returns {Object} Object mapping street names to aggregation buckets
 */
function groupByStreet(features) {
    const streets = {};
    
    features.forEach(feature => {
        const streetName = feature.properties?.openbare_ruimte;
        const houseNumber = feature.properties?.huisnummer;
        const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
        
        if (!streetName || !coords) return;
        
        if (!streets[streetName]) {
            streets[streetName] = {
                houseNumbers: new Set(),
                points: [],
                addressCount: 0
            };
        }
        
        streets[streetName].addressCount += 1;
        streets[streetName].points.push(coords);

        // Keep unique house numbers for range display (may be null/empty)
        if (houseNumber !== undefined && houseNumber !== null && String(houseNumber).trim() !== '') {
            streets[streetName].houseNumbers.add(String(houseNumber).trim());
        }
    });
    
    return streets;
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function getStreetRepresentativePoint(points) {
    const lngs = [];
    const lats = [];
    points.forEach((c) => {
        if (!Array.isArray(c) || c.length < 2) return;
        lngs.push(c[0]);
        lats.push(c[1]);
    });
    if (!lngs.length) return null;
    return [median(lngs), median(lats)];
}

function distanceKm(a, b) {
    const pa = turf.point(a);
    const pb = turf.point(b);
    return turf.distance(pa, pb, { units: 'kilometers' });
}

function orderStreetsNearestNeighbor(streets, startPoint) {
    if (!streets.length) return streets;
    if (!startPoint) return streets;

    const remaining = streets.slice();
    const ordered = [];
    let current = startPoint;

    while (remaining.length) {
        let bestIdx = 0;
        let bestDist = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const p = remaining[i].point;
            if (!p) continue;
            const d = distanceKm(current, p);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        const next = remaining.splice(bestIdx, 1)[0];
        ordered.push(next);
        if (next.point) current = next.point;
    }

    return ordered;
}

/**
 * Gets the full feature geometry from the source data
 * Mapbox rendered features can have clipped/simplified geometries
 * @param {Object} map - The Mapbox map instance
 * @param {Object} feature - The feature from a map event (may have incomplete geometry)
 * @returns {Object|null} The full geometry from source, or null if not found
 */
function getFullFeatureGeometry(map, feature) {
    if (!feature) return null;
    
    // Determine the source name
    const sourceName = feature.source || 'municipalities';
    const source = map.getSource(sourceName);
    
    if (!source || !source._data) {
        // Fallback to the feature's geometry if we can't access source
        return feature.geometry;
    }
    
    const sourceData = source._data;
    if (!sourceData.features) {
        return feature.geometry;
    }
    
    // Find the matching feature in the source data by ID
    const featureId = feature.id;
    if (featureId !== undefined && featureId !== null) {
        const sourceFeature = sourceData.features.find((f, idx) => {
            // GeoJSON sources with generateId: true use array index as ID
            return idx === featureId || f.id === featureId;
        });
        if (sourceFeature && sourceFeature.geometry) {
            return sourceFeature.geometry;
        }
    }
    
    // Fallback: try to match by properties (naam, buurtcode, etc.)
    const props = feature.properties || {};
    const matchKeys = ['buurtcode', 'wijkcode', 'naam', 'buurtnaam', 'wijknaam'];
    for (const key of matchKeys) {
        if (props[key]) {
            const sourceFeature = sourceData.features.find(f => 
                f.properties && f.properties[key] === props[key]
            );
            if (sourceFeature && sourceFeature.geometry) {
                return sourceFeature.geometry;
            }
        }
    }
    
    // Last resort: use the feature's geometry as-is
    return feature.geometry;
}

/**
 * Generates a walking list for a given feature
 * @param {Object} map - The Mapbox map instance
 * @param {Object} feature - The buurt/wijk feature with geometry
 * @param {Object} [options]
 * @param {[number, number]} [options.startPoint] - [lng, lat] start point for ordering
 * @returns {Promise<Object>} Object containing feature name and walking list data
 */
export async function generateWalkingList(map, feature, options = {}) {
    if (!map || !feature) {
        throw new Error('Invalid parameters: map and feature are required');
    }
    
    // Get the full geometry from the source (rendered features can be clipped)
    const fullGeometry = getFullFeatureGeometry(map, feature);
    if (!fullGeometry) {
        throw new Error('Could not retrieve feature geometry');
    }
    
    // Get BAG source from map
    const bagSource = map.getSource('bag-verblijfsobjecten');
    if (!bagSource) {
        throw new Error('BAG layer is not loaded. Please enable the BAG layer first.');
    }
    
    // Get all features from the BAG source
    // Mapbox GeoJSON sources store data in _data property
    const bagData = bagSource._data;
    if (!bagData || !bagData.features || bagData.features.length === 0) {
        throw new Error('No BAG data available. Please wait for BAG data to load.');
    }
    
    const bagFeatures = bagData.features;
    
    // Filter points within the polygon using the FULL geometry
    const filteredFeatures = filterPointsInPolygon(bagFeatures, fullGeometry);
    
    if (filteredFeatures.length === 0) {
        return {
            featureName: feature.properties?.naam || 'Onbekend gebied',
            streets: [],
            totalAddresses: 0
        };
    }
    
    // Group by street
    const streetsGrouped = groupByStreet(filteredFeatures);
    
    // Convert to sorted array with ranges
    const streetsUnordered = Object.keys(streetsGrouped)
        .sort((a, b) => a.localeCompare(b, 'nl-NL'))
        .map(streetName => {
            const bucket = streetsGrouped[streetName];
            const houseNumbers = Array.from(bucket.houseNumbers);
            return {
                name: streetName,
                ranges: houseNumbers.length ? calculateRanges(houseNumbers) : '',
                count: bucket.addressCount,
                point: getStreetRepresentativePoint(bucket.points)
            };
        });

    const streets = orderStreetsNearestNeighbor(streetsUnordered, options.startPoint);
    
    // Get feature name
    const featureName = feature.properties?.naam || 
                       feature.properties?.buurtnaam || 
                       feature.properties?.wijknaam || 
                       'Onbekend gebied';
    
    return {
        featureName,
        streets: streets.map(({ point, ...rest }) => rest),
        totalAddresses: filteredFeatures.length
    };
}

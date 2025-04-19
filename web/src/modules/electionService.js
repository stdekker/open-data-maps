let AVAILABLE_ELECTIONS = [];
let isInitialized = false;
let activeParty = null;

import { showPartyVotes, hidePartyVotes } from './layers/electionsLayer.js';

/**
 * Initializes the election service by fetching available elections and sorting them.
 * Sets the most recent election as default if none is stored.
 * @returns {Promise<Array>} Array of available election IDs
 */
export async function initializeElectionService() {
    try {
        const response = await fetch('api/elections.php');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Sort elections by year (descending) and type
        AVAILABLE_ELECTIONS = data.elections.sort((a, b) => {
            // Extract year and type (e.g., "TK" from "TK2023")
            const [, typeA, yearA] = a.match(/([A-Z]+)(\d{4})/);
            const [, typeB, yearB] = b.match(/([A-Z]+)(\d{4})/);
            
            // Compare years first
            const yearDiff = parseInt(yearB) - parseInt(yearA);
            if (yearDiff !== 0) return yearDiff;
            
            // If years are equal, sort by type
            return typeB.localeCompare(typeA);
        });

        // Set the most recent election as default if none is stored
        if (!localStorage.getItem('lastElection')) {
            localStorage.setItem('lastElection', AVAILABLE_ELECTIONS[0]);
        }

        isInitialized = true;
        return AVAILABLE_ELECTIONS;
    } catch (error) {
        console.error('Failed to initialize election service:', error);
        return [];
    }
}

export function getAvailableElections() {
    return AVAILABLE_ELECTIONS;
}

/**
 * Processes reporting units from election data and creates GeoJSON
 * @param {Object} electionData - The election data 
 * @returns {Object} Object containing geoJsonData and station statistics
 */
function _processReportingUnits(electionData) {
    let geoJsonData = null;
    let totalStations = 0;
    let geolocatedStations = 0;
    
    // Get reporting units if they exist
    const reportingUnits = electionData.Contests?.Contest?.ReportingUnitVotes;
    if (reportingUnits) {
        const unitsArray = Array.isArray(reportingUnits) ? reportingUnits : [reportingUnits];
        totalStations = unitsArray.length;
        geolocatedStations = unitsArray.filter(unit => unit.GeoLocation).length;

        if (electionData['@attributes']?.geocoded) {
            const affiliations = electionData.Contests.Contest.Affiliations.reduce((acc, aff) => {
                acc[aff.Id] = aff.Name;
                return acc;
            }, {});

            const features = unitsArray
                .filter(unit => unit.GeoLocation)
                .map((unit, index) => {
                    const { lon, lat } = unit.GeoLocation;
                    const { ReportingUnitIdentifier: name, Cast, TotalCounted, RejectedVotes, Selection } = unit;

                    const rejectedVotes = RejectedVotes 
                        ? (Array.isArray(RejectedVotes) 
                            ? RejectedVotes.reduce((total, votes) => total + parseInt(votes), 0)
                            : parseInt(RejectedVotes))
                        : 0;

                    const results = Selection.map(selection => ({
                        party: affiliations[selection.AffiliationId],
                        votes: parseInt(selection.ValidVotes)
                    })).sort((a, b) => b.votes - a.votes);

                    return {
                        type: 'Feature',
                        id: index,
                        geometry: {
                            type: 'Point',
                            coordinates: [parseFloat(lon), parseFloat(lat)]
                        },
                        properties: {
                            name,
                            cast: parseInt(Cast) || 0,
                            totalCounted: parseInt(TotalCounted) || 0,
                            rejectedVotes,
                            results: JSON.stringify(results),
                            electionId: electionData.Contests.Contest.ElectionIdentifier
                        }
                    };
                });
            
            geoJsonData = {
                type: 'FeatureCollection',
                features
            };

            // Process the reporting units to add party vote counts to GeoJSON
            geoJsonData.features.forEach(feature => {
                try {
                    const results = JSON.parse(feature.properties.results);
                    if (!Array.isArray(results)) {
                        console.warn('Invalid results format:', results);
                        return;
                    }
                    results.forEach(result => {
                        if (result && result.party && typeof result.party === 'string' && result.votes !== undefined) {
                            const safePropertyName = createSafePropertyName(result.party);
                            feature.properties[safePropertyName] = parseInt(result.votes) || 0;
                        }
                    });
                } catch (error) {
                    console.warn('Error processing results for feature:', error);
                }
            });
        }
    }
    
    return { 
        geoJsonData, 
        totalStations, 
        geolocatedStations 
    };
}

/**
 * Calculates election results from the election data
 * @param {Object} electionData - The election data
 * @returns {Object} Object containing sorted party votes, affiliations, and vote totals
 */
function _calculateElectionResults(electionData) {
    // Get the total votes per party from the data and affiliations lookup
    const totalVotes = electionData.Contests.Contest.TotalVotes.Selection;
    const affiliations = electionData.Contests.Contest.Affiliations.reduce((acc, aff) => {
        acc[aff.Id] = aff.Name;
        return acc;
    }, {});
    
    // Sort parties by number of votes (descending)
    const sortedPartyVotes = [...totalVotes].sort((a, b) => parseInt(b.ValidVotes) - parseInt(a.ValidVotes));
    
    // Calculate total valid votes and total cast votes
    const totalValidVotes = sortedPartyVotes.reduce((sum, party) => sum + parseInt(party.ValidVotes), 0);
    const totalCastVotes = parseInt(electionData.Contests.Contest.TotalVotes.Cast) || 
                         parseInt(electionData.Contests.Contest.TotalVotes.TotalCounted);
    
    return {
        sortedPartyVotes,
        affiliations,
        totalValidVotes,
        totalCastVotes
    };
}

/**
 * Updates the stats view with election results
 * @param {String} electionId - The election ID
 * @param {Object} resultsData - Data containing election results
 * @param {Object} reportingUnitStats - Statistics about reporting units
 * @param {String} municipalityCode - The municipality code
 * @param {Object} geoJsonData - The GeoJSON data for reporting units
 */
function _updateStatsView(electionId, resultsData, reportingUnitStats, municipalityCode, geoJsonData) {
    const { sortedPartyVotes, affiliations, totalValidVotes, totalCastVotes } = resultsData;
    const { totalStations, geolocatedStations } = reportingUnitStats;
    
    // Create HTML for the stats view
    const statsView = document.querySelector('.stats-view');
    
    let html = `
        <div class="election-header">
            <button class="nav-button prev" ${AVAILABLE_ELECTIONS.indexOf(electionId) === AVAILABLE_ELECTIONS.length - 1 ? 'disabled' : ''}>
                &#8249;
            </button>
            <h2>${electionId}</h2>
            <button class="nav-button next" ${AVAILABLE_ELECTIONS.indexOf(electionId) === 0 ? 'disabled' : ''}>
                &#8250;
            </button>
        </div>
        <div class="station-stats">
            Stembureaus: ${geolocatedStations}/${totalStations} gelocaliseerd
        </div>
        <div class="total-votes">
            Opgeroepen: ${totalCastVotes.toLocaleString('nl-NL')}<br>
            Geldig: ${totalValidVotes.toLocaleString('nl-NL')}
        </div>
        <div class="election-results">
    `;
    
    let otherParties = [];
    
    sortedPartyVotes.forEach(party => {
        const votes = parseInt(party.ValidVotes);
        const percentage = ((votes / totalValidVotes) * 100).toFixed(1);
        const partyName = affiliations[party.AffiliationId];
        // Only directly show parties with 1% or more of the votes
        if (percentage >= 1) { 
            html += `
                <div class="party-result" data-party="${partyName}">
                    <span class="party-name">${partyName}</span>
                    <span class="party-votes">${votes.toLocaleString('nl-NL')} (${percentage}%)</span>
                </div>
            `;
        } else {
            otherParties.push(party);
        }
    });

    if (otherParties.length > 0) {
        // Calculate total votes for other parties
        const otherVotes = otherParties.reduce((sum, party) => sum + parseInt(party.ValidVotes), 0);
        const otherPercentage = ((otherVotes / totalValidVotes) * 100).toFixed(1);
        
        html += `
            <div class="party-result others">
                <span class="party-name">${otherParties.length} overigen</span>
                <span class="party-votes">${otherVotes.toLocaleString('nl-NL')} (${otherPercentage}%)</span>
            </div>
            <div class="other-parties" style="display: none;">
        `;
        
        otherParties.forEach(party => {
            const votes = parseInt(party.ValidVotes);
            const percentage = ((votes / totalValidVotes) * 100).toFixed(1);
            html += `
                <div class="party-result" data-party="${affiliations[party.AffiliationId]}">
                    <span class="party-name">${affiliations[party.AffiliationId]}</span>
                    <span class="party-votes">${votes.toLocaleString('nl-NL')} (${percentage}%)</span>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    html += '</div>';
    statsView.innerHTML = html;
    
    // Add event listeners
    _attachStatsViewEventListeners(statsView, electionId, municipalityCode, geoJsonData);
}

/**
 * Attaches event listeners to the stats view elements
 * @param {HTMLElement} statsView - The stats view element
 * @param {String} electionId - The election ID
 * @param {String} municipalityCode - The municipality code
 * @param {Object} geoJsonData - The GeoJSON data for reporting units
 */
function _attachStatsViewEventListeners(statsView, electionId, municipalityCode, geoJsonData) {
    // Add event listener to toggle visibility of other parties
    const othersElement = document.querySelector('.party-result.others');
    const otherPartiesElement = document.querySelector('.other-parties');
    if (othersElement && otherPartiesElement) {
        othersElement.addEventListener('click', () => {
            const isExpanded = otherPartiesElement.style.display !== 'none';
            otherPartiesElement.style.display = isExpanded ? 'none' : 'block';
            othersElement.classList.toggle('expanded', !isExpanded);
        });
    }
    
    // Add event listeners for navigation buttons
    const prevButton = statsView.querySelector('.nav-button.prev');
    const nextButton = statsView.querySelector('.nav-button.next');

    prevButton.addEventListener('click', () => {
        const currentIndex = AVAILABLE_ELECTIONS.indexOf(electionId);
        if (currentIndex < AVAILABLE_ELECTIONS.length - 1) {
            const newElectionId = AVAILABLE_ELECTIONS[currentIndex + 1];
            localStorage.setItem('lastElection', newElectionId);
            loadElectionData(municipalityCode, newElectionId);
        }
    });

    nextButton.addEventListener('click', () => {
        const currentIndex = AVAILABLE_ELECTIONS.indexOf(electionId);
        if (currentIndex > 0) {
            const newElectionId = AVAILABLE_ELECTIONS[currentIndex - 1];
            localStorage.setItem('lastElection', newElectionId);
            loadElectionData(municipalityCode, newElectionId);
        }
    });
    
    // Add click handlers for party results
    const partyElements = statsView.querySelectorAll('.party-result:not(.others)');
    const otherPartyElements = statsView.querySelectorAll('.other-parties .party-result');
    const allPartyElements = [...partyElements, ...otherPartyElements];

    allPartyElements.forEach(element => {
        element.addEventListener('click', () => {
            const partyName = element.dataset.party;
            if (!partyName) return;  // Skip if no party name is set
            
            const safePropertyName = createSafePropertyName(partyName);
            
            // Remove active class from all elements
            allPartyElements.forEach(el => el.classList.remove('active'));
            
            // Only proceed if map exists and is loaded
            if (!window.map || !window.map.loaded()) {
                console.warn('Map not ready');
                return;
            }

            // Check if we have valid GeoJSON data with features
            if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
                console.warn('No polling stations available to visualize');
                return;
            }

            const { minVotes, maxVotes } = calculateMinMaxVotes(geoJsonData.features, safePropertyName);

            if (activeParty === partyName) {
                // If clicking the same party, hide its visualization
                hidePartyVotes(window.map);
                setActiveParty(null);
            } else {
                // Show the new party's visualization
                element.classList.add('active');
                showPartyVotes(window.map, safePropertyName, minVotes, maxVotes);
                setActiveParty(partyName);
            }
        });
    });
}

/**
 * Creates error view content when election data loading fails
 * @param {HTMLElement} statsView - The stats view element
 * @param {String} electionId - The election ID
 */
function _createErrorView(statsView, electionId) {
    statsView.innerHTML = `
        <div class="election-header">
            <button class="nav-button prev" disabled>&#8249;</button>
            <h2>${electionId}</h2>
            <button class="nav-button next" disabled>&#8250;</button>
        </div>
        <div class="station-stats">
            Stembureaus: 0/0 gelocaliseerd
        </div>
        <p class="error-message">Geen verkiezingsdata beschikbaar voor deze gemeente</p>
    `;
    
    // Clean up any existing reporting units since we don't have data
    if (typeof cleanupReportingUnits === 'function') {
        cleanupReportingUnits();
    }
}

/**
 * Loads and displays election data for a specific municipality.
 * Updates the stats view with election results and sets up reporting unit markers if available.
 * @param {String} municipalityCode - The municipality code to load data for
 * @param {String} electionId - The election ID to load (defaults to most recent)
 */
export async function loadElectionData(municipalityCode, electionId = null) {
    try {
        // Wait for initialization if not already done
        if (!isInitialized) {
            await initializeElectionService();
        }

        // If no election ID is provided, use the newest available election
        if (!electionId && AVAILABLE_ELECTIONS.length > 0) {
            electionId = AVAILABLE_ELECTIONS[0];
        } else if (!electionId && AVAILABLE_ELECTIONS.length === 0) {
            throw new Error('No elections available');
        }

        const response = await fetch(`data/elections/${electionId}/${municipalityCode}.json`);
        
        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const electionData = await response.json();
        
        // Process reporting units
        const reportingUnitStats = _processReportingUnits(electionData);
        const { geoJsonData, totalStations, geolocatedStations } = reportingUnitStats;
        
        // Dispatch event with geoJsonData (could be null)
        window.dispatchEvent(new CustomEvent('reportingUnitsLoaded', {
            detail: { geoJsonData, electionId }
        }));
        
        // Calculate election results
        const resultsData = _calculateElectionResults(electionData);
        
        // Update the stats view
        _updateStatsView(electionId, resultsData, reportingUnitStats, municipalityCode, geoJsonData);
        
    } catch (error) {
        console.error('Error loading election data:', error);
        const statsView = document.querySelector('.stats-view');
        _createErrorView(statsView, electionId);
    }
}

export function setActiveParty(partyName) {
    activeParty = partyName;
}

/**
 * Creates HTML content for a popup showing reporting unit election results.
 * @param {Object} feature - The GeoJSON feature containing reporting unit data
 * @returns {String} HTML content for the popup
 */
export function createReportingUnitPopup(feature) {
    const { name, cast, totalCounted, rejectedVotes, results } = feature.properties;

    // Create popup content
    let content = `
        <h3>${name}</h3>
        <div class="popup-content">
            <p><strong>Opgeroepen:</strong> ${cast.toLocaleString('nl-NL')}</p>
            <p><strong>Geteld:</strong> ${totalCounted.toLocaleString('nl-NL')}</p>
            ${rejectedVotes ? `<p><strong>Ongeldig:</strong> ${rejectedVotes.toLocaleString('nl-NL')}</p>` : ''}
    `;

    const allParties = JSON.parse(results);
    
    if (activeParty) {
        // Show only the active party
        const party = allParties.find(p => p.party === activeParty);
        if (party) {
            const percentage = ((party.votes / totalCounted) * 100).toFixed(1);
            content += `
                <p><strong>Partij:</strong></p>
                <div class="popup-results">
                    <div class="popup-party">
                        <span class="popup-party-name">${party.party}</span>
                        <span class="popup-party-votes">${party.votes.toLocaleString('nl-NL')} (${percentage}%)</span>
                    </div>
                </div>
            `;
        }
    } else {
        // Show all parties
        content += `
            <p><strong>Partijen:</strong></p>
            <div class="popup-results">
        `;
        allParties.forEach(party => {
            const percentage = ((party.votes / totalCounted) * 100).toFixed(1);
            content += `
                <div class="popup-party">
                    <span class="popup-party-name">${party.party}</span>
                    <span class="popup-party-votes">${party.votes.toLocaleString('nl-NL')} (${percentage}%)</span>
                </div>
            `;
        });
    }

    content += '</div></div>';
    return content;
}

export function setupReportingUnitPopupHandlers(map) {
    // Add click handler for reporting units
    map.on('click', 'reporting-units', (e) => {
        if (!e.features.length) return;

        const feature = e.features[0];
        const content = createReportingUnitPopup(feature);

        // Remove existing popup if it exists
        if (window.reportingUnitsPopup) {
            window.reportingUnitsPopup.remove();
        }

        // Create new popup
        window.reportingUnitsPopup = new mapboxgl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(content)
            .addTo(map);
    });

    // Change cursor on hover
    map.on('mouseenter', 'reporting-units', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'reporting-units', () => {
        map.getCanvas().style.cursor = '';
    });
}

/**
 * Creates a safe property name from a party name
 * @param {String} partyName - The original party name
 * @returns {String} A safe property name
 */
function createSafePropertyName(partyName) {
    if (!partyName || typeof partyName !== 'string') {
        console.warn('Invalid party name:', partyName);
        return 'party_votes_unknown';
    }
    return `party_votes_${partyName.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Calculates the minimum and maximum votes for a given party across all features
 * @param {Array} features - The GeoJSON features array
 * @param {String} partyName - The name of the party
 * @returns {Object} An object containing min and max votes
 */
function calculateMinMaxVotes(features, partyName) {
    let minVotes = Infinity;
    let maxVotes = -Infinity;

    features.forEach(feature => {
        const votes = feature.properties[partyName];
        if (votes !== undefined) {
            minVotes = Math.min(minVotes, votes);
            maxVotes = Math.max(maxVotes, votes);
        }
    });

    return { minVotes, maxVotes };
}
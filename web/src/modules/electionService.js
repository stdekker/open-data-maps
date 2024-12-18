const AVAILABLE_ELECTIONS = ['TK2021','TK2023']; // From newest to oldest

export async function loadElectionData(municipalityCode, electionId = 'TK2021') {
    try {
        const response = await fetch(`data/elections/${electionId}/${municipalityCode}.json`);
        
        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // If the file is geocoded, dispatch an event with the reporting units
        if (data['@attributes']?.geocoded) {
            console.log('Found geocoded data:', data);
            const reportingUnits = data.Count.Election.Contests.Contest.ReportingUnitVotes;
            const unitsArray = Array.isArray(reportingUnits) ? reportingUnits : [reportingUnits];
            
            console.log('Units array:', unitsArray);

            const features = unitsArray
                .filter(unit => unit.GeoLocation)
                .map((unit, index) => {
                    console.log('Processing unit:', unit);
                    const { lon, lat } = unit.GeoLocation;
                    console.log('Coordinates:', lon, lat);
                    const { ReportingUnitIdentifier: name, Cast, TotalCounted, RejectedVotes, Selection } = unit;

                    const rejectedVotes = RejectedVotes 
                        ? (Array.isArray(RejectedVotes) 
                            ? RejectedVotes.reduce((total, votes) => total + parseInt(votes), 0)
                            : parseInt(RejectedVotes))
                        : 0;

                    const results = Selection.map(selection => ({
                        party: selection.AffiliationIdentifier.RegisteredName || selection.AffiliationIdentifier.Name,
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
                            results: JSON.stringify(results), // Stringify for GeoJSON compatibility
                            electionId // Add election ID to properties
                        }
                    };
                });

            console.log('Generated features:', features);
            
            const geoJsonData = {
                type: 'FeatureCollection',
                features
            };

            console.log('Dispatching event with data:', geoJsonData);
            window.dispatchEvent(new CustomEvent('reportingUnitsLoaded', {
                detail: { geoJsonData, electionId }
            }));
        }
        
        // Get the total votes per party from the data
        const totalVotes = data.Count.Election.Contests.Contest.TotalVotes.Selection;
        
        // Sort parties by number of votes (descending)
        totalVotes.sort((a, b) => parseInt(b.ValidVotes) - parseInt(a.ValidVotes));
        
        // Calculate total valid votes and total cast votes
        const totalValidVotes = totalVotes.reduce((sum, party) => sum + parseInt(party.ValidVotes), 0);
        const totalCastVotes = parseInt(data.Count.Election.Contests.Contest.TotalVotes.Cast) || 
                             parseInt(data.Count.Election.Contests.Contest.TotalVotes.TotalCounted);
        
        // Create HTML for the stats view
        const statsView = document.querySelector('.stats-view');
        
        let html = `
            <div class="election-header">
                <button class="nav-button prev" ${AVAILABLE_ELECTIONS.indexOf(electionId) === 0 ? 'disabled' : ''}>
                    &#8249;
                </button>
                <h2>${electionId}</h2>
                <button class="nav-button next" ${AVAILABLE_ELECTIONS.indexOf(electionId) === AVAILABLE_ELECTIONS.length - 1 ? 'disabled' : ''}>
                    &#8250;
                </button>
            </div>
            <div class="total-votes">
                Uitgebracht: ${totalCastVotes.toLocaleString('nl-NL')}<br>
                Geldig: ${totalValidVotes.toLocaleString('nl-NL')}
            </div>
            <div class="election-results">
        `;
        
        let otherParties = [];
        
        totalVotes.forEach(party => {
            const votes = parseInt(party.ValidVotes);
            const percentage = ((votes / totalValidVotes) * 100).toFixed(1);
            if (percentage >= 1) { // Only show parties with 1% or more of the votes
                html += `
                    <div class="party-result">
                        <span class="party-name">${party.AffiliationIdentifier.Name}</span>
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
                    <div class="party-result">
                        <span class="party-name">${party.AffiliationIdentifier.Name}</span>
                        <span class="party-votes">${votes.toLocaleString('nl-NL')} (${percentage}%)</span>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        html += '</div>';
        statsView.innerHTML = html;
        
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
            if (currentIndex > 0) {
                const newElectionId = AVAILABLE_ELECTIONS[currentIndex - 1];
                localStorage.setItem('lastElection', newElectionId);
                loadElectionData(municipalityCode, newElectionId);
            }
        });

        nextButton.addEventListener('click', () => {
            const currentIndex = AVAILABLE_ELECTIONS.indexOf(electionId);
            if (currentIndex < AVAILABLE_ELECTIONS.length - 1) {
                const newElectionId = AVAILABLE_ELECTIONS[currentIndex + 1];
                localStorage.setItem('lastElection', newElectionId);
                loadElectionData(municipalityCode, newElectionId);
            }
        });
        
    } catch (error) {
        console.error('Error loading election data:', error);
        const statsView = document.querySelector('.stats-view');
        statsView.innerHTML = `
            <div class="election-header">
                <button class="nav-button prev" disabled>&#8249;</button>
                <h2>${electionId}</h2>
                <button class="nav-button next" disabled>&#8250;</button>
            </div>
            <p class="error-message">Geen verkiezingsdata beschikbaar voor deze gemeente</p>
        `;
        
        // Clean up any existing reporting units since we don't have data
        if (typeof cleanupReportingUnits === 'function') {
            cleanupReportingUnits();
        }
    }
}
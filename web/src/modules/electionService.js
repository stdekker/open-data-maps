export async function loadElectionData(municipalityCode) {
    try {
        const response = await fetch(`data/elections/TK2021/${municipalityCode}.json`);
        const data = await response.json();
        
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
            <h2>TK2021</h2>
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
        
    } catch (error) {
        console.error('Error loading election data:', error);
        document.querySelector('.stats-view').innerHTML = `<p>Geen verkiezingsdata beschikbaar voor ${municipalityCode}</p>`;
    }
} 
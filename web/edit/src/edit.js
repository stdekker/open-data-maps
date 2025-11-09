/**
 * Stembureau Location Editor
 * Main JavaScript Application
 */

// Global state
const state = {
    elections: [],
    municipalities: [],
    currentElection: null,
    currentMunicipality: null,
    stembureaus: [],
    originalStembureaus: [],
    map: null,
    markers: {},
    selectedIndex: null,
    municipalityBoundary: null,
    modifications: new Set()
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    initializeMap();
    await loadElections();
    await loadMunicipalities();
    setupEventListeners();
    restoreLastSession();
});

// Initialize Mapbox map
function initializeMap() {
    mapboxgl.accessToken = window.EDIT_CONFIG.mapboxToken;
    
    state.map = new mapboxgl.Map({
        container: 'map',
        style: window.EDIT_CONFIG.mapStyle,
        center: [5.387, 52.156],
        zoom: 7
    });
    
    state.map.addControl(new mapboxgl.NavigationControl());
}

// Load available elections
async function loadElections() {
    try {
        const response = await fetch('../api/elections.php');
        const data = await response.json();
        
        if (data.elections) {
            state.elections = data.elections;
            populateElectionSelect();
        }
    } catch (error) {
        showToast('Failed to load elections', 'error');
        console.error(error);
    }
}

// Load municipalities
async function loadMunicipalities() {
    try {
        const response = await fetch('../data/gemeenten.json');
        const data = await response.json();
        
        if (data.features) {
            state.municipalities = data.features
                .map(f => ({
                    code: f.properties.gemeentecode,
                    name: f.properties.gemeentenaam,
                    geometry: f.geometry
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
            
            populateMunicipalitySelect();
        }
    } catch (error) {
        showToast('Failed to load municipalities', 'error');
        console.error(error);
    }
}

// Populate election dropdown
function populateElectionSelect() {
    const select = document.getElementById('electionSelect');
    select.innerHTML = '<option value="">Select election...</option>';
    
    state.elections.forEach(election => {
        const option = document.createElement('option');
        option.value = election;
        option.textContent = election;
        select.appendChild(option);
    });
}

// Populate municipality dropdown
function populateMunicipalitySelect() {
    const select = document.getElementById('municipalitySelect');
    select.innerHTML = '<option value="">Select municipality...</option>';
    
    state.municipalities.forEach(muni => {
        const option = document.createElement('option');
        option.value = muni.code;
        option.textContent = muni.name;
        select.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Election selection
    document.getElementById('electionSelect').addEventListener('change', (e) => {
        state.currentElection = e.target.value;
        document.getElementById('municipalitySelect').disabled = !state.currentElection;
        updateLoadButton();
        saveLastSession();
    });
    
    // Municipality selection
    document.getElementById('municipalitySelect').addEventListener('change', (e) => {
        state.currentMunicipality = e.target.value;
        updateLoadButton();
        saveLastSession();
    });
    
    // Load button
    document.getElementById('loadBtn').addEventListener('click', loadStembureaus);
    
    // Save all button
    document.getElementById('saveAllBtn').addEventListener('click', saveAllModifications);
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', filterStembureaus);
    
    // Show boundary checkbox
    document.getElementById('showMunicipalityBoundary').addEventListener('change', toggleMunicipalityBoundary);
    
    // Modal controls
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalSaveBtn').addEventListener('click', saveModalEdit);
    document.getElementById('modalRemoveBtn').addEventListener('click', removeLocation);
    
    // Close modal on outside click
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeModal();
        }
    });
    
    // Match locations button
    document.getElementById('matchLocationsBtn').addEventListener('click', openMatchModal);
    
    // Match modal controls
    document.querySelectorAll('#matchModal .close-modal')[0].addEventListener('click', closeMatchModal);
    document.getElementById('matchCancelBtn').addEventListener('click', closeMatchModal);
    document.getElementById('matchFindBtn').addEventListener('click', findMatches);
    document.getElementById('matchApplyBtn').addEventListener('click', applyMatches);
    document.getElementById('matchSelectAllBtn').addEventListener('click', selectAllMatches);
    document.getElementById('matchDeselectAllBtn').addEventListener('click', deselectAllMatches);
    
    // Close match modal on outside click
    document.getElementById('matchModal').addEventListener('click', (e) => {
        if (e.target.id === 'matchModal') {
            closeMatchModal();
        }
    });
}

// Update load button state
function updateLoadButton() {
    const loadBtn = document.getElementById('loadBtn');
    loadBtn.disabled = !state.currentElection || !state.currentMunicipality;
}

// Load stembureaus data
async function loadStembureaus() {
    if (!state.currentElection || !state.currentMunicipality) return;
    
    try {
        showToast('Loading data...', 'info');
        
        const response = await fetch(
            `api/list-stembureaus.php?election=${state.currentElection}&municipality=${state.currentMunicipality}`
        );
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load data');
        }
        
        state.stembureaus = data.stembureaus;
        state.originalStembureaus = JSON.parse(JSON.stringify(data.stembureaus));
        state.modifications.clear();
        
        renderStembureauList();
        renderMapMarkers();
        showMunicipalityBoundary();
        updateStats();
        
        document.getElementById('saveAllBtn').disabled = true;
        document.getElementById('matchLocationsBtn').disabled = false;
        
        showToast(`Loaded ${data.total} stembureaus`, 'success');
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error(error);
    }
}

// Render stembureau list
function renderStembureauList() {
    const listContent = document.getElementById('listContent');
    
    if (state.stembureaus.length === 0) {
        listContent.innerHTML = '<div class="empty-state"><p>No stembureaus found</p></div>';
        return;
    }
    
    listContent.innerHTML = '';
    
    state.stembureaus.forEach((stembureau, index) => {
        const item = createStembureauItem(stembureau, index);
        listContent.appendChild(item);
    });
}

// Create stembureau list item
function createStembureauItem(stembureau, index) {
    const div = document.createElement('div');
    div.className = 'stembureau-item';
    div.dataset.index = index;
    
    if (state.modifications.has(index)) {
        div.classList.add('modified');
    }
    
    const hasLocation = stembureau.lat !== null && stembureau.lon !== null;
    
    div.innerHTML = `
        <div class="stembureau-header">
            <div class="stembureau-name">${escapeHtml(stembureau.identifier)}</div>
            <span class="status-badge ${hasLocation ? 'has-location' : 'no-location'}">
                ${hasLocation ? '✓ Located' : '✗ No location'}
            </span>
        </div>
        <div class="stembureau-coords ${hasLocation ? '' : 'empty'}">
            ${hasLocation ? `📍 ${stembureau.lat.toFixed(6)}, ${stembureau.lon.toFixed(6)}` : '📍 No coordinates set'}
        </div>
        <div class="stembureau-actions">
            <button class="edit-btn" onclick="editStembureau(${index})">Edit</button>
            <button class="locate-btn" onclick="locateStembureau(${index})">Locate on Map</button>
        </div>
    `;
    
    return div;
}

// Edit stembureau
window.editStembureau = function(index) {
    const stembureau = state.stembureaus[index];
    state.selectedIndex = index;
    
    document.getElementById('modalStembureaName').textContent = stembureau.identifier;
    document.getElementById('modalLat').value = stembureau.lat || '';
    document.getElementById('modalLon').value = stembureau.lon || '';
    
    document.getElementById('editModal').classList.add('active');
};

// Locate stembureau on map
window.locateStembureau = function(index) {
    const stembureau = state.stembureaus[index];
    
    if (stembureau.lat && stembureau.lon) {
        state.map.flyTo({
            center: [stembureau.lon, stembureau.lat],
            zoom: 16
        });
        
        // Highlight the marker
        const marker = state.markers[index];
        if (marker) {
            marker.getElement().style.transform += ' scale(1.2)';
            setTimeout(() => {
                marker.getElement().style.transform = marker.getElement().style.transform.replace(' scale(1.2)', '');
            }, 1000);
        }
        
        // Highlight the list item
        document.querySelectorAll('.stembureau-item').forEach(item => {
            item.classList.remove('selected');
        });
        const item = document.querySelector(`.stembureau-item[data-index="${index}"]`);
        if (item) {
            item.classList.add('selected');
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        showToast('This stembureau has no location set', 'error');
    }
};

// Save modal edit
function saveModalEdit() {
    const lat = parseFloat(document.getElementById('modalLat').value);
    const lon = parseFloat(document.getElementById('modalLon').value);
    
    if (isNaN(lat) || isNaN(lon)) {
        showToast('Please enter valid coordinates', 'error');
        return;
    }
    
    if (lat < 50 || lat > 54 || lon < 3 || lon > 8) {
        showToast('Coordinates out of range for Netherlands', 'error');
        return;
    }
    
    updateStembureauLocation(state.selectedIndex, lat, lon);
    closeModal();
}

// Remove location
function removeLocation() {
    if (state.selectedIndex === null) return;
    
    if (confirm('Are you sure you want to remove this location?')) {
        updateStembureauLocation(state.selectedIndex, null, null);
        closeModal();
    }
}

// Update stembureau location
function updateStembureauLocation(index, lat, lon) {
    const stembureau = state.stembureaus[index];
    stembureau.lat = lat;
    stembureau.lon = lon;
    
    // Track modification
    state.modifications.add(index);
    
    // Update UI
    renderStembureauList();
    updateMarker(index);
    updateStats();
    
    document.getElementById('saveAllBtn').disabled = state.modifications.size === 0;
    
    showToast('Location updated (not saved yet)', 'info');
}

// Close modal
function closeModal() {
    document.getElementById('editModal').classList.remove('active');
    state.selectedIndex = null;
}

// Render map markers
function renderMapMarkers() {
    // Clear existing markers
    Object.values(state.markers).forEach(marker => marker.remove());
    state.markers = {};
    
    if (state.stembureaus.length === 0) return;
    
    // Get municipality center for default position
    const municipalityCenter = getMunicipalityCenter();
    
    state.stembureaus.forEach((stembureau, index) => {
        const hasLocation = stembureau.lat !== null && stembureau.lon !== null;
        const position = hasLocation 
            ? [stembureau.lon, stembureau.lat]
            : municipalityCenter;
        
        // Create marker element
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.backgroundColor = hasLocation ? '#667eea' : '#dc3545';
        el.style.cursor = 'grab';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        
        // Create marker
        const marker = new mapboxgl.Marker({
            element: el,
            draggable: true
        })
            .setLngLat(position)
            .setPopup(new mapboxgl.Popup().setHTML(`
                <div class="popup-content">
                    <h3>${escapeHtml(stembureau.identifier)}</h3>
                    <p><strong>Status:</strong> ${hasLocation ? 'Located' : 'Not located'}</p>
                    ${hasLocation ? `<p><strong>Coords:</strong> ${stembureau.lat.toFixed(6)}, ${stembureau.lon.toFixed(6)}</p>` : ''}
                    <p><strong>Cast:</strong> ${stembureau.cast}</p>
                </div>
            `))
            .addTo(state.map);
        
        // Handle drag end
        marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            updateStembureauLocation(index, lngLat.lat, lngLat.lng);
        });
        
        // Handle click
        el.addEventListener('click', () => {
            editStembureau(index);
        });
        
        state.markers[index] = marker;
    });
    
    // Fit map to markers
    if (state.stembureaus.some(s => s.lat && s.lon)) {
        const bounds = new mapboxgl.LngLatBounds();
        state.stembureaus.forEach(s => {
            if (s.lat && s.lon) {
                bounds.extend([s.lon, s.lat]);
            }
        });
        state.map.fitBounds(bounds, { padding: 50 });
    }
}

// Update single marker
function updateMarker(index) {
    const marker = state.markers[index];
    if (!marker) return;
    
    const stembureau = state.stembureaus[index];
    const hasLocation = stembureau.lat !== null && stembureau.lon !== null;
    
    if (hasLocation) {
        marker.setLngLat([stembureau.lon, stembureau.lat]);
        marker.getElement().style.backgroundColor = '#667eea';
    } else {
        const center = getMunicipalityCenter();
        marker.setLngLat(center);
        marker.getElement().style.backgroundColor = '#dc3545';
    }
    
    // Update popup
    marker.setPopup(new mapboxgl.Popup().setHTML(`
        <div class="popup-content">
            <h3>${escapeHtml(stembureau.identifier)}</h3>
            <p><strong>Status:</strong> ${hasLocation ? 'Located' : 'Not located'}</p>
            ${hasLocation ? `<p><strong>Coords:</strong> ${stembureau.lat.toFixed(6)}, ${stembureau.lon.toFixed(6)}</p>` : ''}
            <p><strong>Cast:</strong> ${stembureau.cast}</p>
        </div>
    `));
}

// Get municipality center
function getMunicipalityCenter() {
    const municipality = state.municipalities.find(m => m.code === state.currentMunicipality);
    if (municipality && municipality.geometry) {
        // Calculate centroid of first polygon
        const coords = municipality.geometry.type === 'Polygon' 
            ? municipality.geometry.coordinates[0]
            : municipality.geometry.coordinates[0][0];
        
        let sumX = 0, sumY = 0;
        coords.forEach(([x, y]) => {
            sumX += x;
            sumY += y;
        });
        
        return [sumX / coords.length, sumY / coords.length];
    }
    
    return [5.387, 52.156]; // Default center of Netherlands
}

// Show municipality boundary
function showMunicipalityBoundary() {
    // Remove existing boundary
    if (state.map.getLayer('municipality-boundary')) {
        state.map.removeLayer('municipality-boundary');
    }
    if (state.map.getSource('municipality-boundary')) {
        state.map.removeSource('municipality-boundary');
    }
    
    const checkbox = document.getElementById('showMunicipalityBoundary');
    if (!checkbox.checked) return;
    
    const municipality = state.municipalities.find(m => m.code === state.currentMunicipality);
    if (!municipality || !municipality.geometry) return;
    
    state.map.addSource('municipality-boundary', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: municipality.geometry
        }
    });
    
    state.map.addLayer({
        id: 'municipality-boundary',
        type: 'line',
        source: 'municipality-boundary',
        paint: {
            'line-color': '#667eea',
            'line-width': 2,
            'line-opacity': 0.8
        }
    });
}

// Toggle municipality boundary
function toggleMunicipalityBoundary() {
    showMunicipalityBoundary();
}

// Filter stembureaus
function filterStembureaus() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const items = document.querySelectorAll('.stembureau-item');
    
    items.forEach(item => {
        const name = item.querySelector('.stembureau-name').textContent.toLowerCase();
        const match = name.includes(searchTerm);
        item.style.display = match ? 'block' : 'none';
    });
}

// Save all modifications
async function saveAllModifications() {
    if (state.modifications.size === 0) {
        showToast('No changes to save', 'info');
        return;
    }
    
    const modificationsArray = Array.from(state.modifications);
    let saved = 0;
    let failed = 0;
    
    showToast(`Saving ${modificationsArray.length} changes...`, 'info');
    document.getElementById('saveAllBtn').disabled = true;
    
    for (const index of modificationsArray) {
        const stembureau = state.stembureaus[index];
        
        try {
            const response = await fetch('api/save-location.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    csrf_token: window.EDIT_CONFIG.csrfToken,
                    election: state.currentElection,
                    municipality: state.currentMunicipality,
                    index: index,
                    lat: stembureau.lat,
                    lon: stembureau.lon
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                saved++;
                state.modifications.delete(index);
            } else {
                failed++;
                console.error(`Failed to save ${stembureau.identifier}:`, data.error);
            }
        } catch (error) {
            failed++;
            console.error(`Error saving ${stembureau.identifier}:`, error);
        }
    }
    
    // Update UI
    renderStembureauList();
    updateStats();
    
    if (failed === 0) {
        showToast(`✓ Successfully saved ${saved} changes`, 'success');
        // Update original data
        state.originalStembureaus = JSON.parse(JSON.stringify(state.stembureaus));
    } else {
        showToast(`Saved ${saved}, failed ${failed}`, 'error');
        document.getElementById('saveAllBtn').disabled = state.modifications.size === 0;
    }
}

// Update statistics
function updateStats() {
    const total = state.stembureaus.length;
    const located = state.stembureaus.filter(s => s.lat !== null && s.lon !== null).length;
    const modified = state.modifications.size;
    
    const statsText = document.getElementById('statsText');
    statsText.textContent = `${total} stembureaus | ${located} located | ${modified} unsaved changes`;
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Match locations functions
function openMatchModal() {
    // Populate source election dropdown (exclude current election)
    const select = document.getElementById('matchSourceElection');
    select.innerHTML = '<option value="">Select election...</option>';
    
    state.elections.forEach(election => {
        if (election !== state.currentElection) {
            const option = document.createElement('option');
            option.value = election;
            option.textContent = election;
            select.appendChild(option);
        }
    });
    
    // Reset results
    document.getElementById('matchResults').style.display = 'none';
    document.getElementById('matchResultsContent').innerHTML = '';
    
    // Show modal
    document.getElementById('matchModal').classList.add('active');
}

function closeMatchModal() {
    document.getElementById('matchModal').classList.remove('active');
}

async function findMatches() {
    const sourceElection = document.getElementById('matchSourceElection').value;
    const threshold = parseInt(document.getElementById('matchThreshold').value);
    
    if (!sourceElection) {
        showToast('Please select a source election', 'error');
        return;
    }
    
    try {
        showToast('Finding matches...', 'info');
        document.getElementById('matchFindBtn').disabled = true;
        
        const response = await fetch('api/match-locations.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                csrf_token: window.EDIT_CONFIG.csrfToken,
                currentElection: state.currentElection,
                currentMunicipality: state.currentMunicipality,
                sourceElection: sourceElection,
                threshold: threshold,
                stembureaus: state.stembureaus
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to find matches');
        }
        
        displayMatchResults(data.matches, sourceElection);
        showToast(`Found ${data.total} matches`, 'success');
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error(error);
    } finally {
        document.getElementById('matchFindBtn').disabled = false;
    }
}

function displayMatchResults(matches, sourceElection) {
    const container = document.getElementById('matchResultsContent');
    
    if (matches.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No matches found. Try lowering the match quality threshold.</p>';
        document.getElementById('matchResults').style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    
    matches.forEach((match, i) => {
        const qualityClass = match.similarity >= 90 ? 'high' : match.similarity >= 80 ? 'medium' : 'low';
        
        const div = document.createElement('div');
        div.className = 'match-result-item';
        div.innerHTML = `
            <input type="checkbox" id="match-${i}" data-index="${match.index}" data-lat="${match.lat}" data-lon="${match.lon}" checked>
            <div class="match-result-details">
                <label for="match-${i}" style="cursor: pointer;">
                    <strong>${escapeHtml(match.currentName)}</strong>
                    <span class="match-quality ${qualityClass}">${match.similarity}% match</span>
                </label>
                <div class="source-name">
                    📍 From ${sourceElection}: ${escapeHtml(match.sourceName)}
                </div>
                <div class="coords">
                    Coordinates: ${match.lat.toFixed(6)}, ${match.lon.toFixed(6)}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('matchResults').style.display = 'block';
}

function selectAllMatches() {
    document.querySelectorAll('#matchResultsContent input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
}

function deselectAllMatches() {
    document.querySelectorAll('#matchResultsContent input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
}

async function applyMatches() {
    const checkboxes = document.querySelectorAll('#matchResultsContent input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        showToast('No matches selected', 'error');
        return;
    }
    
    let applied = 0;
    
    checkboxes.forEach(cb => {
        const index = parseInt(cb.dataset.index);
        const lat = parseFloat(cb.dataset.lat);
        const lon = parseFloat(cb.dataset.lon);
        
        updateStembureauLocation(index, lat, lon);
        applied++;
    });
    
    closeMatchModal();
    showToast(`Applied ${applied} matched locations`, 'success');
}

// Save last session to localStorage
function saveLastSession() {
    try {
        const sessionData = {
            election: state.currentElection || '',
            municipality: state.currentMunicipality || '',
            timestamp: Date.now()
        };
        localStorage.setItem('stembureau_editor_session', JSON.stringify(sessionData));
    } catch (error) {
        console.error('Failed to save session:', error);
    }
}

// Restore last session from localStorage
function restoreLastSession() {
    try {
        const sessionDataStr = localStorage.getItem('stembureau_editor_session');
        if (!sessionDataStr) return;
        
        const sessionData = JSON.parse(sessionDataStr);
        
        // Check if session is not too old (e.g., 7 days)
        const daysSinceLastSession = (Date.now() - sessionData.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSession > 7) {
            // Clear old session data
            localStorage.removeItem('stembureau_editor_session');
            return;
        }
        
        // Restore election selection
        if (sessionData.election && state.elections.includes(sessionData.election)) {
            document.getElementById('electionSelect').value = sessionData.election;
            state.currentElection = sessionData.election;
            document.getElementById('municipalitySelect').disabled = false;
        }
        
        // Restore municipality selection
        if (sessionData.municipality && state.municipalities.find(m => m.code === sessionData.municipality)) {
            document.getElementById('municipalitySelect').value = sessionData.municipality;
            state.currentMunicipality = sessionData.municipality;
        }
        
        // Update UI
        updateLoadButton();
        
        // If both election and municipality are restored, automatically load data
        if (state.currentElection && state.currentMunicipality) {
            const municipality = state.municipalities.find(m => m.code === state.currentMunicipality);
            showToast(`Restoring session: ${state.currentElection} - ${municipality?.name || state.currentMunicipality}`, 'info');
            
            // Automatically load the data
            setTimeout(() => {
                loadStembureaus();
            }, 500);
        }
        
    } catch (error) {
        console.error('Failed to restore session:', error);
        // Clear corrupted data
        localStorage.removeItem('stembureau_editor_session');
    }
}


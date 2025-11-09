/**
 * UI Rendering and Interactions Module
 * Handles all DOM manipulation and user interface updates
 */

import { state } from './state.js';

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info') {
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

/**
 * Populate election dropdown
 */
export function populateElectionSelect(elections) {
    const select = document.getElementById('electionSelect');
    select.innerHTML = '<option value="">Select election...</option>';
    
    elections.forEach(election => {
        const option = document.createElement('option');
        option.value = election;
        option.textContent = election;
        select.appendChild(option);
    });
}

/**
 * Populate municipality dropdown
 */
export function populateMunicipalitySelect(municipalities) {
    const select = document.getElementById('municipalitySelect');
    select.innerHTML = '<option value="">Select municipality...</option>';
    
    municipalities.forEach(muni => {
        const option = document.createElement('option');
        option.value = muni.code;
        option.textContent = muni.name;
        select.appendChild(option);
    });
}

/**
 * Render the stembureau list
 */
export function renderStembureauList(stembureaus, modifications) {
    const listContent = document.getElementById('listContent');
    
    if (stembureaus.length === 0) {
        listContent.innerHTML = '<div class="empty-state"><p>No stembureaus found</p></div>';
        return;
    }
    
    listContent.innerHTML = '';
    
    stembureaus.forEach((stembureau, index) => {
        const item = createStembureauItem(stembureau, index, modifications.has(index));
        listContent.appendChild(item);
    });
}

/**
 * Create a single stembureau list item
 */
export function createStembureauItem(stembureau, index, isModified) {
    const div = document.createElement('div');
    div.className = 'stembureau-item';
    div.dataset.index = index;
    
    if (isModified) {
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
            <button class="edit-btn" data-action="edit" data-index="${index}">Edit</button>
            <button class="locate-btn" data-action="locate" data-index="${index}">Locate on Map</button>
        </div>
    `;
    
    return div;
}

/**
 * Update statistics display
 */
export function updateStats(stembureaus, modifications) {
    const total = stembureaus.length;
    const located = stembureaus.filter(s => s.lat !== null && s.lon !== null).length;
    const modified = modifications.size;
    
    const statsText = document.getElementById('statsText');
    statsText.textContent = `${total} stembureaus | ${located} located | ${modified} unsaved changes`;
}

/**
 * Filter stembureaus based on search term
 */
export function filterStembureaus(searchTerm) {
    const items = document.querySelectorAll('.stembureau-item');
    
    items.forEach(item => {
        const name = item.querySelector('.stembureau-name').textContent.toLowerCase();
        const match = name.includes(searchTerm.toLowerCase());
        item.style.display = match ? 'block' : 'none';
    });
}

/**
 * Highlight a list item
 */
export function highlightListItem(index) {
    document.querySelectorAll('.stembureau-item').forEach(item => {
        item.classList.remove('selected');
    });
    const item = document.querySelector(`.stembureau-item[data-index="${index}"]`);
    if (item) {
        item.classList.add('selected');
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Open the edit modal
 */
export function openEditModal(stembureau) {
    document.getElementById('modalStembureaName').textContent = stembureau.identifier;
    document.getElementById('modalLat').value = stembureau.lat || '';
    document.getElementById('modalLon').value = stembureau.lon || '';
    
    document.getElementById('editModal').classList.add('active');
}

/**
 * Close the edit modal
 */
export function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

/**
 * Get coordinates from the edit modal
 */
export function getModalCoordinates() {
    const lat = parseFloat(document.getElementById('modalLat').value);
    const lon = parseFloat(document.getElementById('modalLon').value);
    
    return { lat, lon };
}

/**
 * Open the match locations modal
 */
export function openMatchModal(elections, currentElection) {
    // Populate source election dropdown (exclude current election)
    const select = document.getElementById('matchSourceElection');
    select.innerHTML = '<option value="">Select election...</option>';
    
    elections.forEach(election => {
        if (election !== currentElection) {
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

/**
 * Close the match locations modal
 */
export function closeMatchModal() {
    document.getElementById('matchModal').classList.remove('active');
}

/**
 * Get match modal parameters
 */
export function getMatchParameters() {
    const sourceElection = document.getElementById('matchSourceElection').value;
    const threshold = parseInt(document.getElementById('matchThreshold').value);
    
    return { sourceElection, threshold };
}

/**
 * Display match results in the modal
 */
export function displayMatchResults(matches, sourceElection) {
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

/**
 * Select all matches in the modal
 */
export function selectAllMatches() {
    document.querySelectorAll('#matchResultsContent input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
}

/**
 * Deselect all matches in the modal
 */
export function deselectAllMatches() {
    document.querySelectorAll('#matchResultsContent input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
}

/**
 * Get selected matches from the modal
 */
export function getSelectedMatches() {
    const checkboxes = document.querySelectorAll('#matchResultsContent input[type="checkbox"]:checked');
    const matches = [];
    
    checkboxes.forEach(cb => {
        matches.push({
            index: parseInt(cb.dataset.index),
            lat: parseFloat(cb.dataset.lat),
            lon: parseFloat(cb.dataset.lon)
        });
    });
    
    return matches;
}

/**
 * Update the load button state
 */
export function updateLoadButton(enabled) {
    const loadBtn = document.getElementById('loadBtn');
    loadBtn.disabled = !enabled;
}

/**
 * Update the save all button state
 */
export function updateSaveAllButton(enabled) {
    const saveAllBtn = document.getElementById('saveAllBtn');
    saveAllBtn.disabled = !enabled;
}

/**
 * Update the match locations button state
 */
export function updateMatchButton(enabled) {
    const matchBtn = document.getElementById('matchLocationsBtn');
    matchBtn.disabled = !enabled;
}

/**
 * Update the find matches button state
 */
export function updateFindMatchesButton(enabled) {
    const matchFindBtn = document.getElementById('matchFindBtn');
    matchFindBtn.disabled = !enabled;
}

/**
 * Display address search results in the modal
 */
export function displayAddressSearchResults(results) {
    const container = document.getElementById('modalSearchResultsList');
    const resultsDiv = document.getElementById('modalSearchResults');
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p style="color: #999; padding: 10px;">No results found. Try a different search term.</p>';
        resultsDiv.style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    
    results.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'address-search-result';
        div.style.cssText = 'padding: 10px; margin: 5px 0; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;';
        
        div.innerHTML = `
            <div style="font-weight: 500;">${escapeHtml(result.displayName)}</div>
            <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
                <span style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">${escapeHtml(result.type)}</span>
                <span style="margin-left: 8px;">${result.lat.toFixed(6)}, ${result.lon.toFixed(6)}</span>
            </div>
        `;
        
        // Hover effect
        div.addEventListener('mouseenter', () => {
            div.style.backgroundColor = '#f5f5f5';
        });
        div.addEventListener('mouseleave', () => {
            div.style.backgroundColor = '';
        });
        
        // Store coordinates in data attributes
        div.dataset.lat = result.lat;
        div.dataset.lon = result.lon;
        div.dataset.index = index;
        
        container.appendChild(div);
    });
    
    resultsDiv.style.display = 'block';
}

/**
 * Hide address search results
 */
export function hideAddressSearchResults() {
    document.getElementById('modalSearchResults').style.display = 'none';
}

/**
 * Clear address search input and results
 */
export function clearAddressSearch() {
    document.getElementById('modalAddressSearch').value = '';
    hideAddressSearchResults();
}

/**
 * Update search button state
 */
export function updateSearchButton(enabled) {
    document.getElementById('modalSearchBtn').disabled = !enabled;
}


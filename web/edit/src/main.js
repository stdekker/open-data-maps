/**
 * Main Application Entry Point
 * Coordinates all modules and handles event listeners
 */

import { state } from './state.js';
import * as api from './api.js';
import * as mapModule from './map.js';
import * as ui from './ui.js';
import * as session from './session.js';

/**
 * Initialize the application
 */
async function init() {
    mapModule.initializeMap();
    await api.loadElections();
    await api.loadMunicipalities();
    ui.populateElectionSelect(state.elections);
    ui.populateMunicipalitySelect(state.municipalities);
    setupEventListeners();
    restoreSession();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Election selection
    document.getElementById('electionSelect').addEventListener('change', handleElectionChange);
    
    // Municipality selection
    document.getElementById('municipalitySelect').addEventListener('change', handleMunicipalityChange);
    
    // Load button
    document.getElementById('loadBtn').addEventListener('click', handleLoadData);
    
    // Save all button
    document.getElementById('saveAllBtn').addEventListener('click', handleSaveAll);
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Show boundary checkbox
    document.getElementById('showMunicipalityBoundary').addEventListener('change', handleBoundaryToggle);
    
    // Edit modal controls
    document.querySelector('.close-modal').addEventListener('click', () => {
        ui.closeEditModal();
        ui.clearAddressSearch();
        state.selectedIndex = null;
    });
    document.getElementById('modalCancelBtn').addEventListener('click', () => {
        ui.closeEditModal();
        ui.clearAddressSearch();
        state.selectedIndex = null;
    });
    document.getElementById('modalSaveBtn').addEventListener('click', handleModalSave);
    document.getElementById('modalRemoveBtn').addEventListener('click', handleRemoveLocation);
    document.getElementById('modalSearchBtn').addEventListener('click', handleAddressSearch);
    
    // Address search - handle Enter key
    document.getElementById('modalAddressSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAddressSearch();
        }
    });
    
    // Address search results - handle clicks
    document.getElementById('modalSearchResultsList').addEventListener('click', handleAddressResultClick);
    
    // Close modal on outside click
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            ui.closeEditModal();
            ui.clearAddressSearch();
            state.selectedIndex = null;
        }
    });
    
    // Match locations button
    document.getElementById('matchLocationsBtn').addEventListener('click', handleOpenMatchModal);
    
    // Match modal controls
    document.querySelectorAll('#matchModal .close-modal')[0].addEventListener('click', ui.closeMatchModal);
    document.getElementById('matchCancelBtn').addEventListener('click', ui.closeMatchModal);
    document.getElementById('matchFindBtn').addEventListener('click', handleFindMatches);
    document.getElementById('matchApplyBtn').addEventListener('click', handleApplyMatches);
    document.getElementById('matchSelectAllBtn').addEventListener('click', ui.selectAllMatches);
    document.getElementById('matchDeselectAllBtn').addEventListener('click', ui.deselectAllMatches);
    
    // Close match modal on outside click
    document.getElementById('matchModal').addEventListener('click', (e) => {
        if (e.target.id === 'matchModal') {
            ui.closeMatchModal();
        }
    });
    
    // Delegate list item events
    document.getElementById('listContent').addEventListener('click', handleListItemClick);
}

/**
 * Handle election selection change
 */
function handleElectionChange(e) {
    state.currentElection = e.target.value;
    document.getElementById('municipalitySelect').disabled = !state.currentElection;
    ui.updateLoadButton(state.currentElection && state.currentMunicipality);
    session.saveLastSession();
}

/**
 * Handle municipality selection change
 */
function handleMunicipalityChange(e) {
    state.currentMunicipality = e.target.value;
    ui.updateLoadButton(state.currentElection && state.currentMunicipality);
    session.saveLastSession();
}

/**
 * Handle load data button click
 */
async function handleLoadData() {
    if (!state.currentElection || !state.currentMunicipality) return;
    
    try {
        const data = await api.loadStembureaus(state.currentElection, state.currentMunicipality);
        
        // Reset active marker when loading new data
        state.activeIndex = null;
        
        ui.renderStembureauList(state.stembureaus, state.modifications);
        mapModule.renderMapMarkers(handleMarkerDrag, handleMarkerActivate);
        mapModule.showMunicipalityBoundary(document.getElementById('showMunicipalityBoundary').checked);
        ui.updateStats(state.stembureaus, state.modifications);
        
        ui.updateSaveAllButton(false);
        ui.updateMatchButton(true);
        
        ui.showToast(`Loaded ${data.total} stembureaus`, 'success');
        
    } catch (error) {
        // Error already handled in api module
    }
}

/**
 * Handle list item clicks (edit and locate buttons)
 */
function handleListItemClick(e) {
    const button = e.target.closest('button');
    if (!button) return;
    
    const action = button.dataset.action;
    const index = parseInt(button.dataset.index);
    
    if (action === 'edit') {
        editStembureau(index);
    } else if (action === 'locate') {
        locateStembureau(index);
    }
}

/**
 * Edit a stembureau
 */
function editStembureau(index) {
    const stembureau = state.stembureaus[index];
    state.selectedIndex = index;
    ui.openEditModal(stembureau);
}

/**
 * Locate a stembureau on the map
 */
function locateStembureau(index) {
    const stembureau = state.stembureaus[index];
    
    if (stembureau.lat && stembureau.lon) {
        // Deactivate previous marker if any
        if (state.activeIndex !== null && state.activeIndex !== index) {
            mapModule.deactivateMarker(state.activeIndex);
        }
        
        // Set as active
        state.activeIndex = index;
        mapModule.setActiveMarker(index);
        
        // Fly to location and highlight in list
        mapModule.flyToLocation(stembureau.lat, stembureau.lon);
        ui.highlightListItem(index);
    } else {
        ui.showToast('This stembureau has no location set', 'error');
    }
}

/**
 * Handle modal save button
 */
function handleModalSave() {
    const { lat, lon } = ui.getModalCoordinates();
    
    if (isNaN(lat) || isNaN(lon)) {
        ui.showToast('Please enter valid coordinates', 'error');
        return;
    }
    
    if (lat < 50 || lat > 54 || lon < 3 || lon > 8) {
        ui.showToast('Coordinates out of range for Netherlands', 'error');
        return;
    }
    
    updateStembureauLocation(state.selectedIndex, lat, lon);
    ui.closeEditModal();
    ui.clearAddressSearch();
    state.selectedIndex = null;
}

/**
 * Handle remove location button
 */
function handleRemoveLocation() {
    if (state.selectedIndex === null) return;
    
    if (confirm('Are you sure you want to remove this location?')) {
        updateStembureauLocation(state.selectedIndex, null, null);
        ui.closeEditModal();
        ui.clearAddressSearch();
        state.selectedIndex = null;
    }
}

/**
 * Handle address search button
 */
async function handleAddressSearch() {
    const searchInput = document.getElementById('modalAddressSearch');
    const query = searchInput.value.trim();
    
    if (!query) {
        ui.showToast('Please enter an address or postcode', 'error');
        return;
    }
    
    try {
        ui.updateSearchButton(false);
        const results = await api.searchAddress(query);
        ui.displayAddressSearchResults(results);
        
        if (results.length > 0) {
            ui.showToast(`Found ${results.length} result(s)`, 'success');
        }
    } catch (error) {
        ui.showToast(error.message || 'Search failed', 'error');
        ui.displayAddressSearchResults([]);
    } finally {
        ui.updateSearchButton(true);
    }
}

/**
 * Handle address result click
 */
function handleAddressResultClick(e) {
    const resultDiv = e.target.closest('.address-search-result');
    if (!resultDiv) return;
    
    const lat = parseFloat(resultDiv.dataset.lat);
    const lon = parseFloat(resultDiv.dataset.lon);
    
    // Populate the coordinate fields
    document.getElementById('modalLat').value = lat;
    document.getElementById('modalLon').value = lon;
    
    // Hide results
    ui.hideAddressSearchResults();
    
    ui.showToast('Coordinates filled. Click Save to apply.', 'info');
}

/**
 * Update a stembureau's location
 */
function updateStembureauLocation(index, lat, lon) {
    const stembureau = state.stembureaus[index];
    stembureau.lat = lat;
    stembureau.lon = lon;
    
    // Track modification
    state.modifications.add(index);
    
    // Update UI
    ui.renderStembureauList(state.stembureaus, state.modifications);
    mapModule.updateMarker(index);
    ui.updateStats(state.stembureaus, state.modifications);
    
    ui.updateSaveAllButton(state.modifications.size > 0);
    
    ui.showToast('Location updated (not saved yet)', 'info');
}

/**
 * Handle marker drag on map
 */
function handleMarkerDrag(index, lat, lng) {
    updateStembureauLocation(index, lat, lng);
}

/**
 * Handle marker activation (double-click)
 */
function handleMarkerActivate(index) {
    // Deactivate previous marker if any
    if (state.activeIndex !== null && state.activeIndex !== index) {
        mapModule.deactivateMarker(state.activeIndex);
    }
    
    // Set new active marker
    state.activeIndex = index;
    mapModule.setActiveMarker(index);
    
    // Scroll to and highlight in list
    ui.highlightListItem(index);
}

/**
 * Handle search input
 */
function handleSearch(e) {
    ui.filterStembureaus(e.target.value);
}

/**
 * Handle boundary toggle
 */
function handleBoundaryToggle(e) {
    mapModule.showMunicipalityBoundary(e.target.checked);
}

/**
 * Handle save all button
 */
async function handleSaveAll() {
    if (state.modifications.size === 0) {
        ui.showToast('No changes to save', 'info');
        return;
    }
    
    const modificationsArray = Array.from(state.modifications);
    let saved = 0;
    let failed = 0;
    
    ui.showToast(`Saving ${modificationsArray.length} changes...`, 'info');
    ui.updateSaveAllButton(false);
    
    for (const index of modificationsArray) {
        const stembureau = state.stembureaus[index];
        
        try {
            await api.saveLocation(
                state.currentElection,
                state.currentMunicipality,
                index,
                stembureau.lat,
                stembureau.lon
            );
            
            saved++;
            state.modifications.delete(index);
        } catch (error) {
            failed++;
            console.error(`Failed to save ${stembureau.identifier}:`, error);
        }
    }
    
    // Update UI
    ui.renderStembureauList(state.stembureaus, state.modifications);
    ui.updateStats(state.stembureaus, state.modifications);
    
    if (failed === 0) {
        ui.showToast(`✓ Successfully saved ${saved} changes`, 'success');
        // Update original data
        state.originalStembureaus = JSON.parse(JSON.stringify(state.stembureaus));
    } else {
        ui.showToast(`Saved ${saved}, failed ${failed}`, 'error');
        ui.updateSaveAllButton(state.modifications.size > 0);
    }
}

/**
 * Handle open match modal
 */
function handleOpenMatchModal() {
    ui.openMatchModal(state.elections, state.currentElection);
}

/**
 * Handle find matches button
 */
async function handleFindMatches() {
    const { sourceElection, threshold } = ui.getMatchParameters();
    
    if (!sourceElection) {
        ui.showToast('Please select a source election', 'error');
        return;
    }
    
    try {
        ui.updateFindMatchesButton(false);
        
        const data = await api.matchLocations(
            state.currentElection,
            state.currentMunicipality,
            sourceElection,
            threshold,
            state.stembureaus
        );
        
        ui.displayMatchResults(data.matches, sourceElection);
        ui.showToast(`Found ${data.total} matches`, 'success');
        
    } catch (error) {
        // Error already handled in api module
    } finally {
        ui.updateFindMatchesButton(true);
    }
}

/**
 * Handle apply matches button
 */
function handleApplyMatches() {
    const matches = ui.getSelectedMatches();
    
    if (matches.length === 0) {
        ui.showToast('No matches selected', 'error');
        return;
    }
    
    let applied = 0;
    
    matches.forEach(match => {
        updateStembureauLocation(match.index, match.lat, match.lon);
        applied++;
    });
    
    ui.closeMatchModal();
    ui.showToast(`Applied ${applied} matched locations`, 'success');
}

/**
 * Restore previous session if available
 */
function restoreSession() {
    const sessionData = session.restoreLastSession();
    if (!sessionData) return;
    
    // Restore election selection
    if (sessionData.election) {
        document.getElementById('electionSelect').value = sessionData.election;
        state.currentElection = sessionData.election;
        document.getElementById('municipalitySelect').disabled = false;
    }
    
    // Restore municipality selection
    if (sessionData.municipality) {
        document.getElementById('municipalitySelect').value = sessionData.municipality;
        state.currentMunicipality = sessionData.municipality;
    }
    
    // Update UI
    ui.updateLoadButton(state.currentElection && state.currentMunicipality);
    
    // If both election and municipality are restored, automatically load data
    if (state.currentElection && state.currentMunicipality) {
        const municipality = state.municipalities.find(m => m.code === state.currentMunicipality);
        ui.showToast(`Restoring session: ${state.currentElection} - ${municipality?.name || state.currentMunicipality}`, 'info');
        
        // Automatically load the data
        setTimeout(() => {
            handleLoadData();
        }, 500);
    }
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', init);


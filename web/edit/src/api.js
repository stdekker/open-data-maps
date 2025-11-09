/**
 * API Communication Module
 * Handles all server communication
 */

import { state } from './state.js';
import { showToast } from './ui.js';

/**
 * Load available elections from the server
 */
export async function loadElections() {
    try {
        const response = await fetch('../api/elections.php');
        const data = await response.json();
        
        if (data.elections) {
            state.elections = data.elections;
            return data.elections;
        }
        return [];
    } catch (error) {
        showToast('Failed to load elections', 'error');
        console.error(error);
        throw error;
    }
}

/**
 * Load municipalities from the server
 */
export async function loadMunicipalities() {
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
            
            return state.municipalities;
        }
        return [];
    } catch (error) {
        showToast('Failed to load municipalities', 'error');
        console.error(error);
        throw error;
    }
}

/**
 * Load stembureaus data for a given election and municipality
 */
export async function loadStembureaus(election, municipality) {
    if (!election || !municipality) {
        throw new Error('Election and municipality are required');
    }
    
    try {
        showToast('Loading data...', 'info');
        
        const response = await fetch(
            `api/list-stembureaus.php?election=${election}&municipality=${municipality}`
        );
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load data');
        }
        
        state.stembureaus = data.stembureaus;
        state.originalStembureaus = JSON.parse(JSON.stringify(data.stembureaus));
        state.modifications.clear();
        
        return data;
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error(error);
        throw error;
    }
}

/**
 * Save a single location to the server
 */
export async function saveLocation(election, municipality, index, lat, lon) {
    try {
        const response = await fetch('api/save-location.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                csrf_token: window.EDIT_CONFIG.csrfToken,
                election: election,
                municipality: municipality,
                index: index,
                lat: lat,
                lon: lon
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to save location');
        }
        
        return data;
    } catch (error) {
        console.error('Error saving location:', error);
        throw error;
    }
}

/**
 * Find matching locations from another election
 */
export async function matchLocations(currentElection, currentMunicipality, sourceElection, threshold, stembureaus) {
    try {
        showToast('Finding matches...', 'info');
        
        const response = await fetch('api/match-locations.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                csrf_token: window.EDIT_CONFIG.csrfToken,
                currentElection: currentElection,
                currentMunicipality: currentMunicipality,
                sourceElection: sourceElection,
                threshold: threshold,
                stembureaus: stembureaus
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to find matches');
        }
        
        return data;
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error(error);
        throw error;
    }
}


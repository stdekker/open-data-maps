/**
 * Session Persistence Module
 * Handles saving and restoring user session state
 */

import { state } from './state.js';
import { showToast } from './ui.js';

const SESSION_KEY = 'stembureau_editor_session';
const SESSION_MAX_AGE_DAYS = 7;

/**
 * Save current session to localStorage
 */
export function saveLastSession() {
    try {
        const sessionData = {
            election: state.currentElection || '',
            municipality: state.currentMunicipality || '',
            timestamp: Date.now()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
        console.error('Failed to save session:', error);
    }
}

/**
 * Restore session from localStorage
 * Returns the restored session data or null if not available/expired
 */
export function restoreLastSession() {
    try {
        const sessionDataStr = localStorage.getItem(SESSION_KEY);
        if (!sessionDataStr) return null;
        
        const sessionData = JSON.parse(sessionDataStr);
        
        // Check if session is not too old
        const daysSinceLastSession = (Date.now() - sessionData.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSession > SESSION_MAX_AGE_DAYS) {
            // Clear old session data
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        
        // Validate election exists
        if (sessionData.election && !state.elections.includes(sessionData.election)) {
            return null;
        }
        
        // Validate municipality exists
        if (sessionData.municipality && !state.municipalities.find(m => m.code === sessionData.municipality)) {
            return null;
        }
        
        return sessionData;
        
    } catch (error) {
        console.error('Failed to restore session:', error);
        // Clear corrupted data
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

/**
 * Clear the stored session
 */
export function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (error) {
        console.error('Failed to clear session:', error);
    }
}


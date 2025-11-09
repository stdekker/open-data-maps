/**
 * State Management Module
 * Central state for the Stembureau Location Editor
 */

export const state = {
    elections: [],
    municipalities: [],
    currentElection: null,
    currentMunicipality: null,
    stembureaus: [],
    originalStembureaus: [],
    map: null,
    markers: {},
    selectedIndex: null,
    activeIndex: null,
    municipalityBoundary: null,
    modifications: new Set()
};


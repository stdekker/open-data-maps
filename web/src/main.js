// Import configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';
import { loadElectionData } from './modules/electionService.js';
import { getUrlParams, updateUrlParams } from './modules/urlParams.js';
import { initializeMobileHandler } from './modules/mobileHandler.js';
import { addMapLayers, addReportingUnits, cleanupReportingUnits, setupFeatureNameBox } from './modules/layerDrawingService.js';
import { initializeElectionService } from './modules/electionService.js';
import { Modal } from './modules/modalService.js';

let showElectionData = false;
let currentView = 'national';

// Map initialization
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: MAP_STYLE,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    pitchWithRotate: false,
    dragRotate: false,
});

// Wait for map to load before doing anything
map.on('load', async () => {
    // Initialize election service
    await initializeElectionService();
    
    fetch('data/overview.json')
        .then(response => response.json())
        .then(data => {
            const searchInput = document.getElementById('searchInput');
            const autocompleteList = document.getElementById('autocompleteList');

            setupSearch(searchInput, autocompleteList, data);

            initialMunicipalitySelection(data);
        });
});

function setupSearch(searchInput, autocompleteList, data) {
    searchInput.addEventListener('input', function() {
        const value = this.value.trim().toLowerCase();
        autocompleteList.innerHTML = '';
        const searchError = document.querySelector('.search-error');
        
        if (value.length < 2) {
            searchError.classList.remove('visible');
            return;
        }

        const matches = data.gemeenten.filter(municipality => 
            municipality.naam.toLowerCase().includes(value)
        );

        if (matches.length === 0) {
            searchError.classList.add('visible');
        } else {
            searchError.classList.remove('visible');
        }

        matches.forEach(municipality => {
            const div = document.createElement('div');
            div.textContent = municipality.naam;
            div.addEventListener('click', () => {
                selectMunicipality(municipality, searchInput, autocompleteList);
            });
            autocompleteList.appendChild(div);
        });
    });

    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            const value = this.value.trim().toLowerCase();
            const matches = data.gemeenten.filter(municipality => 
                municipality.naam.toLowerCase().includes(value)
            );
            
            // First try to find an exact match
            const exactMatch = data.gemeenten.find(municipality =>
                municipality.naam.toLowerCase() === value
            );

            if (exactMatch) {
                // If there's an exact match, use that
                selectMunicipality(exactMatch, searchInput, document.getElementById('autocompleteList'));
            } else if (matches.length === 1) {
                // If there's only one partial match, use that
                selectMunicipality(matches[0], searchInput, document.getElementById('autocompleteList'));
            }
        }
    });
}

function initialMunicipalitySelection(data) {
    const params = getUrlParams();
    let municipality = null;
    
    if (params.gemeente) {
        municipality = data.gemeenten.find(m => 
            m.naam.toLowerCase() === params.gemeente.toLowerCase()
        );
    }
    
    if (!municipality) {
        const lastMunicipality = localStorage.getItem('lastMunicipality');
        if (lastMunicipality) {
            municipality = JSON.parse(lastMunicipality);
        } else {
            municipality = data.gemeenten.find(m => 
                m.naam === DEFAULT_MUNICIPALITY
            );
        }
    }
    
    if (municipality) {
        selectMunicipality(municipality);
    }
}

function selectMunicipality(municipality) {
    const searchInput = document.getElementById('searchInput');
    const autocompleteList = document.getElementById('autocompleteList');
    const searchError = document.querySelector('.search-error');
 
    activateView('municipal', municipality.code);
    
    // Interface updates
    autocompleteList.innerHTML = '';
    searchError.classList.remove('visible');
    
    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
    updateUrlParams(municipality.naam);

    // Hide keyboard on mobile devices
    searchInput.blur();

    setTimeout(() => {
        searchInput.value = '';
    }, 585);
}

// ===== GeoJSON Loading & Display =====
function loadGeoJson(code) {
    // Check if map is loaded
    if (!map.loaded()) {
        map.on('load', () => loadGeoJson(code));
        return;
    }

    // Clean up any existing reporting units
    cleanupReportingUnits(map);

    // Load both GeoJSON and election data
    Promise.all([
        fetch(`api/municipality.php?code=${code}`),
        loadElectionData(code)
    ])
    .then(([geoJsonResponse]) => geoJsonResponse.json())
    .then(data => {
        const geoJsonData = {
            ...data,
            features: data.features.map((feature, index) => ({
                ...feature,
                id: index
            }))
        };

        addMapLayers(map, geoJsonData, municipalityPopulations);
        setupFeatureNameBox(map, municipalityPopulations);

        // Fit bounds to the loaded GeoJSON
        try {
            const bounds = new mapboxgl.LngLatBounds();
            geoJsonData.features.forEach(feature => {
                if (feature.geometry.type === 'Polygon') {
                    feature.geometry.coordinates[0].forEach(coord => {
                        bounds.extend(coord);
                    });
                } else if (feature.geometry.type === 'MultiPolygon') {
                    feature.geometry.coordinates.forEach(polygon => {
                        polygon[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    });
                }
            });
            
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 64 });
            }
        } catch (e) {
            console.error('Error fitting bounds:', e);
        }
    })
    .catch(error => console.error('Error loading data:', error));
}

// Add click handlers for menu items
document.addEventListener('DOMContentLoaded', function() {
    const menuItems = document.querySelectorAll('.menu-items li');
    const initialMenuItem = document.getElementById(DEFAULT_MENU_ITEM);

    if (initialMenuItem) {
        handleMenuItemActivation.call(initialMenuItem);
    }
    // Add keyboard support
    menuItems.forEach(item => {
        // Click handler
        item.addEventListener('click', handleMenuItemActivation);
        
        // Keyboard handler
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMenuItemActivation.call(item);
            }
        });
    });

    function handleMenuItemActivation() {
        // Remove active class and aria-selected from all items
        menuItems.forEach(i => {
            i.classList.remove('active');
        });
        
        // Add active class
        this.classList.add('active');
        
        if (this.id === 'national-view') {
            activateView('national');
        } else if (this.id === 'municipal-view') {
            activateView('municipal');
        }
    }

    // Add election toggle handler
    const electionToggle = document.getElementById('electionToggle');
    const statsView = document.querySelector('.stats-view');
    
    // Restore toggle state from localStorage
    showElectionData = localStorage.getItem('showElectionData') === 'true';
    electionToggle.checked = showElectionData;
    statsView.style.display = showElectionData ? 'block' : 'none';

    electionToggle.addEventListener('change', function() {
        showElectionData = this.checked;
        localStorage.setItem('showElectionData', showElectionData);
        statsView.style.display = showElectionData ? 'block' : 'none';
        
        // If showing election data and we have a municipality selected, load the data
        if (showElectionData) {
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                const municipality = JSON.parse(lastMunicipality);
                const currentElection = localStorage.getItem('lastElection') || 'TK2021';
                loadElectionData(municipality.code, currentElection);
            }
        } else {
            // Clean up reporting units when hiding election data
            cleanupReportingUnits(map);
        }
    });

    // Initialize mobile handler
    initializeMobileHandler();

    // Initialize modal
    const modal = new Modal();
    
    // Add help button handler
    const helpButton = document.querySelector('.help-button');
    helpButton.addEventListener('click', () => {
        modal.openFromUrl('Help', 'content/help.php');
    });
});

// Add this function near the top of the file
async function ensurePopulationData() {
    if (Object.keys(municipalityPopulations).length === 0) {
        try {
            const response = await fetch('data/gemeenten.json');
            const data = await response.json();
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = {
                    aantalInwoners: feature.properties.aantalInwoners,
                    aantalHuishoudens: feature.properties.aantalHuishoudens
                };
            });
        } catch (error) {
            console.error('Error loading population data:', error);
        }
    }
}

// Modify the activateView function
function activateView(viewType, municipalityCode = null) {
    // Update current view
    currentView = viewType;

    // Update menu item states
    const viewItem = document.getElementById(`${viewType}-view`);
    document.querySelectorAll('.menu-items li').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    viewItem.classList.add('active');
    viewItem.setAttribute('aria-selected', 'true');

    // Clear and hide stats view when switching to national view
    const statsView = document.querySelector('.stats-view');
    if (viewType === 'national') {
        statsView.innerHTML = '';
        statsView.style.display = 'none';
        updateUrlParams(null); // Remove gemeente parameter
        
        // Load national view first, then clean up reporting units
        loadNationalGeoJson().then(() => {
            cleanupReportingUnits(map);
        });
    } else if (viewType === 'municipal') {
        statsView.style.display = showElectionData ? 'block' : 'none';
        ensurePopulationData().then(() => {
            if (municipalityCode) {
                loadGeoJson(municipalityCode);
                if (showElectionData) {
                    loadElectionData(municipalityCode, localStorage.getItem('lastElection') || 'TK2021');
                }
            } else {
                const lastMunicipality = localStorage.getItem('lastMunicipality');
                if (lastMunicipality) {
                    const municipality = JSON.parse(lastMunicipality);
                    loadGeoJson(municipality.code);
                    if (showElectionData) {
                        loadElectionData(municipality.code, localStorage.getItem('lastElection') || 'TK2021');
                    }
                }
            }
        });
    }
}

// Add this at the top level of the file, after the imports
let municipalityPopulations = {};

// Modify the loadNationalGeoJson function
function loadNationalGeoJson() {
    // Check if map is loaded
    if (!map.loaded()) {
        return new Promise(resolve => {
            map.on('load', () => {
                loadNationalGeoJson().then(resolve);
            });
        });
    }

    // Remove any existing event listeners to prevent duplicates
    map.off('dblclick', 'municipalities');

    return fetch('data/gemeenten.json')
        .then(response => response.json())
        .then(data => {
            // Store both population and household data
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = {
                    aantalInwoners: feature.properties.aantalInwoners,
                    aantalHuishoudens: feature.properties.aantalHuishoudens
                };
            });
            
            // Convert coordinates and add layers
            const geoJsonData = {
                ...data,
                features: data.features.map((feature, index) => ({
                    ...feature,
                    id: index,
                    geometry: {
                        type: feature.geometry.type,
                        coordinates: feature.geometry.coordinates
                    }
                }))
            };

            addMapLayers(map, geoJsonData, municipalityPopulations);
            setupFeatureNameBox(map, municipalityPopulations);

            // Remove previous double-click handler if it exists
            map.off('dblclick', 'municipalities');

            // Add the double-click handler
            map.on('dblclick', 'municipalities', (e) => {
                // Only handle double-click if we're in national view
                if (currentView !== 'national') {
                    return;
                }

                e.preventDefault();
                
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    const municipality = {
                        naam: feature.properties.gemeentenaam,
                        code: feature.properties.gemeentecode
                    };
                    
                    // Update menu state
                    const municipalView = document.getElementById('municipal-view');
                    document.querySelectorAll('.menu-items li').forEach(item => {
                        item.classList.remove('active');
                    });
                    municipalView.classList.add('active');

                    // Switch to municipal view
                    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
                    activateView('municipal', municipality.code);
                }
            });

            // When loading all municipalities, fit bounds to show all municipalities
            try {
                const bounds = new mapboxgl.LngLatBounds();
                geoJsonData.features.forEach(feature => {
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach(polygon => {
                            polygon[0].forEach(coord => {
                                bounds.extend(coord);
                            });
                        });
                    }
                });

                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 64 });
                }
            } catch (e) {
                console.error('Error fitting bounds:', e);
            }

            return data; // Return the data to indicate completion
        })
        .catch(error => {
            console.error('Error loading gemeenten data:', error);
            throw error;
        });
}

// Update the event listener for reporting units
window.addEventListener('reportingUnitsLoaded', (event) => {
    const { geoJsonData } = event.detail;
    addReportingUnits(map, geoJsonData, showElectionData);
});
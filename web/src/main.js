// Import configuration
import { MAPBOX_ACCESS_TOKEN, MAP_STYLE, MAP_CENTER, MAP_ZOOM, DEFAULT_MUNICIPALITY, DEFAULT_MENU_ITEM } from './config.js';

// ===== Projection Setup =====
// Define the Dutch RD New projection
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');

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
map.on('load', () => {
    fetch('data/overview.json')
        .then(response => response.json())
        .then(data => {
            const searchInput = document.getElementById('searchInput');
            const autocompleteList = document.getElementById('autocompleteList');

            function selectMunicipality(municipality) {
                // First update the input value to show feedback
                searchInput.value = municipality.naam;
                autocompleteList.innerHTML = '';
                
                // Store the selected municipality in localStorage
                localStorage.setItem('lastMunicipality', JSON.stringify(municipality));

                // Activate municipal view and load the municipality data
                activateView('municipal', municipality.code);

                // Clear the search input after a short delay to show feedback
                setTimeout(() => {
                    searchInput.value = '';
                }, 500);
            }

            // Handle input for autocomplete
            searchInput.addEventListener('input', function() {
                const value = this.value.toLowerCase();
                autocompleteList.innerHTML = '';

                if (value.length < 2) return;

                const matches = data.gemeenten.filter(municipality => 
                    municipality.naam.toLowerCase().includes(value)
                );

                matches.forEach(municipality => {
                    const div = document.createElement('div');
                    div.textContent = municipality.naam;
                    div.addEventListener('click', () => {
                        selectMunicipality(municipality);
                    });
                    autocompleteList.appendChild(div);
                });
            });

            // Handle Enter key press
            searchInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    const value = this.value.toLowerCase();
                    const matches = data.gemeenten.filter(municipality => 
                        municipality.naam.toLowerCase().includes(value)
                    );
                    if (matches.length === 1) {
                        selectMunicipality(matches[0]);
                    }
                }
            });

            // Initial Municipality Loading
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                selectMunicipality(JSON.parse(lastMunicipality));
            } else {
                // Load default if there is no stored municipality
                const initialMunicipality = data.gemeenten.find(municipality => 
                    municipality.naam === DEFAULT_MUNICIPALITY
                );
                if (initialMunicipality) {
                    selectMunicipality(initialMunicipality);
                }
            }
        });
});

// ===== GeoJSON Loading & Display =====
function loadGeoJson(code) {
    // Check if map is loaded
    if (!map.loaded()) {
        map.on('load', () => loadGeoJson(code));
        return;
    }

    fetch(`fetch-municipality.php?code=${code}`)
        .then(response => response.json())
        .then(data => {
            const geoJsonData = {
                ...data,
                features: data.features.map((feature, index) => ({
                    ...feature,
                    id: index,
                    geometry: {
                        type: feature.geometry.type,
                        coordinates: transformCoordinates(feature.geometry.coordinates, feature.geometry.type)
                    }
                }))
            };

            addMapLayers(geoJsonData);

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
        .catch(error => console.error('Error loading GeoJSON:', error));
}

// Coordinate Transformation 
function transformCoordinates(coords, type) {
    const transform = coord => proj4('EPSG:28992', 'EPSG:4326').forward(coord);
    
    if (type === 'Polygon') {
        return coords.map(ring => ring.map(transform));
    } else if (type === 'MultiPolygon') {
        return coords.map(polygon => polygon.map(ring => ring.map(transform)));
    }
    return coords;
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
});

// Add this function near the top of the file
async function ensurePopulationData() {
    if (Object.keys(municipalityPopulations).length === 0) {
        try {
            const response = await fetch('data/gemeenten.json');
            const data = await response.json();
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = feature.properties.aantalInwoners;
            });
        } catch (error) {
            console.error('Error loading population data:', error);
        }
    }
}

// Modify the activateView function
function activateView(viewType, municipalityCode = null) {
    // Update menu item states
    const viewItem = document.getElementById(`${viewType}-view`);
    document.querySelectorAll('.menu-items li').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    viewItem.classList.add('active');
    viewItem.setAttribute('aria-selected', 'true');

    if (viewType === 'national') {
        loadNationalGeoJson();
    } else if (viewType === 'municipal') {
        ensurePopulationData().then(() => {
            if (municipalityCode) {
                loadGeoJson(municipalityCode);
            } else {
                const lastMunicipality = localStorage.getItem('lastMunicipality');
                if (lastMunicipality) {
                    loadGeoJson(JSON.parse(lastMunicipality).code);
                }
            }
        });
    }
}

// Add this at the top level of the file, after the imports
let municipalityPopulations = {};

// In the loadNationalGeoJson function, after fetching the data
function loadNationalGeoJson() {
    // Check if map is loaded
    if (!map.loaded()) {
        map.on('load', () => loadNationalGeoJson());
        return;
    }

    // Remove any existing event listeners to prevent duplicates
    map.off('dblclick', 'municipalities');

    fetch('data/gemeenten.json')
        .then(response => response.json())
        .then(data => {
            // Store population data
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = feature.properties.aantalInwoners;
            });
            
            // Convert coordinates and add layers
            const geoJsonData = {
                ...data,
                features: data.features.map((feature, index) => ({
                    ...feature,
                    id: index,
                    geometry: {
                        type: feature.geometry.type,
                        coordinates: transformCoordinates(feature.geometry.coordinates, feature.geometry.type)
                    }
                }))
            };

            addMapLayers(geoJsonData);

            // Remove previous double-click handler if it exists
            map.off('dblclick', 'municipalities');

            // Add the double-click handler
            map.on('dblclick', 'municipalities', (e) => {
                e.preventDefault(); // Prevent default double-click behavior
                
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
        })
        .catch(error => {
            console.error('Error loading gemeenten data:', error);
        });
}

// Modify the addMapLayers function
function addMapLayers(geoJsonData) {
    // Clean up existing layers and sources first
    const layersToRemove = ['municipality-borders', 'municipalities'];
    layersToRemove.forEach(layer => {
        if (map.getLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    if (map.getSource('municipalities')) {
        map.removeSource('municipalities');
    }

    // Add the GeoJSON source immediately
    map.addSource('municipalities', {
        type: 'geojson',
        data: geoJsonData,
        generateId: true  // This can help with performance
    });

    // Add this after the imports
    const populationColorScale = chroma.scale(['#add8e6', '#4682b4', '#00008b'])
        .domain([10000, 350000, 1000000])  
        .mode('lab');

    // In the addMapLayers function, update the fill layer
    map.addLayer({
        'id': 'municipalities',
        'type': 'fill',
        'source': 'municipalities',
        'paint': {
            'fill-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                // Lighter shade when hovering
                ['interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'aantalInwoners'], 0],  // Use 0 if aantalInwoners is null
                    10000, chroma(populationColorScale(10000)).brighten().hex(),
                    1000000, chroma(populationColorScale(1000000)).brighten().hex()
                ],
                // Normal shade
                ['interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'aantalInwoners'], 0],  // Use 0 if aantalInwoners is null
                    10000, populationColorScale(10000).hex(),
                    1000000, populationColorScale(1000000).hex()
                ]
            ],
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.8,  // hover opacity
                0.6   // default opacity
            ],
            'fill-outline-color': '#00509e',  // Normal border
        }
    });

    // Update the border layer for better contrast
    map.addLayer({
        'id': 'municipality-borders',
        'type': 'line',
        'source': 'municipalities',
        'paint': {
            'line-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#99c2ff',  // Lighter border when hovering
                '#00509e'   // Normal border
            ],
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                2,    // hover width
                1     // default width
            ]
        }
    });

    // Variable to track the currently hovered feature
    let hoveredFeatureId = null;

    // Select the feature name box
    let featureNameBox = document.querySelector('.feature-name-box');

    // Keep track of selected municipality
    const selectedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality')).naam 
        : null;

    // Update feature name box content
    function updateFeatureNameBox(feature) {
        const storedMunicipality = localStorage.getItem('lastMunicipality') 
            ? JSON.parse(localStorage.getItem('lastMunicipality'))
            : null;

        const getPopulationText = (name, code) => {
            const population = municipalityPopulations[code];
            const formattedPopulation = population?.toLocaleString('nl-NL') || '';
            return `${name} ${formattedPopulation ? `<span class="population-text">(${formattedPopulation} inwoners)</span>` : ''}`;
        };

        let content = '';
        if (storedMunicipality) {
            content = `<div>${getPopulationText(storedMunicipality.naam, storedMunicipality.code)}</div>`;
        }

        if (feature) {
            const currentGemeentenaam = feature.properties.gemeentenaam || storedMunicipality?.naam;
            const currentCode = feature.properties.gemeentecode;
            if (currentGemeentenaam && (!storedMunicipality || currentGemeentenaam !== storedMunicipality.naam)) {
                content = `<div>${getPopulationText(currentGemeentenaam, currentCode)}</div>`;
            }
            if (feature.properties?.buurtnaam) {
                content += `<div class="hovered-name">${feature.properties.buurtnaam}`;
                if (feature.properties?.aantalInwoners) {
                    content += ` <span class="population-text">(${feature.properties.aantalInwoners} inwoners)</span>`;
                }
                content += `</div>`;
            }
        }

        featureNameBox.innerHTML = content;
        featureNameBox.style.display = content ? 'block' : 'none';
    }

    // Initial display of selected municipality
    if (selectedMunicipality) {
        updateFeatureNameBox();
    }

    // Mouse enter event
    map.on('mousemove', 'municipalities', (e) => {
        if (e.features.length > 0) {
            if (hoveredFeatureId !== null) {
                map.setFeatureState(
                    { source: 'municipalities', id: hoveredFeatureId },
                    { hover: false }
                );
            }
            hoveredFeatureId = e.features[0].id;
            map.setFeatureState(
                { source: 'municipalities', id: hoveredFeatureId },
                { hover: true }
            );

            // Show feature names
            updateFeatureNameBox(e.features[0]);
        }
    });

    // Mouse leave event
    map.on('mouseleave', 'municipalities', () => {
        if (hoveredFeatureId !== null) {
            map.setFeatureState(
                { source: 'municipalities', id: hoveredFeatureId },
                { hover: false }
            );
        }
        hoveredFeatureId = null;
        
        // Show only selected municipality if it exists
        updateFeatureNameBox();
    });
}
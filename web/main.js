// ===== Projection Setup =====
// Define the Dutch RD New projection
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');

// ===== Map Initialization =====            
// Add your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoic2Rla2tlciIsImEiOiJjaXF4cjI1ZTAwMDRxaHVubmgwOHJjajJ1In0.w7ja8Yc35uk3yXCd7wXFhg';

// Replace the Leaflet map initialization with Mapbox
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
const mapStyle = 'mapbox://styles/mapbox/light-v11';

const map = new mapboxgl.Map({
    container: 'map',
    style: mapStyle,
    center: [5.3875, 52.1561],
    zoom: 12,
    pitchWithRotate: false,
    dragRotate: false
});

// Set initial menu state before waiting for map load
document.querySelectorAll('.menu-items li').forEach(item => {
    if (item.textContent === 'Gemeente') {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
    } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    }
});

// Wait for map to load before doing anything
map.on('load', () => {
    // Load initial data only after map is ready
    fetch('data/overview.json')
        .then(response => response.json())
        .then(data => {
            const searchInput = document.getElementById('searchInput');
            const autocompleteList = document.getElementById('autocompleteList');

            function selectMunicipality(municipality) {
                // First update the input value to show feedback
                searchInput.value = municipality.naam;
                autocompleteList.innerHTML = '';
                
                // Store selected municipality in localStorage
                localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
                
                // Always switch to Gemeente view when selecting a municipality
                document.querySelectorAll('.menu-items li').forEach(item => {
                    item.classList.remove('active');
                    item.setAttribute('aria-selected', 'false');
                    if (item.textContent === 'Gemeente') {
                        item.classList.add('active');
                        item.setAttribute('aria-selected', 'true');
                    }
                });
                
                // Load the municipality data
                const menuItems = document.querySelector('.stats-view');
                menuItems.innerHTML = '';
                loadGeoJson(municipality.code);

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

            // ===== Initial Municipality Loading =====
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                selectMunicipality(JSON.parse(lastMunicipality));
            } else {
                // Load Amer as default if no stored municipality
                const amersfoort = data.gemeenten.find(municipality => 
                    municipality.naam.toLowerCase() === 'amersfoort'
                );
                if (amersfoort) {
                    selectMunicipality(amersfoort);
                }
            }
        });
});

var currentGeoJsonLayer = null;

// ===== GeoJSON Loading & Display =====
function loadGeoJson(code) {
    // Check if map is loaded
    if (!map.loaded()) {
        map.on('load', () => loadGeoJson(code));
        return;
    }

    // Remove existing layers if they exist
    if (map.getLayer('municipalities')) {
        map.removeLayer('municipalities');
    }
    if (map.getLayer('municipality-borders')) {
        map.removeLayer('municipality-borders');
    }
    if (map.getSource('municipalities')) {
        map.removeSource('municipalities');
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

// ===== Coordinate Transformation =====
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
            i.setAttribute('aria-selected', 'false');
        });
        
        // Add active class and aria-selected to clicked item
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        
        if (this.textContent === 'Landelijk') {
            loadGemeentenData();
        } else if (this.textContent === 'Gemeente') {
            // Clear any existing GeoJSON layer
            if (currentGeoJsonLayer) {
                map.removeLayer(currentGeoJsonLayer);
            }
            // Reload last selected gemeente or default to Amersfoort
            const lastMunicipality = localStorage.getItem('lastMunicipality');
            if (lastMunicipality) {
                loadGeoJson(JSON.parse(lastMunicipality).code);
            }
        }
    }
});

function loadGemeentenData() {
    // Check if map is loaded
    if (!map.loaded()) {
        map.on('load', () => loadGemeentenData());
        return;
    }

    // Remove existing layers if they exist
    if (map.getLayer('municipalities')) {
        map.removeLayer('municipalities');
    }
    if (map.getLayer('municipality-borders')) {
        map.removeLayer('municipality-borders');
    }
    if (map.getSource('municipalities')) {
        map.removeSource('municipalities');
    }

    fetch('data/gemeenten.json')
        .then(response => response.json())
        .then(data => {
            // Convert from EPSG:28992 to EPSG:4326 if needed
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

            // When a gemeente is double clicked, switch to gemeente view and load clicked gemeente
            map.on('dblclick', 'municipalities', (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
       
                    const municipalityViewItem = document.getElementById('municipality-view');
                    document.querySelectorAll('.menu-items li').forEach(item => {
                        item.classList.remove('active');
                        item.setAttribute('aria-selected', 'false');
                    });
                    municipalityViewItem.classList.add('active');
                    municipalityViewItem.setAttribute('aria-selected', 'true');

                    // Store selected municipality in localStorage
                    const municipality = {
                        naam: feature.properties.gemeentenaam,
                        code: feature.properties.gemeentecode
                    };
                    loadGeoJson(municipality.code);

                    localStorage.setItem('lastMunicipality', JSON.stringify(municipality));
                }
            });

            // When loading all gemeenten, fit bounds to show all gemeenten
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
                    map.fitBounds(bounds, { padding: 50 });
                }
            } catch (e) {
                console.error('Error fitting bounds:', e);
            }
        })
        .catch(error => {
            console.error('Error loading gemeenten data:', error);
        });
}

// Add this helper function near the top of the file
function addMapLayers(geoJsonData) {
    // Add the GeoJSON source
    map.addSource('municipalities', {
        type: 'geojson',
        data: geoJsonData
    });

    // Add the fill layer
    map.addLayer({
        'id': 'municipalities',
        'type': 'fill',
        'source': 'municipalities',
        'paint': {
            'fill-color': '#6699cc', 
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.6,  // hover opacity
                0.2   // default opacity
            ],
            'fill-outline-color': '#6699cc' 
        }
    });

    // Add the border layer
    map.addLayer({
        'id': 'municipality-borders',
        'type': 'line',
        'source': 'municipalities',
        'paint': {
            'line-color': '#6699cc',
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                1.5,    // hover width
                1.5     // default width
            ]
        }
    });

    // Variable to track the currently hovered feature
    let hoveredFeatureId = null;

    // Add a div for the feature name if it doesn't exist
    let featureNameBox = document.querySelector('.feature-name-box');
    if (!featureNameBox) {
        featureNameBox = document.createElement('div');
        featureNameBox.className = 'feature-name-box';
        document.body.appendChild(featureNameBox);
    }

    // Keep track of selected municipality
    const selectedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality')).naam 
        : null;

    // Update feature name box content
    function updateFeatureNameBox(feature) {
        let content = selectedMunicipality ? `<div>${selectedMunicipality}</div>` : '';
        
        if (feature) {
            const currentGemeentenaam = feature.properties.gemeentenaam || selectedMunicipality;
            
            if (currentGemeentenaam && currentGemeentenaam !== selectedMunicipality) {
                content = `<div>${currentGemeentenaam}</div>`;
            }
            
            if (feature.properties?.buurtnaam) {
                if (currentGemeentenaam !== selectedMunicipality) {
                    content = `<div>${currentGemeentenaam}</div>`;
                }
                content += `<div class="hovered-name">${feature.properties.buurtnaam}</div>`;
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
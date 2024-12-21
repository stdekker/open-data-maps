import { setupReportingUnitPopupHandlers } from './electionService.js';

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function addMapLayers(map, geoJsonData, municipalityPopulations) {
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

    // Get all existing layers
    const layers = map.getStyle().layers;
    
    // Find the first symbol layer in the map style
    let firstSymbolId;
    for (const layer of layers) {
        if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
        }
    }

    // Add the GeoJSON source immediately
    map.addSource('municipalities', {
        type: 'geojson',
        data: geoJsonData,
        generateId: true
    });

    // Color scale
    const populationColorScale = chroma.scale(['#add8e6', '#4682b4', '#00008b'])
        .domain([10000, 350000, 1000000])  
        .mode('lab');

    // Add GeoJSON geometry layers before symbol layers
    map.addLayer({
        'id': 'municipalities',
        'type': 'fill',
        'source': 'municipalities',
        'paint': {
            'fill-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                ['interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'aantalInwoners'], 0],
                    10000, chroma(populationColorScale(10000)).brighten().hex(),
                    1000000, chroma(populationColorScale(1000000)).brighten().hex()
                ],
                ['interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'aantalInwoners'], 0],
                    10000, populationColorScale(10000).hex(),
                    1000000, populationColorScale(1000000).hex()
                ]
            ],
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.8,
                0.6
            ],
            'fill-outline-color': '#00509e',
        }
    }, firstSymbolId);

    map.addLayer({
        'id': 'municipality-borders',
        'type': 'line',
        'source': 'municipalities',
        'paint': {
            'line-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#99c2ff',
                '#00509e'
            ],
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                2,
                1
            ]
        }
    }, firstSymbolId);
}

export function addReportingUnits(map, geoJsonData, showElectionData = false) {
    if (!showElectionData) {
        return;
    }

    cleanupReportingUnits(map);

    // Store the original data
    const originalData = geoJsonData;
    
    // Add the reporting units source with original data
    map.addSource('reporting-units', {
        type: 'geojson',
        data: originalData
    });

    // Add reporting units layer with dynamic radius
    map.addLayer({
        'id': 'reporting-units',
        'type': 'circle',
        'source': 'reporting-units',
        'paint': {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'totalCounted'],
                0, 6,
                500, 8,
                2000, 12,
                5000, 16,
                10000, 22,
                20000, 30
            ],
            'circle-color': '#4CAF50',
            'circle-opacity': 0.6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        }
    });

    // Setup popup handlers
    setupReportingUnitPopupHandlers(map);
}

export function cleanupReportingUnits(map) {
    if (map.getLayer('reporting-units')) {
        // Only remove event listeners specific to reporting units
        map.off('mousemove', 'reporting-units');
        map.off('mouseout', 'reporting-units');
        map.off('click', 'reporting-units');
        map.off('mouseenter', 'reporting-units');
        map.off('mouseleave', 'reporting-units');
        map.removeLayer('reporting-units');
    }
    if (map.getSource('reporting-units')) {
        map.removeSource('reporting-units');
    }
    if (window.reportingUnitsPopup) {
        window.reportingUnitsPopup.remove();
        window.reportingUnitsPopup = null;
    }
}

// Update feature name box event handlers
export function setupFeatureNameBox(map, municipalityPopulations) {
    let hoveredFeatureId = null;
    let featureNameBox = document.querySelector('.feature-name-box');
    let featureNameContent = featureNameBox.querySelector('.feature-name-content');
    const statsSelect = document.getElementById('statsSelect');
    const settingsButton = featureNameBox.querySelector('.settings-button');
    const statsPopup = featureNameBox.querySelector('.stats-popup');

    // Remove any existing click listeners to prevent duplicates
    const newSettingsButton = settingsButton.cloneNode(true);
    settingsButton.parentNode.replaceChild(newSettingsButton, settingsButton);

    // Setup settings button click handler
    newSettingsButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        statsPopup.classList.toggle('active');
    });

    // Close popup when clicking outside
    const clickHandler = (e) => {
        if (!statsPopup.contains(e.target) && !newSettingsButton.contains(e.target)) {
            statsPopup.classList.remove('active');
        }
    };

    // Remove existing click listener and add new one
    document.removeEventListener('click', clickHandler);
    document.addEventListener('click', clickHandler);

    // Function to get the statistic text
    function getStatisticText(properties, statType) {
        const statValue = properties[statType];
        if (!statValue) return '';
        
        const labels = {
            'aantalInwoners': 'inwoners',
            'aantalHuishoudens': 'huishoudens'
        };
        
        return `<span class="population-text">(${statValue.toLocaleString('nl-NL')} ${labels[statType]})</span>`;
    }

    // Update feature name box content
    function updateFeatureNameBox(feature) {
        const storedMunicipality = localStorage.getItem('lastMunicipality') 
            ? JSON.parse(localStorage.getItem('lastMunicipality'))
            : null;

        const selectedStat = statsSelect.value;

        const getNameWithStat = (name, properties) => {
            return `${name} ${getStatisticText(properties, selectedStat)}`;
        };

        let content = '';
        if (storedMunicipality) {
            const municipalityData = municipalityPopulations[storedMunicipality.code];
            if (municipalityData) {
                content = `<div>${getNameWithStat(storedMunicipality.naam, municipalityData)}</div>`;
            }
        }

        if (feature) {
            const currentGemeentenaam = feature.properties.gemeentenaam || storedMunicipality?.naam;
            if (currentGemeentenaam && (!storedMunicipality || currentGemeentenaam !== storedMunicipality.naam)) {
                content = `<div>${getNameWithStat(currentGemeentenaam, feature.properties)}</div>`;
            }
            if (feature.properties?.buurtnaam) {
                content += `<div class="hovered-name">${getNameWithStat(feature.properties.buurtnaam, feature.properties)}</div>`;
            }
        }

        featureNameContent.innerHTML = content;
        featureNameBox.style.display = content ? 'block' : 'none';
        
        // Hide stats popup when content changes
        statsPopup.classList.remove('active');
    }

    // Initial display of selected municipality
    const selectedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality')).naam 
        : null;
    if (selectedMunicipality) {
        updateFeatureNameBox();
    }

    // Add event listener for statistic selection change
    statsSelect.addEventListener('change', () => {
        localStorage.setItem('selectedStat', statsSelect.value);
        updateFeatureNameBox();
    });

    // Restore last selected statistic
    const lastSelectedStat = localStorage.getItem('selectedStat');
    if (lastSelectedStat) {
        statsSelect.value = lastSelectedStat;
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
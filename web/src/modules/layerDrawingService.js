import { setupReportingUnitPopupHandlers } from './electionService.js';
import { Modal } from './modalService.js';

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

/**
 * Returns the min and max values for a given statistic from the features array.
 *
 * @param {Object} geoJsonData - The GeoJSON data.
 * @param {String} statisticKey - The property key to look for in features.
 * @returns {Array} [minValue, maxValue]
 */
function getMinMaxFromGeoJson(geoJsonData, statisticKey) {
    const values = geoJsonData.features.map(f => f.properties[statisticKey])
        .filter(val => typeof val === 'number' && !isNaN(val) && val !== null);

    if (!values.length) {
        // No valid numeric data; fallback
        return [0, 0];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // If they are the same, create an artificial range to avoid domain errors
    if (minValue === maxValue) {
        return [minValue, minValue + 1];
    }

    return [minValue, maxValue];
}

/**
 * Builds a dynamic 'fill-color' expression for Mapbox GL
 * such that the smallest value is lightest and the largest is darkest.
 *
 * @param {Object} geoJsonData     - The full GeoJSON data.
 * @param {String} statisticKey    - The property key to color by (e.g., "aantalInwoners").
 * @returns {Array} Mapbox GL Style expression for 'fill-color'.
 */
export function getDynamicFillColorExpression(geoJsonData, statisticKey) {
    const [minValue, maxValue] = getMinMaxFromGeoJson(geoJsonData, statisticKey);

    // Create a chroma scale from lightest to darkest
    const colorScale = chroma
        .scale(['#add8e6', '#4682b4', '#00008b'])
        .domain([minValue, maxValue])
        .mode('lab');

    // Here we construct a single expression which checks for hover,
    // then uses the scale’s color for that data value.
    // We “brighten” colors a bit on hover.
    return [
        'case',
        // If hovered
        ['boolean', ['feature-state', 'hover'], false],
        [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', statisticKey], 0],
            minValue, colorScale(minValue).brighten().hex(),
            maxValue, colorScale(maxValue).brighten().hex()
        ],
        // Else (not hovered)
        [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', statisticKey], 0],
            minValue, colorScale(minValue).hex(),
            maxValue, colorScale(maxValue).hex()
        ]
    ];
}

// Add this function near the top of the file
function populateStatisticsSelect(statsSelect, data) {
    // Define the groups and their statistics
    const groups = {
        'Basis': [
            'aantalInwoners',
            'aantalHuishoudens',
            'omgevingsadressendichtheid',
            'stedelijkheidAdressenPerKm2',
            'bevolkingsdichtheidInwonersPerKm2',
            'mannen',
            'vrouwen'
        ],
        'Leeftijdsgroepen': [
            'percentagePersonen0Tot15Jaar',
            'percentagePersonen15Tot25Jaar',
            'percentagePersonen25Tot45Jaar',
            'percentagePersonen45Tot65Jaar',
            'percentagePersonen65JaarEnOuder'
        ],
        'Burgerlijke staat': [
            'percentageOngehuwd',
            'percentageGehuwd',
            'percentageGescheid',
            'percentageVerweduwd'
        ],
        'Huishoudens': [
            'percentageEenpersoonshuishoudens',
            'percentageHuishoudensZonderKinderen',
            'percentageHuishoudensMetKinderen',
            'gemiddeldeHuishoudsgrootte'
        ],
        'Herkomst': [
            'percentageMetHerkomstlandNederland',
            'percentageMetHerkomstlandUitEuropaExclNl',
            'percentageMetHerkomstlandBuitenEuropa'
        ],
        'Oppervlakte': [
            'oppervlakteTotaalInHa',
            'oppervlakteLandInHa'
        ]
    };

    const labels = {
        'aantalInwoners': 'Inwoners',
        'aantalHuishoudens': 'Huishoudens',
        'omgevingsadressendichtheid': 'Omgevingsadressendichtheid',
        'stedelijkheidAdressenPerKm2': 'Stedelijkheid (adressen/km²)',
        'bevolkingsdichtheidInwonersPerKm2': 'Bevolkingsdichtheid (inw/km²)',
        'mannen': 'Mannen',
        'vrouwen': 'Vrouwen',
        'percentagePersonen0Tot15Jaar': '0-15 jaar (%)',
        'percentagePersonen15Tot25Jaar': '15-25 jaar (%)',
        'percentagePersonen25Tot45Jaar': '25-45 jaar (%)',
        'percentagePersonen45Tot65Jaar': '45-65 jaar (%)',
        'percentagePersonen65JaarEnOuder': '65+ jaar (%)',
        'percentageOngehuwd': 'Ongehuwd (%)',
        'percentageGehuwd': 'Gehuwd (%)',
        'percentageGescheid': 'Gescheiden (%)',
        'percentageVerweduwd': 'Verweduwd (%)',
        'percentageEenpersoonshuishoudens': 'Eenpersoonshuishoudens (%)',
        'percentageHuishoudensZonderKinderen': 'Huishoudens zonder kinderen (%)',
        'percentageHuishoudensMetKinderen': 'Huishoudens met kinderen (%)',
        'gemiddeldeHuishoudsgrootte': 'Gemiddelde huishoudgrootte',
        'percentageMetHerkomstlandNederland': 'Nederlands (%)',
        'percentageMetHerkomstlandUitEuropaExclNl': 'Europees (excl. NL) (%)',
        'percentageMetHerkomstlandBuitenEuropa': 'Buiten Europa (%)',
        'oppervlakteTotaalInHa': 'Totaal (ha)',
        'oppervlakteLandInHa': 'Land (ha)'
    };

    // Clear existing options
    statsSelect.innerHTML = '';

    // Add options by group
    for (const [groupName, stats] of Object.entries(groups)) {
        const group = document.createElement('optgroup');
        group.label = groupName;

        stats.forEach(stat => {
            // Check if this statistic exists in the data
            if (data.features[0].properties.hasOwnProperty(stat)) {
                const option = document.createElement('option');
                option.value = stat;
                option.textContent = labels[stat];
                group.appendChild(option);
            }
        });

        // Only add group if it has any options
        if (group.children.length > 0) {
            statsSelect.appendChild(group);
        }
    }
}

/**
 * Adds municipality layers to the map with dynamic coloring based on statistics.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing municipality features
 * @param {Object} municipalityPopulations - Population data for municipalities
 * @param {String} statisticKey - The statistic to use for coloring (e.g. 'aantalInwoners')
 */
export function addMapLayers(map, geoJsonData, municipalityPopulations, statisticKey = 'aantalInwoners') {
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

    // Populate statistics select with available data
    const statsSelect = document.getElementById('statsSelect');
    populateStatisticsSelect(statsSelect, geoJsonData);

    // Get a dynamic fill-color expression for this statisticKey
    const fillColorExpression = getDynamicFillColorExpression(geoJsonData, statisticKey);

    // Add GeoJSON geometry layers before symbol layers
    map.addLayer({
        'id': 'municipalities',
        'type': 'fill',
        'source': 'municipalities',
        'paint': {
            'fill-color': fillColorExpression,
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.8,
                0.6
            ],
            'fill-outline-color': '#00509e'
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

/**
 * Adds election reporting unit markers to the map.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} geoJsonData - GeoJSON data containing reporting unit locations
 * @param {Boolean} showElectionData - Whether election data should be displayed
 */
export function addReportingUnits(map, geoJsonData, showElectionData = false) {
    // Clean up existing reporting units first
    cleanupReportingUnits(map);

    if (!showElectionData || !geoJsonData || !geoJsonData.features || !geoJsonData.features.length) {
        return;
    }

    if (map.getSource('reporting-units')) {
        // Update the data of the existing source
        map.getSource('reporting-units').setData(geoJsonData);
    } else {
        // Add the reporting units source with original data
        map.addSource('reporting-units', {
            type: 'geojson',
            data: geoJsonData
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
}

/**
 * Removes all reporting unit layers and sources from the map.
 * Used when switching views or cleaning up old election data.
 * @param {Object} map - The Mapbox map instance
 */
export function cleanupReportingUnits(map) {
    // Check if map exists and is loaded
    if (!map || !map.loaded()) {
        return;
    }

    try {
        // Only remove layers if they exist
        if (map.getLayer('reporting-units')) {
            map.removeLayer('reporting-units');
        }
        if (map.getLayer('reporting-units-fill')) {
            map.removeLayer('reporting-units-fill');
        }
        if (map.getLayer('reporting-units-line')) {
            map.removeLayer('reporting-units-line');
        }
        if (map.getSource('reporting-units')) {
            map.removeSource('reporting-units');
        }
    } catch (error) {
        console.warn('Error cleaning up reporting units:', error);
    }
}

/**
 * Sets up the feature name box that displays municipality/neighborhood names and statistics.
 * Handles hover states and updates the display when moving between features.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} municipalityPopulations - Population data for municipalities
 */
export function setupFeatureNameBox(map, municipalityPopulations) {
    let hoveredFeatureId = null;
    let featureNameBox = document.querySelector('.feature-name-box');
    let featureNameContent = featureNameBox.querySelector('.feature-name-content');
    const statsSelect = document.getElementById('statsSelect');
    const electionToggle = document.getElementById('electionToggle');
    const settingsButton = featureNameBox.querySelector('.settings-button');

    // Setup settings button click handler
    settingsButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.settingsModal.open('Settings');
        
        // Re-attach event listeners to the cloned elements in the modal
        const modalStatsSelect = window.settingsModal.modal.querySelector('#statsSelect');
        const modalElectionToggle = window.settingsModal.modal.querySelector('#electionToggle');

        // Sync stats select
        if (modalStatsSelect) {
            modalStatsSelect.value = statsSelect.value;
            modalStatsSelect.addEventListener('change', () => {
                statsSelect.value = modalStatsSelect.value;
                localStorage.setItem('selectedStat', modalStatsSelect.value);
                updateFeatureNameBox();
                
                // Update the map colors for the new statistic
                updateMapColors(map, modalStatsSelect.value);
            });
        }

        // Sync election toggle
        if (modalElectionToggle) {
            modalElectionToggle.checked = electionToggle.checked;
            modalElectionToggle.addEventListener('change', () => {
                electionToggle.checked = modalElectionToggle.checked;
            });
        }
    });

    // Add event listener for statistic selection change
    statsSelect.addEventListener('change', () => {
        localStorage.setItem('selectedStat', statsSelect.value);
        updateFeatureNameBox();
        
        // Update the map colors for the new statistic
        updateMapColors(map, statsSelect.value);
    });

    // Restore last selected statistic
    const lastSelectedStat = localStorage.getItem('selectedStat');
    if (lastSelectedStat) {
        statsSelect.value = lastSelectedStat;
        // Update the map colors for the restored statistic
        updateMapColors(map, lastSelectedStat);
    }

    // Function to update map colors
    function updateMapColors(map, statisticKey) {
        if (map.getSource('municipalities')) {
            const source = map.getSource('municipalities');
            const data = source._data; // Get current GeoJSON data
            const fillColorExpression = getDynamicFillColorExpression(data, statisticKey);
            map.setPaintProperty('municipalities', 'fill-color', fillColorExpression);
        }
    }

    // Function to get the statistic text
    function getStatisticText(properties, statType) {
        const statValue = properties[statType];
        if (!statValue) return '';
        
        const labels = {
            'aantalInwoners': 'inwoners',
            'aantalHuishoudens': 'huishoudens',
            'omgevingsadressendichtheid': 'adressen/km²',
            'stedelijkheidAdressenPerKm2': 'adressen/km²',
            'bevolkingsdichtheidInwonersPerKm2': 'inw/km²',
            'mannen': 'mannen',
            'vrouwen': 'vrouwen',
            'percentagePersonen0Tot15Jaar': '% 0-15 jaar',
            'percentagePersonen15Tot25Jaar': '% 15-25 jaar',
            'percentagePersonen25Tot45Jaar': '% 25-45 jaar',
            'percentagePersonen45Tot65Jaar': '% 45-65 jaar',
            'percentagePersonen65JaarEnOuder': '% 65+ jaar',
            'percentageOngehuwd': '% ongehuwd',
            'percentageGehuwd': '% gehuwd',
            'percentageGescheid': '% gescheiden',
            'percentageVerweduwd': '% verweduwd',
            'percentageEenpersoonshuishoudens': '% eenpersoons',
            'percentageHuishoudensZonderKinderen': '% zonder kinderen',
            'percentageHuishoudensMetKinderen': '% met kinderen',
            'gemiddeldeHuishoudsgrootte': 'personen/huishouden',
            'percentageMetHerkomstlandNederland': '% NL',
            'percentageMetHerkomstlandUitEuropaExclNl': '% EU (excl. NL)',
            'percentageMetHerkomstlandBuitenEuropa': '% buiten EU',
            'oppervlakteTotaalInHa': 'ha totaal',
            'oppervlakteLandInHa': 'ha land'
        };
        
        const label = labels[statType] || statType;
        const formattedValue = typeof statValue === 'number' && statValue % 1 !== 0 
            ? statValue.toFixed(1) 
            : statValue;
        
        return `<span class="population-text">(${formattedValue.toLocaleString('nl-NL')} ${label})</span>`;
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
    }

    // Initial display of selected municipality
    const selectedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality')).naam 
        : null;
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
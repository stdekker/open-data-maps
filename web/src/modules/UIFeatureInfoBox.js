import { getDynamicFillColorExpression, updateMapColors } from './layerService.js';

let hoveredFeatureId = null;
let featureNameBox = document.querySelector('.feature-info-box');
let featureNameContent = featureNameBox.querySelector('.feature-name-content');
let municipalityPopulationsData = {};

// Unified statistics configuration
const STATISTICS_CONFIG = {
    groups: {
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
    },
    labels: {
        'aantalInwoners': { display: 'Inwoners', unit: 'inwoners' },
        'aantalHuishoudens': { display: 'Huishoudens', unit: 'huishoudens' },
        'omgevingsadressendichtheid': { display: 'Omgevingsadressendichtheid', unit: 'adressen/km²' },
        'stedelijkheidAdressenPerKm2': { display: 'Stedelijkheid (adressen/km²)', unit: 'adressen/km²' },
        'bevolkingsdichtheidInwonersPerKm2': { display: 'Bevolkingsdichtheid (inw/km²)', unit: 'inw/km²' },
        'mannen': { display: 'Mannen', unit: 'mannen' },
        'vrouwen': { display: 'Vrouwen', unit: 'vrouwen' },
        'percentagePersonen0Tot15Jaar': { display: '0-15 jaar (%)', unit: '% 0-15 jaar' },
        'percentagePersonen15Tot25Jaar': { display: '15-25 jaar (%)', unit: '% 15-25 jaar' },
        'percentagePersonen25Tot45Jaar': { display: '25-45 jaar (%)', unit: '% 25-45 jaar' },
        'percentagePersonen45Tot65Jaar': { display: '45-65 jaar (%)', unit: '% 45-65 jaar' },
        'percentagePersonen65JaarEnOuder': { display: '65+ jaar (%)', unit: '% 65+ jaar' },
        'percentageOngehuwd': { display: 'Ongehuwd (%)', unit: '% ongehuwd' },
        'percentageGehuwd': { display: 'Gehuwd (%)', unit: '% gehuwd' },
        'percentageGescheid': { display: 'Gescheiden (%)', unit: '% gescheiden' },
        'percentageVerweduwd': { display: 'Verweduwd (%)', unit: '% verweduwd' },
        'percentageEenpersoonshuishoudens': { display: 'Eenpersoonshuishoudens (%)', unit: '% eenpersoons' },
        'percentageHuishoudensZonderKinderen': { display: 'Huishoudens zonder kinderen (%)', unit: '% zonder kinderen' },
        'percentageHuishoudensMetKinderen': { display: 'Huishoudens met kinderen (%)', unit: '% met kinderen' },
        'gemiddeldeHuishoudsgrootte': { display: 'Gemiddelde huishoudgrootte', unit: 'personen/huishouden' },
        'percentageMetHerkomstlandNederland': { display: 'Nederlands (%)', unit: '% NL' },
        'percentageMetHerkomstlandUitEuropaExclNl': { display: 'Europees (excl. NL) (%)', unit: '% EU (excl. NL)' },
        'percentageMetHerkomstlandBuitenEuropa': { display: 'Buiten Europa (%)', unit: '% buiten EU' },
        'oppervlakteTotaalInHa': { display: 'Totaal (ha)', unit: 'ha totaal' },
        'oppervlakteLandInHa': { display: 'Land (ha)', unit: 'ha land' }
    }
};

/**
 * Populates the statistics select dropdown with grouped options
 * @param {HTMLSelectElement} statsSelect - The select element to populate
 * @param {Object} data - The GeoJSON data containing available properties
 */
export function populateStatisticsSelect(statsSelect, data) {
    // Clear existing options
    statsSelect.innerHTML = '';

    // Add options by group
    for (const [groupName, stats] of Object.entries(STATISTICS_CONFIG.groups)) {
        const group = document.createElement('optgroup');
        group.label = groupName;

        stats.forEach(stat => {
            // Check if this statistic exists in the data
            if (data.features[0].properties.hasOwnProperty(stat)) {
                const option = document.createElement('option');
                option.value = stat;
                option.textContent = STATISTICS_CONFIG.labels[stat].display;
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
 * Sets up the feature name box that displays municipality/neighborhood names and statistics.
 * Handles hover states and updates the display when moving between features.
 * @param {Object} map - The Mapbox map instance
 * @param {Object} municipalityPopulations - Population data for municipalities
 */
export function setupFeatureNameBox(map, municipalityPopulations) {
    // Store the municipalityPopulations data for use in updateFeatureNameBox
    municipalityPopulationsData = municipalityPopulations || window.municipalityPopulations;

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

    // Initial display of selected municipality
    const selectedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality')).naam 
        : null;
    if (selectedMunicipality) {
        updateFeatureNameBox();
    }

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

/**
 * Gets the formatted statistic text for a given property and statistic type
 * @param {Object} properties - The properties containing the statistic value
 * @param {String} statType - The type of statistic to format
 * @returns {String} Formatted statistic text
 */
function getStatisticText(properties, statType) {
    const statValue = properties[statType];
    if (statValue === undefined || statValue === null) return '';
    
    const label = STATISTICS_CONFIG.labels[statType]?.unit || statType;
    let formattedValue;

    if (typeof statValue === 'number') {
        if (statType.startsWith('percentage') || statType === 'gemiddeldeHuishoudsgrootte') {
            // Format percentages and average household size with 1 decimal place
            formattedValue = statValue.toLocaleString('nl-NL', { 
                minimumFractionDigits: 1,
                maximumFractionDigits: 1 
            });
        } else {
            // Format other numbers as integers
            formattedValue = statValue.toLocaleString('nl-NL', { 
                maximumFractionDigits: 0 
            });
        }
    } else {
        formattedValue = statValue;
    }
    
    return `<span class="statistic-text">(${formattedValue} ${label})</span>`;
}

/**
 * Updates the feature name box content with municipality and neighborhood information
 * @param {Object} feature - Optional feature object containing properties to display
 * @export
 */
export function updateFeatureNameBox(feature = null) {
    if (!featureNameContent || !featureNameBox) {
        console.error('Feature name content or box element is not initialized.');
        return;
    }

    const storedMunicipality = localStorage.getItem('lastMunicipality') 
        ? JSON.parse(localStorage.getItem('lastMunicipality'))
        : null;

    const statsSelect = document.getElementById('statsSelect');
    if (!statsSelect) {
        console.error('Stats select element not found.');
        return;
    }

    const selectedStat = statsSelect.value;

    const getNameWithStat = (name, properties) => {
        const statValue = properties[selectedStat];
        if (statValue === undefined || statValue === null) {
            return name;
        }
        return `${name} ${getStatisticText(properties, selectedStat)}`;
    };

    let content = '';
    if (storedMunicipality) {
        const municipalityData = municipalityPopulationsData[storedMunicipality.code];
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
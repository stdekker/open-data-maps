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
    // Don't add reporting units if election data is not being shown
    if (!showElectionData) {
        return;
    }

    // Clean up existing reporting units layers and sources first
    cleanupReportingUnits(map);

    // Add the reporting units source
    map.addSource('reporting-units', {
        type: 'geojson',
        data: geoJsonData
    });

    // Add reporting units layer on top (no second parameter means it goes on top)
    map.addLayer({
        'id': 'reporting-units',
        'type': 'circle',
        'source': 'reporting-units',
        'paint': {
            'circle-radius': 8,
            'circle-color': '#4CAF50',
            'circle-opacity': 0.6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        }
    });

    // Add click handler for reporting units
    map.on('click', 'reporting-units', (e) => {
        if (!e.features.length) return;

        const feature = e.features[0];
        const { name, cast, totalCounted, rejectedVotes, results } = feature.properties;

        // Create popup content
        let content = `
            <h3>${name}</h3>
            <div class="popup-content">
                <p><strong>Uitgebracht:</strong> ${cast.toLocaleString('nl-NL')}</p>
                <p><strong>Geteld:</strong> ${totalCounted.toLocaleString('nl-NL')}</p>
                ${rejectedVotes ? `<p><strong>Ongeldig:</strong> ${rejectedVotes.toLocaleString('nl-NL')}</p>` : ''}
                <p><strong>Partijen:</strong></p>
                <div class="popup-results">
        `;

        // Add all parties
        const allParties = JSON.parse(results);
        allParties.forEach(party => {
            const percentage = ((party.votes / totalCounted) * 100).toFixed(1);
            content += `
                <div class="popup-party">
                    <span class="popup-party-name">${party.party}</span>
                    <span class="popup-party-votes">${party.votes.toLocaleString('nl-NL')} (${percentage}%)</span>
                </div>
            `;
        });

        content += '</div></div>';

        // Remove existing popup if it exists
        if (window.reportingUnitsPopup) {
            window.reportingUnitsPopup.remove();
        }

        // Create new popup
        window.reportingUnitsPopup = new mapboxgl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(content)
            .addTo(map);
    });

    // Change cursor on hover
    map.on('mouseenter', 'reporting-units', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'reporting-units', () => {
        map.getCanvas().style.cursor = '';
    });
}

export function cleanupReportingUnits(map) {
    if (map.getLayer('reporting-units')) {
        map.off('click', 'reporting-units');
        map.off('mouseenter', 'reporting-units');
        map.off('mouseleave', 'reporting-units');
        map.removeLayer('reporting-units');
    }
    if (map.getSource('reporting-units')) {
        map.removeSource('reporting-units');
    }
    // Remove the popup if it exists
    if (window.reportingUnitsPopup) {
        window.reportingUnitsPopup.remove();
        window.reportingUnitsPopup = null;
    }
}

// Update feature name box event handlers
export function setupFeatureNameBox(map, municipalityPopulations) {
    let hoveredFeatureId = null;
    let featureNameBox = document.querySelector('.feature-name-box');

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
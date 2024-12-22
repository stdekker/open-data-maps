export async function ensurePopulationData(municipalityPopulations) {
    if (Object.keys(municipalityPopulations).length === 0) {
        try {
            const response = await fetch('data/gemeenten.json');
            const data = await response.json();
            data.features.forEach(feature => {
                municipalityPopulations[feature.properties.gemeentecode] = {
                    ...feature.properties
                };
            });
        } catch (error) {
            console.error('Error loading population data:', error);
        }
    }
}

export async function loadGeoJsonData(code) {
    try {
        const response = await fetch(`api/municipality.php?code=${code}`);
        return await response.json();
    } catch (error) {
        console.error('Error loading GeoJSON data:', error);
        throw error;
    }
}

export async function loadOverviewData() {
    try {
        const response = await fetch('data/overview.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading overview data:', error);
        throw error;
    }
} 
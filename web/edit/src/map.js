/**
 * Map Functionality Module
 * Handles all Mapbox map operations
 */

import { state } from './state.js';
import { escapeHtml } from './ui.js';

/**
 * Initialize the Mapbox map
 */
export function initializeMap() {
    mapboxgl.accessToken = window.EDIT_CONFIG.mapboxToken;
    
    state.map = new mapboxgl.Map({
        container: 'map',
        style: window.EDIT_CONFIG.mapStyle,
        center: [5.387, 52.156],
        zoom: 7
    });
    
    state.map.addControl(new mapboxgl.NavigationControl());
}

/**
 * Render all map markers for the current stembureaus
 */
export function renderMapMarkers(onMarkerDrag, onMarkerClick) {
    // Clear existing markers
    Object.values(state.markers).forEach(marker => marker.remove());
    state.markers = {};
    
    if (state.stembureaus.length === 0) return;
    
    // Get municipality center for default position
    const municipalityCenter = getMunicipalityCenter();
    
    state.stembureaus.forEach((stembureau, index) => {
        const hasLocation = stembureau.lat !== null && stembureau.lon !== null;
        const position = hasLocation 
            ? [stembureau.lon, stembureau.lat]
            : municipalityCenter;
        
        // Create marker element
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.backgroundColor = hasLocation ? '#667eea' : '#dc3545';
        el.style.cursor = 'grab';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        
        // Create marker
        const marker = new mapboxgl.Marker({
            element: el,
            draggable: true
        })
            .setLngLat(position)
            .setPopup(new mapboxgl.Popup().setHTML(`
                <div class="popup-content">
                    <h3>${escapeHtml(stembureau.identifier)}</h3>
                    <p><strong>Status:</strong> ${hasLocation ? 'Located' : 'Not located'}</p>
                    ${hasLocation ? `<p><strong>Coords:</strong> ${stembureau.lat.toFixed(6)}, ${stembureau.lon.toFixed(6)}</p>` : ''}
                    <p><strong>Cast:</strong> ${stembureau.cast}</p>
                </div>
            `))
            .addTo(state.map);
        
        // Handle drag end
        marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            onMarkerDrag(index, lngLat.lat, lngLat.lng);
        });
        
        // Handle click
        el.addEventListener('click', () => {
            onMarkerClick(index);
        });
        
        state.markers[index] = marker;
    });
    
    // Fit map to markers
    if (state.stembureaus.some(s => s.lat && s.lon)) {
        const bounds = new mapboxgl.LngLatBounds();
        state.stembureaus.forEach(s => {
            if (s.lat && s.lon) {
                bounds.extend([s.lon, s.lat]);
            }
        });
        state.map.fitBounds(bounds, { padding: 50 });
    }
}

/**
 * Update a single marker on the map
 */
export function updateMarker(index) {
    const marker = state.markers[index];
    if (!marker) return;
    
    const stembureau = state.stembureaus[index];
    const hasLocation = stembureau.lat !== null && stembureau.lon !== null;
    
    if (hasLocation) {
        marker.setLngLat([stembureau.lon, stembureau.lat]);
        marker.getElement().style.backgroundColor = '#667eea';
    } else {
        const center = getMunicipalityCenter();
        marker.setLngLat(center);
        marker.getElement().style.backgroundColor = '#dc3545';
    }
    
    // Update popup
    marker.setPopup(new mapboxgl.Popup().setHTML(`
        <div class="popup-content">
            <h3>${escapeHtml(stembureau.identifier)}</h3>
            <p><strong>Status:</strong> ${hasLocation ? 'Located' : 'Not located'}</p>
            ${hasLocation ? `<p><strong>Coords:</strong> ${stembureau.lat.toFixed(6)}, ${stembureau.lon.toFixed(6)}</p>` : ''}
            <p><strong>Cast:</strong> ${stembureau.cast}</p>
        </div>
    `));
}

/**
 * Get the center point of the current municipality
 */
export function getMunicipalityCenter() {
    const municipality = state.municipalities.find(m => m.code === state.currentMunicipality);
    if (municipality && municipality.geometry) {
        // Calculate centroid of first polygon
        const coords = municipality.geometry.type === 'Polygon' 
            ? municipality.geometry.coordinates[0]
            : municipality.geometry.coordinates[0][0];
        
        let sumX = 0, sumY = 0;
        coords.forEach(([x, y]) => {
            sumX += x;
            sumY += y;
        });
        
        return [sumX / coords.length, sumY / coords.length];
    }
    
    return [5.387, 52.156]; // Default center of Netherlands
}

/**
 * Show or hide the municipality boundary on the map
 */
export function showMunicipalityBoundary(checked) {
    // Remove existing boundary
    if (state.map.getLayer('municipality-boundary')) {
        state.map.removeLayer('municipality-boundary');
    }
    if (state.map.getSource('municipality-boundary')) {
        state.map.removeSource('municipality-boundary');
    }
    
    if (!checked) return;
    
    const municipality = state.municipalities.find(m => m.code === state.currentMunicipality);
    if (!municipality || !municipality.geometry) return;
    
    state.map.addSource('municipality-boundary', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: municipality.geometry
        }
    });
    
    state.map.addLayer({
        id: 'municipality-boundary',
        type: 'line',
        source: 'municipality-boundary',
        paint: {
            'line-color': '#667eea',
            'line-width': 2,
            'line-opacity': 0.8
        }
    });
}

/**
 * Fly to a specific location on the map
 */
export function flyToLocation(lat, lon, zoom = 16) {
    state.map.flyTo({
        center: [lon, lat],
        zoom: zoom
    });
}

/**
 * Highlight a marker temporarily
 */
export function highlightMarker(index) {
    const marker = state.markers[index];
    if (marker) {
        marker.getElement().style.transform += ' scale(1.2)';
        setTimeout(() => {
            marker.getElement().style.transform = marker.getElement().style.transform.replace(' scale(1.2)', '');
        }, 1000);
    }
}


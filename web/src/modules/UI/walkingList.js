/**
 * Walking List UI Module - Displays walking lists of streets with house number ranges
 * for selected buurt/wijk features.
 */

import { Modal } from '../services/modalService.js';
import { generateWalkingList } from '../services/walkingListService.js';

let walkingListModal = null;
let startPointMarker = null;
let currentWalkingListData = null; // Store data for download functions

/**
 * Initializes the walking list modal
 */
export function initializeWalkingListModal() {
    walkingListModal = new Modal('walking-list-modal');
    
    // Clear marker when modal closes (via close button, overlay click, or Escape)
    if (walkingListModal.closeButton) {
        walkingListModal.closeButton.addEventListener('click', clearStartPointMarker);
    }
    if (walkingListModal.overlay) {
        walkingListModal.overlay.addEventListener('click', (e) => {
            if (e.target === walkingListModal.overlay) {
                clearStartPointMarker();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && walkingListModal.isOpen()) {
            clearStartPointMarker();
        }
    });
}

function clearStartPointMarker() {
    if (startPointMarker) {
        startPointMarker.remove();
        startPointMarker = null;
    }
}

function promptStartPoint() {
    return `
        <div class="walking-list-startpoint">
            <p><strong>Klik op de kaart</strong> om een startpunt te kiezen voor de loopvolgorde.</p>
            <div class="walking-list-actions">
                <button type="button" class="walking-list-cancel">Annuleren</button>
            </div>
        </div>
    `;
}

function waitForStartPointClick(map) {
    return new Promise((resolve, reject) => {
        const canvas = map.getCanvas();
        const prevCursor = canvas.style.cursor;
        canvas.style.cursor = 'crosshair';

        const onClose = () => {
            cleanup();
            reject(new Error('cancelled'));
        };

        const onOverlayClick = (e) => {
            if (e.target === walkingListModal?.overlay) {
                onClose();
            }
        };

        const cleanup = () => {
            map.off('click', onMapClick);
            canvas.style.cursor = prevCursor;
            const cancelBtn = walkingListModal?.overlay?.querySelector('.walking-list-cancel');
            if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
            if (walkingListModal?.closeButton) walkingListModal.closeButton.removeEventListener('click', onClose);
            if (walkingListModal?.overlay) walkingListModal.overlay.removeEventListener('click', onOverlayClick);
        };

        const onCancel = () => {
            cleanup();
            reject(new Error('cancelled'));
        };

        const onMapClick = (e) => {
            cleanup();
            const coord = [e.lngLat.lng, e.lngLat.lat];

            clearStartPointMarker();
            if (window.mapboxgl && typeof window.mapboxgl.Marker === 'function') {
                startPointMarker = new window.mapboxgl.Marker({ color: '#111111' })
                    .setLngLat(coord)
                    .addTo(map);
            }

            resolve(coord);
        };

        map.on('click', onMapClick);
        if (walkingListModal?.closeButton) walkingListModal.closeButton.addEventListener('click', onClose);
        if (walkingListModal?.overlay) walkingListModal.overlay.addEventListener('click', onOverlayClick);

        // Wire cancel button once modal content is in DOM
        const cancelBtn = walkingListModal?.overlay?.querySelector('.walking-list-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
    });
}

/**
 * Formats the walking list data as HTML
 * @param {Object} walkingListData - The walking list data from generateWalkingList
 * @returns {string} HTML string
 */
function formatWalkingListHTML(walkingListData) {
    const { featureName, streets, totalAddresses } = walkingListData;
    
    if (streets.length === 0) {
        return `
            <div class="walking-list-empty">
                <p>Geen adressen gevonden in dit gebied.</p>
                <p class="walking-list-hint">Zorg ervoor dat de BAG laag is ingeschakeld en geladen.</p>
            </div>
        `;
    }
    
    let html = `
        <div class="walking-list-header">
            <p class="walking-list-summary">
                <strong>${streets.length}</strong> ${streets.length === 1 ? 'straat' : 'straten'} 
                met <strong>${totalAddresses}</strong> ${totalAddresses === 1 ? 'adres' : 'adressen'}
            </p>
        </div>
        <div class="walking-list-content">
            <ul class="walking-list-streets">
    `;
    
    streets.forEach(street => {
        html += `
            <li class="walking-list-street">
                <span class="street-name">${escapeHtml(street.name)}</span>
                <span class="street-ranges">${escapeHtml(street.ranges)}</span>
                <span class="street-count">(${street.count} ${street.count === 1 ? 'adres' : 'adressen'})</span>
            </li>
        `;
    });
    
    html += `
            </ul>
        </div>
        <div class="walking-list-footer">
            <button type="button" class="walking-list-download-btn" id="download-pdf-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                PDF
            </button>
            <button type="button" class="walking-list-download-btn" id="download-csv-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                CSV
            </button>
        </div>
    `;
    
    return html;
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Generates and downloads a CSV file from the walking list data
 */
function downloadCSV() {
    if (!currentWalkingListData || !currentWalkingListData.streets.length) return;
    
    const { featureName, streets, totalAddresses } = currentWalkingListData;
    
    // CSV header
    let csv = 'Straat,Huisnummers,Aantal adressen\n';
    
    // Add each street
    streets.forEach(street => {
        // Escape fields that might contain commas or quotes
        const name = `"${street.name.replace(/"/g, '""')}"`;
        const ranges = `"${street.ranges.replace(/"/g, '""')}"`;
        csv += `${name},${ranges},${street.count}\n`;
    });
    
    // Add total row
    csv += `\n"Totaal",,${totalAddresses}\n`;
    
    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `looplijst-${featureName.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Opens print dialog for PDF-style output
 */
function downloadPDF() {
    if (!currentWalkingListData || !currentWalkingListData.streets.length) return;
    
    const { featureName, streets, totalAddresses } = currentWalkingListData;
    
    // Create a print-friendly HTML document
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Looplijst: ${escapeHtml(featureName)}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { font-size: 18px; margin-bottom: 5px; }
                .summary { color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
                th { background-color: #f5f5f5; font-weight: 600; }
                .count { text-align: right; }
                .total { font-weight: bold; border-top: 2px solid #333; }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <h1>Looplijst: ${escapeHtml(featureName)}</h1>
            <p class="summary">${streets.length} ${streets.length === 1 ? 'straat' : 'straten'} met ${totalAddresses} ${totalAddresses === 1 ? 'adres' : 'adressen'}</p>
            <table>
                <thead>
                    <tr>
                        <th>Straat</th>
                        <th>Huisnummers</th>
                        <th class="count">Adressen</th>
                    </tr>
                </thead>
                <tbody>
                    ${streets.map(street => `
                        <tr>
                            <td>${escapeHtml(street.name)}</td>
                            <td>${escapeHtml(street.ranges)}</td>
                            <td class="count">${street.count}</td>
                        </tr>
                    `).join('')}
                    <tr class="total">
                        <td colspan="2">Totaal</td>
                        <td class="count">${totalAddresses}</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        // Slight delay to ensure content is loaded
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
}

/**
 * Attaches download button event listeners
 */
function attachDownloadListeners() {
    const pdfBtn = walkingListModal?.overlay?.querySelector('#download-pdf-btn');
    const csvBtn = walkingListModal?.overlay?.querySelector('#download-csv-btn');
    
    if (pdfBtn) {
        pdfBtn.addEventListener('click', downloadPDF);
    }
    if (csvBtn) {
        csvBtn.addEventListener('click', downloadCSV);
    }
}

/**
 * Shows the walking list modal for a given feature
 * @param {Object} map - The Mapbox map instance
 * @param {Object} feature - The buurt/wijk feature
 * @param {Object} [options] - Optional parameters
 * @param {[number, number]} [options.startPoint] - [lng, lat] start point for ordering
 */
export async function showWalkingListModal(map, feature, options = {}) {
    if (!walkingListModal) {
        initializeWalkingListModal();
    }

    try {
        clearStartPointMarker();
        const { startPoint } = options;

        // Show optional visual marker if a startPoint is provided (from selected BAG feature)
        if (startPoint && window.mapboxgl && typeof window.mapboxgl.Marker === 'function') {
            startPointMarker = new window.mapboxgl.Marker({ color: '#111111' })
                .setLngLat(startPoint)
                .addTo(map);
        }

        // Show loading state
        walkingListModal.open('Looplijst genereren...', '<div class="walking-list-loading"><p>Bezig met genereren van looplijst...</p></div>');

        // Generate list - if no startPoint, streets will be sorted alphabetically
        const walkingListData = await generateWalkingList(map, feature, { startPoint });
        
        // Store data for download functions
        currentWalkingListData = walkingListData;
        
        const title = `Looplijst: ${walkingListData.featureName}`;
        const content = formatWalkingListHTML(walkingListData);
        
        walkingListModal.open(title, content);
        
        // Attach download button listeners after content is in DOM
        attachDownloadListeners();
    } catch (error) {
        if (error?.message === 'cancelled') {
            clearStartPointMarker();
            walkingListModal.close();
            return;
        }

        console.error('Error generating walking list:', error);
        
        let errorMessage = '<div class="walking-list-error">';
        if (error.message.includes('BAG layer is not loaded')) {
            errorMessage += '<p><strong>BAG laag niet geladen</strong></p>';
            errorMessage += '<p>Schakel eerst de "Verblijfsobjecten (BAG)" laag in en wacht tot de data geladen is.</p>';
        } else if (error.message.includes('No BAG data available')) {
            errorMessage += '<p><strong>Geen BAG data beschikbaar</strong></p>';
            errorMessage += '<p>Wacht tot de BAG data geladen is en probeer het opnieuw.</p>';
        } else {
            errorMessage += '<p><strong>Fout bij genereren van looplijst</strong></p>';
            errorMessage += `<p>${escapeHtml(error.message)}</p>`;
        }
        errorMessage += '</div>';
        
        walkingListModal.open('Fout', errorMessage);
    }
}

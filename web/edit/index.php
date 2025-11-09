<?php
/**
 * Stembureau Location Editor
 * Main Interface
 */

require_once __DIR__ . '/../../config/edit-config.php';
require_once __DIR__ . '/auth.php';

// Require authentication
requireAuth();

// Generate CSRF token
$csrfToken = generateCsrfToken();

// Get username for display
$username = $_SESSION['username'] ?? 'User';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stembureau Location Editor</title>
    
    <!-- Mapbox GL -->
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css" rel="stylesheet">
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js"></script>
    
    <!-- Main CSS -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css">
    <link rel="stylesheet" href="style/edit.css">
</head>
<body>
    <div class="header">
        <div class="header-left">
            <h1>Stembureau Location Editor</h1>
        </div>
        <div class="header-right">
            <span class="user-info">👤 <?php echo htmlspecialchars($username); ?></span>
            <a href="logout.php" class="logout-btn">Logout</a>
        </div>
    </div>
    
    <div class="toolbar">
        <div class="toolbar-section">
            <label for="electionSelect">Election:</label>
            <select id="electionSelect">
                <option value="">Select election...</option>
            </select>
        </div>
        
        <div class="toolbar-section">
            <label for="municipalitySelect">Municipality:</label>
            <select id="municipalitySelect" disabled>
                <option value="">Select municipality...</option>
            </select>
        </div>
        
        <div class="toolbar-section">
            <button id="loadBtn" class="primary-btn" disabled>Load Data</button>
        </div>
        
        <div class="toolbar-section stats">
            <span id="statsText">No data loaded</span>
        </div>
    </div>
    
    <div class="main-container">
        <div class="list-panel">
            <div class="panel-header">
                <h2>Stembureaus</h2>
                <div class="panel-actions">
                    <input type="text" id="searchInput" placeholder="Search..." class="search-input">
                    <button id="matchLocationsBtn" class="match-btn" disabled>📍 Match from Election</button>
                    <button id="saveAllBtn" class="save-all-btn" disabled>Save All Changes</button>
                </div>
            </div>
            <div class="list-content" id="listContent">
                <div class="empty-state">
                    <p>👈 Select an election and municipality to begin</p>
                </div>
            </div>
        </div>
        
        <div class="map-panel">
            <div class="panel-header">
                <h2>Map View</h2>
                <div class="panel-actions">
                    <label class="checkbox-label">
                        <input type="checkbox" id="showMunicipalityBoundary" checked>
                        Show boundary
                    </label>
                </div>
            </div>
            <div id="map"></div>
        </div>
    </div>
    
    <!-- Toast notifications -->
    <div id="toast-container"></div>
    
    <!-- Edit Modal -->
    <div id="editModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit Location</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Stembureau:</strong> <span id="modalStembureaName"></span></p>
                <div class="form-group">
                    <label for="modalLat">Latitude:</label>
                    <input type="number" id="modalLat" step="0.000001" min="50" max="54" placeholder="e.g. 52.156">
                </div>
                <div class="form-group">
                    <label for="modalLon">Longitude:</label>
                    <input type="number" id="modalLon" step="0.000001" min="3" max="8" placeholder="e.g. 5.387">
                </div>
                <div class="modal-actions">
                    <button id="modalSaveBtn" class="primary-btn">Save</button>
                    <button id="modalCancelBtn" class="secondary-btn">Cancel</button>
                    <button id="modalRemoveBtn" class="danger-btn">Remove Location</button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Match Locations Modal -->
    <div id="matchModal" class="modal">
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>Match Locations from Another Election</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <p>Find and copy stembureau locations from a previous election using name matching.</p>
                
                <div class="form-group">
                    <label for="matchSourceElection">Source Election:</label>
                    <select id="matchSourceElection">
                        <option value="">Select election...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="matchThreshold">Match Quality Threshold:</label>
                    <select id="matchThreshold">
                        <option value="90">High (90%+ similarity)</option>
                        <option value="80" selected>Medium (80%+ similarity)</option>
                        <option value="70">Low (70%+ similarity)</option>
                    </select>
                </div>
                
                <div class="modal-actions">
                    <button id="matchFindBtn" class="primary-btn">Find Matches</button>
                    <button id="matchCancelBtn" class="secondary-btn">Cancel</button>
                </div>
                
                <div id="matchResults" style="display: none;">
                    <hr style="margin: 20px 0;">
                    <h4>Match Results</h4>
                    <div id="matchResultsContent"></div>
                    <div class="modal-actions" style="margin-top: 20px;">
                        <button id="matchApplyBtn" class="primary-btn">Apply Selected Matches</button>
                        <button id="matchSelectAllBtn" class="secondary-btn">Select All</button>
                        <button id="matchDeselectAllBtn" class="secondary-btn">Deselect All</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Pass config to JavaScript -->
    <script>
        window.EDIT_CONFIG = {
            csrfToken: <?php echo json_encode($csrfToken); ?>,
            mapboxToken: 'pk.eyJ1Ijoic2Rla2tlciIsImEiOiJjaXF4cjI1ZTAwMDRxaHVubmgwOHJjajJ1In0.w7ja8Yc35uk3yXCd7wXFhg',
            mapStyle: 'mapbox://styles/mapbox/streets-v12'
        };
    </script>
    <script type="module" src="src/main.js"></script>
</body>
</html>


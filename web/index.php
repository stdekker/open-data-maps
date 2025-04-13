<?php
    $version = "1.1"; // Version number for cache busting
    
    // Load production scripts if config exists
    $PROD_SCRIPTS = [
        'head' => [],
        'body' => []
    ];
    @include __DIR__ . '/config.prod.php';
?>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Open Data Maps</title>
        <link rel="icon" type="image/svg+xml" href="favicon.svg">
        <?php foreach ($PROD_SCRIPTS['head'] as $script) echo $script . "\n"; ?>
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css" rel="stylesheet">
        <script src="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.4.2/chroma.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css">
        <link rel="stylesheet" href="style/main.css?v=<?php echo $version; ?>">
    </head>
    <body>
        <div class="container">
            <div id="map" tabindex="0" aria-label="Map"></div>
            <div class="feature-info-box">
                <div class="feature-name-content"></div>
                <button class="settings-button" aria-label="Settings">⋮</button>
            </div>
            <div class="sidebar">
                <header><h1><sup title="Open Data">OD</sup>Maps</h1></header>
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="Zoek een gemeente..." aria-label="Zoek een gemeente">
                    <div id="autocompleteList" class="autocomplete-items"></div>
                    <div class="search-error">Geen gemeente gevonden</div>
                </div>
                <div class="menu">
                    <ul class="menu-items" role="menubar">
                        <li id="national-view" role="menuitem" tabindex="0">
                            <span>Landelijk</span>
                        </li>
                        <li id="municipal-view" role="menuitem" tabindex="0">
                            <span>Gemeente</span>
                        </li>
                    </ul>
                </div>
                <div class="layer-toggles">
                <div id="postcode-progress" class="progress-message"></div>
                    <div class="layer-toggle-item" id="municipalityToggle" data-layer="municipality" role="button" tabindex="0" aria-pressed="false">
                        <span class="toggle-dot"></span>
                        <span class="toggle-text">
                            <span id="buurtToggle" class="region-type active" data-type="buurten">Buurten</span>
                            <span class="region-separator">/</span>
                            <span id="wijkToggle" class="region-type" data-type="wijken">Wijken</span>
                        </span>
                    </div>
                    <div class="layer-toggle-item" id="postcode6Toggle" data-layer="postcode" role="button" tabindex="0" aria-pressed="false">
                        <span class="toggle-dot"></span>
                        <span class="toggle-text">Postcodes</span>
                    </div>
                    <div id="postcode-stats-selector" class="stats-selector" style="display: none;">
                        <label for="postcodeStatsSelect" class="visually-hidden">Statistiek</label>
                        <select id="postcodeStatsSelect">
                            <!-- Options will be populated dynamically -->
                        </select>
                    </div>
                    <div class="layer-toggle-item" id="electionToggle" data-layer="election" role="button" tabindex="0" aria-pressed="false">
                        <span class="toggle-dot"></span>
                        <span class="toggle-text">Verkiezingen</span>
                    </div>
                </div>
                <div class="stats-view"></div>
            </div>
        </div>
        <button class="help-button" aria-label="Help">?</button>
        <div class="modal-overlay" id="settings-modal">
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">Settings</h2>
                    <button class="modal-close" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-content">
                    <div class="settings-section">
                        <h3>Statistics</h3>
                        <div class="stats-selector">
                            <label for="statsSelect">Statistiek</label>
                            <select id="statsSelect">
                                <!-- Options will be populated dynamically -->
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-overlay" id="help-modal">
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">Help</h2>
                    <button class="modal-close" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-content">
                    <!-- Help content will be loaded here -->
                </div>
            </div>
        </div>
        <div class="modal-overlay" id="postcode-stats-modal">
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title"></h2>
                    <button class="modal-close" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-content"></div>
            </div>
        </div>
        <script type="module" src="src/main.js?v=<?php echo $version; ?>"></script>
        <?php foreach ($PROD_SCRIPTS['body'] as $script) echo $script . "\n"; ?>
    </body>
</html>
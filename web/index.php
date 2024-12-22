<?php
    $version = "1.0.1"; // Version number for cache busting
?>
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Open Data Maps</title>
        <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.4.2/chroma.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css">
        <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
        <link rel="stylesheet" href="style/main.css?v=<?php echo $version; ?>">
    </head>
    <body>
        <div class="container">
            <div class="feature-name-box">
                <div class="feature-name-content"></div>
                <button class="settings-button" aria-label="Settings">⋮</button>
            </div>
            <div id="map" tabindex="0" aria-label="Map"></div>
            <div class="sidebar">
                <header><h1>Maps<sup title="Open Data">OD</sup></h1></header>
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="Zoek een gemeente..." aria-label="Zoek een gemeente">
                    <div id="autocompleteList" class="autocomplete-items"></div>
                    <div class="search-error">Geen gemeente gevonden</div>
                </div>
                <ul class="menu-items" role="tablist">
                    <li role="tab" id="municipal-view" tabindex="0" aria-selected="false">Gemeente</li>
                    <li role="tab" id="national-view" tabindex="0" aria-selected="false">Nederland</li>
                </ul>
                <div class="stats-view"></div>
            </div>
        </div>
        <button class="help-button" aria-label="Help">?</button>
        <div class="modal-overlay">
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
                                <option value="aantalInwoners">Inwoners</option>
                                <option value="aantalHuishoudens">Huishoudens</option>
                            </select>
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Layers</h3>
                        <div class="toggle-container">
                            <label class="toggle-switch">
                                <input type="checkbox" id="electionToggle" tabindex="0" aria-label="Toggle Verkiezingen">
                                <span class="toggle-slider"></span>
                                <span class="toggle-label">Verkiezingen</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <script type="module" src="src/main.js?v=<?php echo $version; ?>"></script>
    </body>
</html>
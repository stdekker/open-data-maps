<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Maps</title>
        <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
        <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js"></script>
        <link rel="stylesheet" href="style/main.css">
    </head>
    <body>
        <div class="container">
            <div id="map"></div>
            <div class="sidebar">
                <header><h1>Maps<sup>II</sup></h1></header>
                <div class="search-container autocomplete-container">
                    <input type="text" id="searchInput" placeholder="Search gemeente...">
                    <div id="autocompleteList" class="autocomplete-items"></div>
                    <div class="search-error">No matching municipality found</div>
                </div>
                <ul class="menu-items" role="tablist">
                    <li role="tab" tabindex="0" aria-selected="false" id="municipality-view">Gemeente</li>
                    <li role="tab" tabindex="0" aria-selected="false" id="national-view">Landelijk</li>
                </ul>

                <div class="stats-view"></div>
            </div>
        </div>
        <script src="main.js"></script>
    </body>
</html>
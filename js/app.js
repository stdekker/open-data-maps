// Start in Amsterdam
var map = L.map('map').setView([52.3676, 4.9041], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 12,
}).addTo(map);

// Attach event listener to parent element using event delegation
let selector = document.getElementById('city');
let cityLocations = {};

fetch('data/cities.json')
  .then((response) => response.json())
  .then((data) => {
    // Create a new object mapping city names to lat/lng values
    data.forEach((city) => {
      cityLocations[city.city] = {
        lat: city.lat,
        lng: city.lng,
      };
    });

    // Add the city Names to the select input
    for (cityName in cityLocations) {
      const option = document.createElement('option');
      option.value = cityName;
      option.text = cityName;
      selector.appendChild(option);
    }
    selector.value = 'Amsterdam';

    // Select a Municipality via the dropdown
    selector.addEventListener('change', function () {
      var value = this.value;
      var options = document.querySelectorAll('#city option');
      for (var i = 0; i < options.length; i++) {
        var option = options[i];
        if (option.value === value) {
          var cityData = cityLocations[value];
          // Change view to Lat Long
          map.setView([cityData.lat, cityData.lng], 13);
          // Fetch gemeentegrenzen GeoJSON-bestand
          fetch('data/amsterdam.json')
            .then((response) => response.json())
            .then((data) => {
              // Wis de bestaande gemeentegrenzen op de kaart
              geojsonLayer.clearLayers();
              // Voeg de nieuwe gemeentegrenzen toe aan de kaart
              geojsonLayer.addData(data).addTo(map);
            });
          break;
        }
      }
    });
  });

var geojsonLayer = L.geoJSON(null, {
  style: function (feature) {
    return {
      fillColor: 'gray',
      fillOpacity: 0.2,
      weight: 1,
      color: 'black',
    };
  },
});

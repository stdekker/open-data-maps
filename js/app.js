// Initialize the map
var map = L.map('map').setView([52.3676, 4.9041], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 14,
}).addTo(map);

// Load the GeoJSON file
fetch('data/geo/gemeenten_2022_v1.json')
  .then((response) => response.json())
  .then((data) => {
    dataMapActions(data);
  })
  .catch((error) => {
    console.error('Error fetching municipality data:', error);
  });

// actions on the Map
function dataMapActions(data) {
  // Create a Leaflet layer from the GeoJSON data
  const municipalityLayer = L.geoJSON(data, {
    style: function (feature) {
      const color = getColor(feature.properties.aantalInwoners);
      return {
        fillColor: color,
        fillOpacity: 0.5,
        color: 'black',
        weight: 0.2,
      };
    },
    // Filter out polygons with water: ja
    filter: function (feature, layer) {
      return feature.properties.water !== 'JA';
    },
    // Add event listeners for mouseover and mouseout
    onEachFeature: function (feature, layer) {
      layer.on({
        mouseover: function (e) {
          if (!layer.selected) {
            layer.setStyle({
              fillColor: 'blue',
            });
          }
        },
        mouseout: function (e) {
          if (!layer.selected) {
            municipalityLayer.resetStyle(layer);
          }
        },
        click: function (e) {
          layer.selected = !layer.selected;
          if (layer.selected) {
            layer.setStyle({
              fillColor: 'white',
            });
          } else {
            municipalityLayer.resetStyle(layer);
          }
          calculateTotalData(municipalityLayer);
        },
      });
    },
  });

  // Add the layer to the map
  municipalityLayer.addTo(map);
  calculateTotalData(municipalityLayer);

  // Add the "Clear Selection" button to the HTML <div>
  const clearButton = document.getElementById('dataClear');

  clearButton.addEventListener('click', function () {
    // Deselect all selected layers
    municipalityLayer.getLayers().forEach(function (layer) {
      if (layer.selected) {
        layer.selected = false;
        municipalityLayer.resetStyle(layer);
        calculateTotalData(municipalityLayer);
      }
    });
  });
}

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
          map.setView([cityData.lat, cityData.lng], 9);
          if (value === 'Amsterdam') {
            // Fetch gemeentegrenzen GeoJSON-bestand
            fetch('data/amsterdam.json')
              .then((response) => response.json())
              .then((data) => {
                // Wis de bestaande gemeentegrenzen op de kaart
                wijkLayer.clearLayers();
                // Voeg de nieuwe gemeentegrenzen toe aan de kaart
                wijkLayer.addData(data).addTo(map);
              });
          }
          break;
        }
      }
    });
  });

var wijkLayer = L.geoJSON(null, {
  style: function (feature) {
    return {
      weight: 1,
      color: 'black',
    };
  },
});

// Support functions
function getColor(number, min = 0, max = 250000) {
  const colorScale = chroma
    .scale([
      '#ffffe0',
      '#ffe6b3',
      '#ffce93',
      '#ffb57e',
      '#ff9d70',
      '#fb8567',
      '#f16c5f',
      '#e45457',
      '#d43b4c',
      '#c0233c',
      '#a80c25',
      '#8b0000',
    ])
    .domain([min, max]);
  return colorScale(number);
}

function calculateTotalData(layer) {
  // Calculate total aantalInwoners for selected municipalities
  var selectedFeatures = layer.getLayers().filter(function (l) {
    return l.selected;
  });
  var totalAantalInwoners = selectedFeatures.reduce(function (acc, cur) {
    return acc + cur.feature.properties.aantalInwoners;
  }, 0);
  document.getElementById('dataView').innerHTML =
    'Inwoners: ' + totalAantalInwoners.toLocaleString('nl-NL');
}

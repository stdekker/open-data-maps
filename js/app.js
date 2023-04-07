// Initialize the map
var map = L.map('map').setView([52.3676, 4.9041], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 14,
}).addTo(map);

// Load the GeoJSON file
fetch('data/geo/gemeenten.json')
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
          // Calculate total aantalInwoners for selected municipalities
          var selectedFeatures = municipalityLayer
            .getLayers()
            .filter(function (l) {
              return l.selected;
            });
          var totalAantalInwoners = selectedFeatures.reduce(function (
            acc,
            cur
          ) {
            return acc + cur.feature.properties.aantalInwoners;
          },
          0);
          console.log('Inwoners:', totalAantalInwoners);
        },
      });
    },
  });

  // Add the layer to the map
  municipalityLayer.addTo(map);
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

// Support functions
function getColor(number, min = 0, max = 150000) {
  const colorScale = chroma.scale(['yellow', 'red']).domain([min, max]);
  return colorScale(number);
}

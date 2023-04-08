// Initialize the map
var map = L.map('map').setView([52.3676, 4.9041], 8);
var municipalityLayer;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 14,
}).addTo(map);

// Load the GeoJSON file
fetch('data/geo/gemeenten_2022_v1.json')
  .then((response) => response.json())
  .then((data) => {
    // Draw the map part of the interface
    dataMapActions(data);
    sidebarActions(data);
  })
  .catch((error) => {
    console.error('Error fetching municipality data:', error);
  });

// Actions to perform on the Map when data is loaded
function dataMapActions(data) {
  // Create a Leaflet layer from the GeoJSON data
  municipalityLayer = L.geoJSON(data, {
    style: function (feature) {
      var color = getColor(feature.properties.aantalInwoners);
      return {
        fillColor: color,
        fillOpacity: 0.75,
        color: chroma(color).darken().hex(),
        weight: 0.5,
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
              fillColor: 'yellow',
              color: chroma('yellow').darken().hex(),
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
}

// Add a listener to "Clear Selection" button
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

// Attach event listener to parent element using event delegation

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

    selector.value = 'Amsterdam';
  });

var wijkLayer = L.geoJSON(null, {
  style: function (feature) {
    return {
      weight: 1,
      color: 'black',
    };
  },
});

function sidebarActions(data) {
  let selector = document.getElementById('city');
  let cityLocations = {};

  // Extract the values of the options into an array of strings
  let optionValues = data.features
    .filter(feature => feature.properties.water !== 'JA')
    .map(feature => feature.properties.gemeentenaam)
    .sort();

  // Create the options elements based on the sorted array
  optionValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.text = value;
    selector.appendChild(option);
  });

  // Select a Municipality via the dropdown
  selector.addEventListener('change', function () {
    var value = this.value;
    console.log(value);
    // Iterate through each municipality layer
    municipalityLayer.eachLayer(function (layer) {
      if (layer.feature.properties.gemeentenaam === value) {
        // If the layer matches the selected city and water is not "JA", select it and update its style
        layer.selected = true;
        layer.setStyle({
          color: chroma('red').darken().hex(),
        });
        // Zoom in on the selected layer
        map.fitBounds(layer.getBounds());
      } else {
        layer.selected = false;
        municipalityLayer.resetStyle(layer);
      }
    });
    calculateTotalData(municipalityLayer);
  });
}

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

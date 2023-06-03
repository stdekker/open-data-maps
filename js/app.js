// Constants
const MAX_ZOOM = 14;
const INITIAL_VIEW = [52.3676, 4.9041];
const ZOOM_LEVEL = 8;
const GEOJSON_MCP = 'data/geo/gemeenten_2022_v1.json';
const MAP_TILESET = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SELECT_FILL = {
  fillColor: 'yellow',
  color: chroma('yellow').darken().hex(),
};

// Initialize the app state
let selectLayers = true;

// Initialize the map
const map = L.map('map').setView(INITIAL_VIEW, ZOOM_LEVEL);
let municipalityLayer;

// Draw the Open Street Map Layer
L.tileLayer(MAP_TILESET, {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: MAX_ZOOM,
}).addTo(map);

// Load the GeoJSON file
fetch(GEOJSON_MCP)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    dataMapActions(data);
    sidebarActions(data);
  })
  .catch((error) => {
    console.error('Error fetching municipality data:', error);
  });

// Function to create and style the GeoJSON layer
function createMunicipalityLayer(data) {
  return L.geoJSON(data, {
    style: function (feature) {
      var color = getColor(feature.properties.aantalInwoners);
      return {
        fillColor: color,
        fillOpacity: 0.75,
        color: chroma(color).darken().hex(),
        weight: 0.5,
      };
    },
    filter: function (feature, layer) {
      return feature.properties.water !== 'JA';
    },
    onEachFeature: function (feature, layer) {
      addLayerEventListeners(layer);
    },
  });
}

// Function to add event listeners to the layer
function addLayerEventListeners(layer) {
  layer.on({
    mouseover: function (e) {
      if (!layer.selected && selectLayers) {
        layer.setStyle({ fillColor: 'white' });
      }
    },
    mouseout: function (e) {
      if (!layer.selected && selectLayers) {
        municipalityLayer.resetStyle(layer);
      }
    },
    click: function (e) {
      if (!selectLayers) {
        return;
      }

      // If the control key is not pressed, deselect all other layers
      if (!e.originalEvent.ctrlKey) {
        municipalityLayer.eachLayer(function (otherLayer) {
          if (otherLayer !== layer) {
            otherLayer.selected = false;
            municipalityLayer.resetStyle(otherLayer);
          }
        });
      }

      layer.selected = !layer.selected;
      if (layer.selected) {
        layer.setStyle(SELECT_FILL);

        // Select the same municipality in the dropdown
        var dropdown = document.getElementById('city');
        dropdown.value = layer.feature.properties.gemeentenaam;
      } else {
        municipalityLayer.resetStyle(layer);
      }
      calculateTotalData(municipalityLayer);
    },
  });
}

// Modified dataMapActions function
function dataMapActions(data) {
  municipalityLayer = createMunicipalityLayer(data);
  municipalityLayer.addTo(map);
  calculateTotalData(municipalityLayer);
}

// Add a listener to "Clear Selection" button
const clearButton = document.getElementById('clearSelection');
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

function sidebarActions(data) {
  let selector = document.getElementById('city');
  let cityLocations = {};

  // Extract the values of the options into an array of strings
  let optionValues = data.features
    .filter((feature) => feature.properties.water !== 'JA')
    .map((feature) => feature.properties.gemeentenaam)
    .sort();

  // Create the options elements based on the sorted array
  optionValues.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.text = value;
    selector.appendChild(option);
  });

  // Select a Municipality via the dropdown
  selector.addEventListener('change', function () {
    var value = this.value;
    // Iterate through each municipality layer
    municipalityLayer.eachLayer(function (layer) {
      if (layer.feature.properties.gemeentenaam === value) {
        // If the layer matches the selected city and water is not "JA", select it and update its style
        layer.selected = true;
        layer.setStyle(SELECT_FILL);
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

// Show data modal button click event
const showDataModalButton = document.getElementById('showDataModal');

showDataModalButton.addEventListener('click', function () {
  const modal = document.getElementById('dataModal');
  const modalDataView = document.getElementById('modalDataView');

  var selectedFeatures = municipalityLayer.getLayers().filter(function (l) {
    return l.selected;
  });

  // Check if there is any data
  if (selectedFeatures.length === 0) {
    return; // No data, so just return and don't show the modal
  }

  // Assuming all features have the same properties, take the first one to generate header
  var featureProperties = Object.keys(selectedFeatures[0].feature.properties);

  // Start of the table
  var tableHTML = '<table>';

  // Create a row for each property
  featureProperties.forEach((property) => {
    tableHTML += `<tr><th>${property}</th>`;
    selectedFeatures.forEach((feature) => {
      tableHTML += `<td>${feature.feature.properties[property]}</td>`;
    });
    tableHTML += '</tr>';
  });

  // End of the table
  tableHTML += '</table>';

  // Update the modalDataView with the table
  modalDataView.innerHTML = tableHTML;

  modal.style.display = 'block'; // Show the modal
});


// Define a variable to keep track of whether the pointer toggle is enabled
var addPointers = false;
document.getElementById('add-pointers').addEventListener('click', function () {
  // Toggle the addPointers variable
  addPointers = !addPointers;
  // Add or remove a 'selected' class from the clicked li element
  if (addPointers) {
    this.classList.add('selected');
    selectLayers = false;
  } else {
    this.classList.remove('selected');
    selectLayers = true;
  }
});

// Define a variable to hold the pointer layer
var pointerLayer = L.layerGroup().addTo(map);

// Add a click listener to the map
map.on('click', function (event) {
  // If the pointer toggle is enabled, add a pointer to the clicked location
  if (addPointers) {
    var pointer = L.marker(event.latlng);
    pointer.addTo(pointerLayer);
  }
});

// Add a click listener to the clearPointers button
document.getElementById('clearPointers').addEventListener('click', function () {
  // Remove all markers from the pointer layer
  pointerLayer.clearLayers();
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
  var selectedFeatures = layer.getLayers().filter(function (l) {
    return l.selected;
  });
  var totalAantalInwoners = selectedFeatures.reduce(function (acc, cur) {
    return acc + cur.feature.properties.aantalInwoners;
  }, 0);

  var selectedMunicipalities = selectedFeatures.map(function (layer) {
    return layer.feature.properties.gemeentenaam;
  });

  selectedMunicipalities.sort(); // Sort the selected municipalities alphabetically

  var dataView = document.getElementById('dataView');
  dataView.innerHTML =
    'Inwoners: ' + totalAantalInwoners.toLocaleString('nl-NL');

  if (selectedMunicipalities.length > 0) {
    var municipalityList = selectedMunicipalities.join(', ');
    dataView.innerHTML += '<br>In: ' + municipalityList;
  }
}

// Close the modal when the user clicks on the close button (x)
const closeModalButton = document.querySelector('.close');
closeModalButton.addEventListener('click', function () {
  const modal = document.getElementById('dataModal');
  modal.style.display = 'none'; // Hide the modal
});

// Close the modal when the user clicks anywhere outside of it
window.addEventListener('click', function (event) {
  const modal = document.getElementById('dataModal');
  if (event.target == modal) {
    modal.style.display = 'none'; // Hide the modal
  }
});

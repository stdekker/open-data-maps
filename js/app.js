var input = document.getElementById('autocomplete-input');
var options = document.querySelectorAll('#cities option');

// Start in amsterdam
var map = L.map('map').setView([52.3676, 4.9041], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 12,
}).addTo(map);

// Get all possible municipalities
var cityLocations = {};
var datalist = document.querySelector('#cities');

fetch('data/cities.json')
  .then((response) => response.json())
  .then((data) => {
    data.forEach((city) => {
      cityLocations[city.city.toLowerCase()] = {
        lat: city.lat,
        lng: city.lng,
      };
    });
  });

console.log(datalist);

// Attach event listener to parent element using event delegation
var input = document.getElementById('autocomplete-input');
input.addEventListener('input', function () {
  var value = this.value.toLowerCase();
  var options = document.querySelectorAll('#cities option');
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionValue = option.value.toLowerCase();
    if (optionValue.indexOf(value) !== -1) {
      option.style.display = 'block';
    } else {
      option.style.display = 'none';
    }
  }
});

input.addEventListener('change', function () {
  var value = this.value.toLowerCase();
  var options = document.querySelectorAll('#cities option');
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionValue = option.value.toLowerCase();
    if (optionValue === value) {
      var cityData = cityLocations[value];
      map.setView([cityData.lat, cityData.lng], 13);
      break;
    }
  }
});

// Start in amsterdam
var map = L.map('map').setView([52.3676, 4.9041], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 12,
}).addTo(map);

fetch('data/cities.json')
  .then((response) => response.json())
  .then((data) => {
    // Create a new object mapping city names to lat/lng values
    const cityLocations = {};
    data.forEach((city) => {
      cityLocations[city.city] = {
        lat: city.lat,
        lng: city.lng,
      };
    });

    // Use the cityLocations object here, e.g.
    var select = document.getElementById('city');
    for (const cityName in cityLocations) {
      const option = document.createElement('option');
      option.value = cityName;
      option.text = cityName;
      select.appendChild(option);
    }
    // Attach event listener to parent element using event delegation
    var input = document.getElementById('city');

    input.addEventListener('change', function () {
      var value = this.value;
      var options = document.querySelectorAll('#city option');
      for (var i = 0; i < options.length; i++) {
        var option = options[i];
        var optionValue = option.value;
        if (optionValue === value) {
          var cityData = cityLocations[value];
          map.setView([cityData.lat, cityData.lng], 13);
          break;
        }
      }
    });
  });

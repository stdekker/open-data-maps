var input = document.getElementById("autocomplete-input");
var options = document.querySelectorAll("#cities option");

var map = L.map("map").setView([52.3676, 4.9041], 13);

// Cache the options
var optionsCache = Array.from(options).map(function(option) {
  return {
    option: option,
    value: option.value.toLowerCase()
  };
});

// Attach event listener to parent element using event delegation
var input = document.getElementById("autocomplete-input");
input.addEventListener("input", function() {
  var value = this.value.toLowerCase();
  var options = document.querySelectorAll("#cities option");
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionValue = option.value.toLowerCase();
    if (optionValue.indexOf(value) !== -1) {
      option.style.display = "block";
    } else {
      option.style.display = "none";
    }
  }
});

input.addEventListener("change", function() {
  var value = this.value.toLowerCase();
  var options = document.querySelectorAll("#cities option");
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

var cityLocations = {};

fetch("data/cities.json")
  .then(response => response.json())
  .then(data => {
    data.forEach(city => {
      cityLocations[city.city.toLowerCase()] = {
        lat: city.lat,
        lng: city.lng
      };
    });
  })
  .then(() => {
    var map = L.map("map").setView([52.3676, 4.9041], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
  });

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 18,
}).addTo(map);

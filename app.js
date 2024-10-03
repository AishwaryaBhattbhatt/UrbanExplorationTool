var map;
var HEXAGON_DIAMETER_METERS = 100;
var hexGrid;
var revealedHexagons = new Set();
var userMarker;
var watchId;
var exploring = false;

function initMap() {
    updateStatus("Initializing map...");
    try {
        map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 0, lng: 0 },
            zoom: 18,
            disableDefaultUI: true,
            zoomControl: true,
            styles: [
                {
                    featureType: "poi",
                    stylers: [{ visibility: "off" }]
                },
                {
                    featureType: "transit",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        updateStatus("Map object created. Setting up hex grid...");

        hexGrid = new google.maps.OverlayView();
        hexGrid.onAdd = function() {
            updateStatus("Hex grid onAdd called.");
            var svg = d3.select(this.getPanes().overlayMouseTarget).append("svg")
                .attr("id", "hexSvg")
                .style("position", "absolute");
            this.svg = svg;
        };

        hexGrid.draw = function() {
            updateStatus("Drawing hex grid...");
            if (!this.svg) {
                updateStatus("Error: SVG not initialized");
                return;
            }
            this.svg.selectAll("*").remove();
            var overlayProjection = this.getProjection();
            var bounds = map.getBounds();
            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();
            var topLeft = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(ne.lat(), sw.lng()));
            var bottomRight = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(sw.lat(), ne.lng()));

            var width = bottomRight.x - topLeft.x;
            var height = bottomRight.y - topLeft.y;

            this.svg.style("left", topLeft.x + "px")
                .style("top", topLeft.y + "px")
                .style("width", width + "px")
                .style("height", height + "px");

            var center = map.getCenter();
            var pixelsPerMeter = this.getPixelsPerMeter(center.lat());
            var hexRadius = (HEXAGON_DIAMETER_METERS / 2) * pixelsPerMeter;

            var hexbin = d3.hexbin()
                .radius(hexRadius)
                .extent([[0, 0], [width, height]]);

            var points = [];
            for (var x = 0; x < width; x += hexRadius * Math.sqrt(3)) {
                for (var y = 0; y < height; y += hexRadius * 3) {
                    points.push([x, y]);
                    points.push([x + hexRadius * Math.sqrt(3) / 2, y + hexRadius * 1.5]);
                }
            }

            var hexagons = this.svg.selectAll("path")
                .data(hexbin(points))
                .enter().append("path")
                .attr("d", function(d) { return "M" + d.x + "," + d.y + hexbin.hexagon(); })
                .attr("class", "hexagon")
                .attr("id", function(d, i) { return "hex-" + i; });

            revealedHexagons.forEach(function(id) {
                this.svg.select("#" + id).classed("revealed", true);
            }.bind(this));

            updateStatus("Hex grid drawn.");
        };

        hexGrid.getPixelsPerMeter = function(latitude) {
            return this.getProjection().getWorldWidth() / (40075016.686 * Math.cos(latitude * Math.PI / 180));
        };

        hexGrid.setMap(map);

        google.maps.event.addListenerOnce(map, 'idle', function() {
            updateStatus("Map idle. Requesting geolocation...");
            requestGeolocation();
        });

        google.maps.event.addListener(map, 'bounds_changed', function() {
            updateStatus("Bounds changed. Redrawing hex grid...");
            hexGrid.draw();
        });

        document.getElementById('startExploring').addEventListener('click', startExploring);
        document.getElementById('refreshExploring').addEventListener('click', refreshExploring);

    } catch (error) {
        updateStatus("Error initializing map: " + error.message);
        console.error("Map initialization error:", error);
    }
}

function requestGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                updateStatus("Geolocation received. Centering map...");
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;
                var latLng = new google.maps.LatLng(latitude, longitude);
                map.setCenter(latLng);
                placeUserMarker(latLng);
                hexGrid.draw();
            },
            function(error) {
                updateStatus("Geolocation error: " + error.message);
                hexGrid.draw();
            }
        );
    } else {
        updateStatus("Geolocation not supported by this browser.");
        hexGrid.draw();
    }
}

function placeUserMarker(latLng) {
    if (userMarker) {
        userMarker.setPosition(latLng);
    } else {
        userMarker = new google.maps.Marker({
            position: latLng,
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
            },
            title: "Your Location"
        });
    }
}

function startExploring() {
    if (!exploring) {
        exploring = true;
        updateStatus("Started exploring. Current and new locations will reveal hexagons.");
        // Reveal the hexagon at the current location
        if (userMarker) {
            revealHexagonAtPosition(userMarker.getPosition());
        }
        watchId = navigator.geolocation.watchPosition(updateUserPosition, handleLocationError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        });
        document.getElementById('startExploring').textContent = 'Stop Exploring';
    } else {
        stopExploring();
    }
}

function stopExploring() {
    exploring = false;
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    updateStatus("Stopped exploring.");
    document.getElementById('startExploring').textContent = 'Start Exploring';
}

function refreshExploring() {
    stopExploring();
    revealedHexagons.clear();
    hexGrid.draw();
    updateStatus("Exploration refreshed. All hexagons hidden.");
}

function updateUserPosition(position) {
    var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    placeUserMarker(latLng);
    map.panTo(latLng);
    if (exploring) {
        revealHexagonAtPosition(latLng);
    }
}

function revealHexagonAtPosition(latLng) {
    if (!hexGrid.getProjection()) return;  // Exit if projection is not ready
    var pixel = hexGrid.getProjection().fromLatLngToContainerPixel(latLng);
    var hexagon = document.elementFromPoint(pixel.x, pixel.y);
    if (hexagon && hexagon.id && hexagon.id.startsWith("hex-")) {
        hexagon.classList.add("revealed");
        revealedHexagons.add(hexagon.id);
        updateStatus("Revealed hexagon: " + hexagon.id);
    }
}

function handleLocationError(error) {
    updateStatus("Error updating location: " + error.message);
    stopExploring();
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

console.log("app.js loaded and parsed");
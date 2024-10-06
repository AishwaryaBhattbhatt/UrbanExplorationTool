var map;
var HEXAGON_DIAMETER_METERS = 100;
var hexGrid;
var revealedHexagons = new Set();
var lastKnownPosition = null;
var POSITION_CHANGE_THRESHOLD = 0.001; // Threshold for significant change in geolocation

function initMap() {
    updateStatus("Initializing map...");
    try {
        map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 0, lng: 0 },
            zoom: 15,
            disableDefaultUI: true,
            gestureHandling: 'none',
            zoomControl: false,
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

            // Reveal hexagons that are already revealed
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

        let debounceTimer;
        google.maps.event.addListener(map, 'bounds_changed', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                updateStatus("Bounds changed. Redrawing hex grid...");
                hexGrid.draw();
            }, 200); // Adjust debounce time as needed
        });

    } catch (error) {
        updateStatus("Error initializing map: " + error.message);
        console.error("Map initialization error:", error);
    }
}

function requestGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;

                if (lastKnownPosition) {
                    var latDiff = Math.abs(lastKnownPosition.latitude - latitude);
                    var lngDiff = Math.abs(lastKnownPosition.longitude - longitude);
                    if (latDiff < POSITION_CHANGE_THRESHOLD && lngDiff < POSITION_CHANGE_THRESHOLD) {
                        updateStatus("Geolocation has not changed significantly. Skipping update.");
                        return;
                    }
                }

                lastKnownPosition = { latitude: latitude, longitude: longitude };

                updateStatus("Geolocation received. Centering map...");
                map.setCenter({ lat: latitude, lng: longitude });
                map.setZoom(15);
                revealHexagonsAroundPosition(latitude, longitude);
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

function revealHexagonsAroundPosition(lat, lng) {
    var overlayProjection = hexGrid.getProjection();
    var userPosition = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
    var revealRadius = 150; // Adjust radius as needed

    hexGrid.svg.selectAll(".hexagon").each(function(d) {
        var hexX = d.x;
        var hexY = d.y;
        var distanceSquared = Math.pow(hexX - userPosition.x, 2) + Math.pow(hexY - userPosition.y, 2);
        if (distanceSquared <= Math.pow(revealRadius, 2)) {
            var hexId = d3.select(this).attr("id");
            d3.select(this).classed("revealed", true);
            revealedHexagons.add(hexId);
        }
    });

    updateStatus("Hexagons revealed around user's position.");
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

// Add this line to check if the script is loaded
console.log("app.js loaded and parsed");
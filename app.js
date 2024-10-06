var map;
var HEXAGON_DIAMETER_METERS = 100; // 100 meters for the diameter
var hexGrid;
var revealedHexagons = new Set();
var userMarker;
var watchId;
var exploring = false;
var baseZoom = 18;

function initMap() {
    try {
        updateStatus("Initializing map...");
        var mapDiv = document.getElementById("map");
        if (!mapDiv) {
            throw new Error("Map container not found");
        }

        map = new google.maps.Map(mapDiv, {
            center: { lat: 0, lng: 0 },
            zoom: baseZoom,
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

        updateStatus("Map object created successfully.");
        setupHexGrid();
        requestGeolocation();

    } catch (error) {
        updateStatus("Error initializing map: " + error.message);
        console.error("Map initialization error:", error);
    }
}

function setupHexGrid() {
    try {
        updateStatus("Setting up hex grid...");
        hexGrid = new google.maps.OverlayView();

        hexGrid.onAdd = function() {
            updateStatus("Hex grid onAdd called.");
            var layer = this.getPanes().overlayLayer;
            var svg = d3.select(layer).append("svg")
                .attr("id", "hexSvg")
                .style("position", "absolute");
            this.svg = svg;
        };

        hexGrid.draw = function() {
            try {
                updateStatus("Drawing hex grid...");
                if (!this.svg) {
                    updateStatus("Error: SVG not initialized");
                    return;
                }

                // Clear the SVG contents to prevent duplicates
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

                var hexbin = d3.hexbin().radius(hexRadius);

                var points = [];
                for (var lng = sw.lng(); lng <= ne.lng(); lng += (HEXAGON_DIAMETER_METERS / 1000) * 1.5) {
                    for (var lat = sw.lat(); lat <= ne.lat(); lat += (HEXAGON_DIAMETER_METERS / 1000) * Math.sqrt(3)) {
                        points.push([lng, lat]);
                    }
                }

                var hexagons = this.svg.selectAll("path")
                    .data(hexbin(points))
                    .enter().append("path")
                    .attr("d", function(d) {
                        var point = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(d[1], d[0]));
                        return "M" + point.x + "," + point.y + hexbin.hexagon();
                    })
                    .attr("class", "hexagon")
                    .attr("id", function(d, i) { return "hex-" + i; })
                    .style("fill", "rgba(128, 128, 128, 0.9)")
                    .style("stroke", "#4d4d4d")
                    .style("stroke-width", "1px");

                // Reapply revealed class to previously visited hexagons
                revealedHexagons.forEach(function(id) {
                    this.svg.select("#" + id).classed("revealed", true);
                }.bind(this));

                updateStatus("Hex grid drawn.");
            } catch (error) {
                updateStatus("Error drawing hex grid: " + error.message);
                console.error("Hex grid drawing error:", error);
            }
        };

        hexGrid.getPixelsPerMeter = function(latitude) {
            return this.getProjection().getWorldWidth() / (40075016.686 * Math.cos(latitude * Math.PI / 180));
        };

        hexGrid.setMap(map);

        google.maps.event.addListener(map, 'bounds_changed', function() {
            updateStatus("Bounds changed. Redrawing hex grid...");
            hexGrid.draw();
        });

    } catch (error) {
        updateStatus("Error setting up hex grid: " + error.message);
        console.error("Error setting up hex grid:", error);
    }
}

function requestGeolocation() {
    try {
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
                    console.error("Geolocation error:", error);
                    hexGrid.draw();
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        } else {
            updateStatus("Geolocation not supported by this browser.");
            hexGrid.draw();
        }
    } catch (error) {
        updateStatus("Error during geolocation request: " + error.message);
        console.error("Geolocation request error:", error);
    }
}

function placeUserMarker(latLng) {
    try {
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
        updateStatus("User marker placed at: " + latLng.lat() + ", " + latLng.lng());
    } catch (error) {
        updateStatus("Error placing user marker: " + error.message);
        console.error("Error placing user marker:", error);
    }
}

function updateStatus(message) {
    console.log(message);
    var statusElement = document.getElementById("status");
    if (statusElement) {
        statusElement.textContent = "Status: " + message;
    } else {
        console.warn("Status element not found in the DOM");
    }
}

window.onerror = function(message, source, lineno, colno, error) {
    updateStatus("JavaScript error: " + message);
    console.error("JavaScript error:", message, source, lineno, colno, error);
};

window.initMap = initMap;

var map;
var HEXAGON_DIAMETER_METERS = 100; // 100 meters for the diameter
var hexGrid;
var revealedHexagons = new Set();
var userMarker;
var watchId;
var exploring = false;
var baseZoom = 18;

function initMap() {
    updateStatus("Initializing map...");
    try {
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

            // Clear old hexagons (only on first draw)
            this.svg.selectAll("*").remove();

            var overlayProjection = this.getProjection();
            var bounds = map.getBounds();
            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();

            var pixelsPerMeter = this.getPixelsPerMeter(map.getCenter().lat());
            var hexRadius = (HEXAGON_DIAMETER_METERS / 2) * pixelsPerMeter;

            var hexbin = d3.hexbin()
                .radius(hexRadius);

            var points = [];
            // Loop to generate points in lat/lng space within the map bounds
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
                .attr("id", function(d, i) { return "hex-" + i; });

            // Reapply revealed class to previously visited hexagons
            revealedHexagons.forEach(function(id) {
                this.svg.select("#" + id).classed("revealed", true);
            }.bind(this));

            updateStatus("Hex grid drawn. Total hexagons: " + hexagons.size());
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

        var startExploringBtn = document.getElementById('startExploring');
        var refreshExploringBtn = document.getElementById('refreshExploring');

        if (startExploringBtn) {
            startExploringBtn.addEventListener('click', startExploring);
        } else {
            updateStatus("Error: Start Exploring button not found");
        }

        if (refreshExploringBtn) {
            refreshExploringBtn.addEventListener('click', refreshExploring);
        } else {
            updateStatus("Error: Refresh Exploring button not found");
        }

        updateStatus("Map initialization complete.");
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
    updateStatus("User marker placed at: " + latLng.lat() + ", " + latLng.lng());
}

function startExploring() {
    console.log("startExploring called. Current exploring state:", exploring);
    
    if (!exploring) {
        exploring = true;
        console.log("Exploration started");
        updateStatus("Started exploring. Current and new locations will reveal hexagons.");
        
        if (userMarker) {
            console.log("User marker exists, revealing initial hexagon");
            revealHexagonAtPosition(userMarker.getPosition());
        } else {
            console.log("User marker not set");
            updateStatus("Warning: User marker not set. Unable to reveal initial hexagon.");
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
    console.log("updateUserPosition called with:", position.coords.latitude, position.coords.longitude);
    
    var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    placeUserMarker(latLng);
    map.panTo(latLng);
    
    if (exploring) {
        console.log("Exploring is true, calling revealHexagonAtPosition");
        revealHexagonAtPosition(latLng);
    } else {
        console.log("Exploring is false, not revealing hexagon");
    }
    
    updateStatus("User position updated: " + latLng.lat() + ", " + latLng.lng());
}

function revealHexagonAtPosition(latLng) {
    console.log("revealHexagonAtPosition called with:", latLng.lat(), latLng.lng());

    if (!hexGrid || !hexGrid.getProjection()) {
        console.error("Error: Hex grid or projection not ready");
        return;
    }

    var pixel = hexGrid.getProjection().fromLatLngToDivPixel(latLng);
    console.log("Pixel coordinates:", pixel.x, pixel.y);

    var svgPoint = hexGrid.svg.node().createSVGPoint();
    svgPoint.x = pixel.x;
    svgPoint.y = pixel.y;

    var hexagons = hexGrid.svg.selectAll('.hexagon');
    console.log("Total hexagons:", hexagons.size());

    var revealedHexagon = null;

    hexagons.each(function(d, i) {
        var hexPath = d3.select(this);
        var pathData = hexPath.attr('d');
        var points = pathData.split(/[ML]/).slice(1).map(p => p.split(',').map(parseFloat));
        
        if (d3.polygonContains(points, [svgPoint.x, svgPoint.y])) {
            revealedHexagon = this;
            console.log("Found containing hexagon:", this.id);
            return false; // Exit the loop early
        }
    });

    if (revealedHexagon) {
        d3.select(revealedHexagon).classed("revealed", true);
        revealedHexagons.add(revealedHexagon.id);
        console.log("Revealed hexagon:", revealedHexagon.id);
        updateStatus("Revealed hexagon: " + revealedHexagon.id);
    } else {
        console.log("No hexagon found at position");
        updateStatus("No hexagon found at position: " + latLng.lat() + ", " + latLng.lng());
    }
}

function handleLocationError(error) {
    updateStatus("Error updating location: " + error.message);
    stopExploring();
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

var map;
var SQUARE_SIZE_METERS = 100; // 100 meters for the square side
var squareGrid;
var revealedSquares = new Set();
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

        updateStatus("Map object created. Setting up square grid...");

        squareGrid = new google.maps.OverlayView();
        squareGrid.onAdd = function() {
            updateStatus("Square grid onAdd called.");
            var svg = d3.select(this.getPanes().overlayMouseTarget).append("svg")
                .attr("id", "squareSvg")
                .style("position", "absolute")
                .attr("preserveAspectRatio", "xMidYMid meet");
            this.svg = svg;
        };

        squareGrid.draw = function() {
            updateStatus("Drawing square grid...");
            if (!this.svg) {
                updateStatus("Error: SVG not initialized");
                return;
            }

            this.svg.selectAll("*").remove(); // Clear the existing grid

            var overlayProjection = this.getProjection();
            var bounds = map.getBounds();
            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();

            var center = map.getCenter();
            var pixelsPerMeter = this.getPixelsPerMeter(center.lat());

            // Define the size of each square in terms of meters
            var squareSize = SQUARE_SIZE_METERS * pixelsPerMeter;

            // Loop through the area within map bounds and place squares
            var points = [];
            for (var x = sw.lng(); x <= ne.lng(); x += SQUARE_SIZE_METERS / 1000) {
                for (var y = sw.lat(); y <= ne.lat(); y += SQUARE_SIZE_METERS / 1000) {
                    points.push([x, y]);
                }
            }

            var squares = this.svg.selectAll("rect")
                .data(points)
                .enter().append("rect")
                .attr("x", function(d) {
                    return overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(d[1], d[0])).x;
                })
                .attr("y", function(d) {
                    return overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(d[1], d[0])).y;
                })
                .attr("width", squareSize)
                .attr("height", squareSize)
                .attr("class", "square")
                .attr("id", function(d, i) { return "square-" + i; });

            revealedSquares.forEach(function(id) {
                this.svg.select("#" + id).classed("revealed", true);
            }.bind(this));

            updateStatus("Square grid drawn. Total squares: " + squares.size());
        };

        squareGrid.getPixelsPerMeter = function(latitude) {
            return this.getProjection().getWorldWidth() / (40075016.686 * Math.cos(latitude * Math.PI / 180));
        };

        squareGrid.setMap(map);

        google.maps.event.addListenerOnce(map, 'idle', function() {
            updateStatus("Map idle. Requesting geolocation...");
            requestGeolocation();
        });

        google.maps.event.addListener(map, 'bounds_changed', function() {
            updateStatus("Bounds changed. Redrawing square grid...");
            squareGrid.draw();
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
                squareGrid.draw();
            },
            function(error) {
                updateStatus("Geolocation error: " + error.message);
                squareGrid.draw();
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        updateStatus("Geolocation not supported by this browser.");
        squareGrid.draw();
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
    if (!exploring) {
        exploring = true;
        updateStatus("Started exploring. Current and new locations will reveal squares.");
        if (userMarker) {
            revealSquareAtPosition(userMarker.getPosition());
        } else {
            updateStatus("Warning: User marker not set. Unable to reveal initial square.");
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
    revealedSquares.clear();
    squareGrid.draw();
    updateStatus("Exploration refreshed. All squares hidden.");
}

function updateUserPosition(position) {
    var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    placeUserMarker(latLng);
    map.panTo(latLng);
    if (exploring) {
        revealSquareAtPosition(latLng);
    }
    updateStatus("User position updated: " + latLng.lat() + ", " + latLng.lng());
}

function revealSquareAtPosition(latLng) {
    if (!squareGrid.getProjection()) {
        updateStatus("Error: Square grid projection not ready");
        return;
    }
    var pixel = squareGrid.getProjection().fromLatLngToContainerPixel(latLng);
    var square = document.elementFromPoint(pixel.x, pixel.y);
    if (square && square.id && square.id.startsWith("square-")) {
        square.classList.add("revealed");
        revealedSquares.add(square.id);
        updateStatus("Revealed square: " + square.id);
    } else {
        updateStatus("No square found at position: " + latLng.lat() + ", " + latLng.lng());
    }
}

function handleLocationError(error) {
    updateStatus("Error updating location: " + error.message);
    stopExploring();
}

function updateStatus(message) {
    console.log(message);
    var statusElement = document

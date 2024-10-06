var map;
var HEXAGON_DIAMETER_METERS = 100;
var hexGrid;
var revealedHexagons = new Set();
var lastKnownPosition = null;
var POSITION_CHANGE_THRESHOLD = 0.001; // Threshold for significant change in geolocation
var startExploringButton;
var userLocationMarker = null; // Marker for showing user location

function initMap() {
    updateStatus("Initializing map...");
    try {
        // Default to user's current location if available
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                lastKnownPosition = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                initializeMap(lastKnownPosition);
            }, function(error) {
                console.error("Geolocation error:", error);
                // Fallback to San Francisco if geolocation fails
                initializeMap({ latitude: 37.7749, longitude: -122.4194 });
            });
        } else {
            // Fallback if geolocation is not supported
            initializeMap({ latitude: 37.7749, longitude: -122.4194 });
        }
    } catch (error) {
        updateStatus("Error initializing map: " + error.message);
        console.error("Map initialization error:", error);
    }
}

function initializeMap(centerPosition) {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: centerPosition.latitude, lng: centerPosition.longitude },
        zoom: 15,
        disableDefaultUI: false, // Enable UI for better user interaction
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

    console.debug("Map initialized with center:", map.getCenter());
    updateStatus("Map object created. Setting up hex grid...");

    hexGrid = new google.maps.OverlayView();
    hexGrid.onAdd = function() {
        updateStatus("Hex grid onAdd called.");
        console.debug("Adding hex grid SVG to overlay.");
        var svg = d3.select(this.getPanes().overlayMouseTarget).append("svg")
            .attr("id", "hexSvg")
            .style("position", "absolute");
        this.svg = svg;
    };

    hexGrid.draw = function() {
        updateStatus("Drawing hex grid...");
        if (!this.svg) {
            updateStatus("Error: SVG not initialized");
            console.error("Hex grid SVG is not initialized.");
            return;
        }
        this.svg.selectAll("*").remove();
        var overlayProjection = this.getProjection();
        var bounds = map.getBounds();
        console.debug("Map bounds:", bounds);
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

        console.debug("Hex grid dimensions: width =", width, ", height =", height, ", hexRadius =", hexRadius);

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

        console.debug("Generated hexagon points:", points);

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
        var pixelsPerMeter = this.getProjection().getWorldWidth() / (40075016.686 * Math.cos(latitude * Math.PI / 180));
        console.debug("Pixels per meter at latitude", latitude, ":", pixelsPerMeter);
        return pixelsPerMeter;
    };

    hexGrid.setMap(map);

    // Add Start Exploring Button
    startExploringButton = document.createElement("button");
    startExploringButton.textContent = "Start Exploring";
    startExploringButton.style.position = "fixed";
    startExploringButton.style.bottom = "20px";
    startExploringButton.style.left = "20px";
    startExploringButton.style.zIndex = 1000;
    startExploringButton.style.padding = "10px";
    startExploringButton.style.backgroundColor = "#007bff";
    startExploringButton.style.color = "white";
    startExploringButton.style.border = "none";
    startExploringButton.style.borderRadius = "5px";
    startExploringButton.style.cursor = "pointer";
    document.body.appendChild(startExploringButton);
    startExploringButton.addEventListener("click", function() {
        updateStatus("Start exploring clicked. Requesting geolocation...");
        console.debug("Start exploring button clicked.");
        requestGeolocation();
    });

    google.maps.event.addListenerOnce(map, 'idle', function() {
        updateStatus("Map idle. Ready to explore.");
        console.debug("Map is idle and ready to explore.");
    });

    let debounceTimer;
    google.maps.event.addListener(map, 'bounds_changed', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            updateStatus("Bounds changed. Redrawing hex grid...");
            console.debug("Map bounds changed. Redrawing hex grid.");
            hexGrid.draw();
        }, 200); // Adjust debounce time as needed
    });
}

function requestGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;
                console.debug("Geolocation received: lat =", latitude, ", lng =", longitude);

                if (lastKnownPosition) {
                    var latDiff = Math.abs(lastKnownPosition.latitude - latitude);
                    var lngDiff = Math.abs(lastKnownPosition.longitude - longitude);
                    console.debug("Geolocation change: latDiff =", latDiff, ", lngDiff =", lngDiff);
                    if (latDiff < POSITION_CHANGE_THRESHOLD && lngDiff < POSITION_CHANGE_THRESHOLD) {
                        updateStatus("Geolocation has not changed significantly. Skipping update.");
                        console.debug("Geolocation change not significant. Skipping update.");
                        return;
                    }
                }

                lastKnownPosition = { latitude: latitude, longitude: longitude };

                updateStatus("Geolocation updated. Centering map and revealing new hexagon...");
                map.setCenter({ lat: latitude, lng: longitude });
                revealHexagonsAroundPosition(latitude, longitude);
                hexGrid.draw();

                // Show or update current user location marker
                if (!userLocationMarker) {
                    userLocationMarker = new google.maps.Marker({
                        position: { lat: latitude, lng: longitude },
                        map: map,
                        title: "You are here",
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: "#007bff",
                            fillOpacity: 1,
                            strokeColor: "white",
                            strokeWeight: 2
                        }
                    });
                } else {
                    userLocationMarker.setPosition({ lat: latitude, lng: longitude });
                }
            },
            function(error) {
                updateStatus("Geolocation error: " + error.message);
                console.error("Geolocation error:", error);
                hexGrid.draw();
            }
        );
    } else {
        updateStatus("Geolocation not supported by this browser.");
        console.warn("Geolocation not supported by this browser.");
        hexGrid.draw();
    }
}

function revealHexagonsAroundPosition(lat, lng) {
    var overlayProjection = hexGrid.getProjection();
    var userPosition = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
    var revealRadius = 150; // Adjust radius as needed

    console.debug("Revealing hexagons around user position:", userPosition);

    hexGrid.svg.selectAll(".hexagon").each(function(d) {
        var hexX = d.x;
        var hexY = d.y;
        var dx = hexX - userPosition.x;
        var dy = hexY - userPosition.y;
        var distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= revealRadius * revealRadius) {
            var hexId = d3.select(this).attr("id");
            console.debug("Revealing hexagon:", hexId);
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
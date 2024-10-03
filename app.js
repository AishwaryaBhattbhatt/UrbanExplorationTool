let map;
const HEXAGON_DIAMETER_METERS = 100;
let hexGrid;
let revealedHexagons = new Set();

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
            const svg = d3.select(this.getPanes().overlayMouseTarget).append("svg")
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
            const overlayProjection = this.getProjection();
            const bounds = map.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const topLeft = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(ne.lat(), sw.lng()));
            const bottomRight = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(sw.lat(), ne.lng()));

            const width = bottomRight.x - topLeft.x;
            const height = bottomRight.y - topLeft.y;

            this.svg.style("left", topLeft.x + "px")
                .style("top", topLeft.y + "px")
                .style("width", width + "px")
                .style("height", height + "px");

            const center = map.getCenter();
            const pixelsPerMeter = this.getPixelsPerMeter(center.lat());
            const hexRadius = (HEXAGON_DIAMETER_METERS / 2) * pixelsPerMeter;

            const hexbin = d3.hexbin()
                .radius(hexRadius)
                .extent([[0, 0], [width, height]]);

            const points = [];
            for (let x = 0; x < width; x += hexRadius * Math.sqrt(3)) {
                for (let y = 0; y < height; y += hexRadius * 3) {
                    points.push([x, y]);
                    points.push([x + hexRadius * Math.sqrt(3) / 2, y + hexRadius * 1.5]);
                }
            }

            const hexagons = this.svg.selectAll("path")
                .data(hexbin(points))
                .enter().append("path")
                .attr("d", d => "M" + d.x + "," + d.y + hexbin.hexagon())
                .attr("class", "hexagon")
                .attr("id", (d, i) => `hex-${i}`)
                .on("mousedown", handleHexagonInteraction)
                .on("touchstart", handleHexagonInteraction);

            revealedHexagons.forEach(id => {
                this.svg.select(`#${id}`).classed("revealed", true);
            });

            updateStatus("Hex grid drawn.");
        };

        hexGrid.getPixelsPerMeter = function(latitude) {
            return this.getProjection().getWorldWidth() / (40075016.686 * Math.cos(latitude * Math.PI / 180));
        };

        hexGrid.setMap(map);

        google.maps.event.addListenerOnce(map, 'idle', () => {
            updateStatus("Map idle. Requesting geolocation...");
            requestGeolocation();
        });

        google.maps.event.addListener(map, 'bounds_changed', () => {
            updateStatus("Bounds changed. Redrawing hex grid...");
            hexGrid.draw();
        });

    } catch (error) {
        updateStatus("Error initializing map: " + error.message);
        console.error("Map initialization error:", error);
    }
}

function requestGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateStatus("Geolocation received. Centering map...");
                const { latitude, longitude } = position.coords;
                map.setCenter({ lat: latitude, lng: longitude });
                map.setZoom(15);
                hexGrid.draw();
            },
            (error) => {
                updateStatus("Geolocation error: " + error.message);
                hexGrid.draw();
            }
        );
    } else {
        updateStatus("Geolocation not supported by this browser.");
        hexGrid.draw();
    }
}

function handleHexagonInteraction(event, d) {
    event.preventDefault();
    event.stopPropagation();
    const hexId = d3.select(this).attr("id");
    d3.select(this).classed("revealed", true);
    revealedHexagons.add(hexId);
    updateStatus("Hexagon revealed: " + hexId);
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

// Add this line to check if the script is loaded
console.log("app.js loaded and parsed");
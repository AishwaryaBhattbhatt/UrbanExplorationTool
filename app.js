var map;
var HEXAGON_DIAMETER_METERS = 100;
var hexGrid;
var revealedHexagons = new Set();

function initMap() {
    updateStatus("Initializing map...");
    try {
        map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 0, lng: 0 },
            zoom: 15,
            disableDefaultUI: true,
            gestureHandling: 'greedy', // Allow gestures on mobile devices
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

        hexGrid = new google.maps.OverlayView();
        hexGrid.onAdd = function() {
            var svg = d3.select(this.getPanes().overlayMouseTarget).append("svg")
                .attr("id", "hexSvg")
                .style("position", "absolute");
            this.svg = svg;
        };

        hexGrid.draw = function() {
            if (!this.svg) return;
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

            this.svg.selectAll("path")
                .data(hexbin(points))
                .enter().append("path")
                .attr("d", d => "M" + d.x + "," + d.y + hexbin.hexagon())
                .attr("class", "hexagon")
                .attr("id", (d, i) => "hex-" + i)
                .on("click", handleHexagonInteraction)
                .on("touchstart", handleHexagonInteraction);

            revealedHexagons.forEach(id => {
                this.svg.select("#" + id).classed("revealed", true);
            });
        };

        hexGrid.getPixelsPerMeter = function(latitude) {
            return this.getProjection().getWorldWidth() / (40075016.686 * Math.cos(latitude * Math.PI / 180));
        };

        hexGrid.setMap(map);

        google.maps.event.addListenerOnce(map, 'idle', requestGeolocation);
        google.maps.event.addListener(map, 'bounds_changed', () => hexGrid.draw());

    } catch (error) {
        updateStatus("Error initializing map: " + error.message);
    }
}

function requestGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                map.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
                map.setZoom(15);
                hexGrid.draw();
            },
            function() {
                updateStatus("Geolocation permission denied or unavailable.");
                hexGrid.draw();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        updateStatus("Geolocation not supported by this browser.");
        hexGrid.draw();
    }
}

function handleHexagonInteraction(event) {
    event.preventDefault();
    var hexId = d3.select(this).attr("id");
    d3.select(this).classed("revealed", true);
    revealedHexagons.add(hexId);
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

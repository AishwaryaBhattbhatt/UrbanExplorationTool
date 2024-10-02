let map;
let hexSize = 30;
let hexGrid;

function initMap() {
    updateStatus("Initializing map...");
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        disableDefaultUI: true,
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
        const svg = d3.select(this.getPanes().overlayLayer).append("svg")
            .attr("id", "hexSvg")
            .style("position", "absolute");
        this.svg = svg;
    };

    hexGrid.draw = function() {
        updateStatus("Drawing hex grid...");
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

        const hexbin = d3.hexbin()
            .radius(hexSize)
            .extent([[0, 0], [width, height]]);

        const points = d3.range(0, width, hexSize)
            .flatMap(x => d3.range(0, height, hexSize * Math.sqrt(3) / 2)
                .map(y => [x, y]));

        const hexagons = this.svg.selectAll("path")
            .data(hexbin(points))
            .enter().append("path")
            .attr("d", d => "M" + d.x + "," + d.y + hexbin.hexagon())
            .attr("class", "hexagon")
            .on("click", revealHexagon)
            .on("touchstart", revealHexagon);
    };

    hexGrid.setMap(map);

    google.maps.event.addListener(map, 'bounds_changed', () => {
        hexGrid.draw();
    });

    updateStatus("Map initialized. Requesting geolocation...");
    requestGeolocation();
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

function revealHexagon(event) {
    event.preventDefault();
    d3.select(this).classed("revealed", true);
    updateStatus("Hexagon revealed!");
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

// Adjust hexSize based on zoom level
google.maps.event.addListener(map, 'zoom_changed', function() {
    hexSize = Math.max(15, Math.min(30, 30 * Math.pow(2, map.getZoom() - 15)));
    hexGrid.draw();
});
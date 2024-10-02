let map;
const hexSize = 30; // Adjust this value to change the size of hexagons

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
                createHexGrid();
            },
            (error) => {
                updateStatus("Geolocation error: " + error.message);
                createHexGrid(); // Create hex grid even if geolocation fails
            }
        );
    } else {
        updateStatus("Geolocation not supported by this browser.");
        createHexGrid(); // Create hex grid even if geolocation is not supported
    }
}

function createHexGrid() {
    updateStatus("Creating hex grid...");
    const hexGrid = document.getElementById("hexGrid");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    hexGrid.appendChild(svg);

    const mapBounds = map.getBounds();
    const ne = mapBounds.getNorthEast();
    const sw = mapBounds.getSouthWest();

    const hexHeight = hexSize * 2;
    const hexWidth = Math.sqrt(3) / 2 * hexHeight;

    const projection = map.getProjection();
    const topLeft = projection.fromLatLngToPoint(new google.maps.LatLng(ne.lat(), sw.lng()));
    const bottomRight = projection.fromLatLngToPoint(new google.maps.LatLng(sw.lat(), ne.lng()));

    const scale = Math.pow(2, map.getZoom());

    for (let x = 0; x < window.innerWidth; x += hexWidth * 0.75) {
        for (let y = 0; y < window.innerHeight; y += hexHeight * 0.75) {
            const hexagon = createHexagon(x, y);
            svg.appendChild(hexagon);
        }
    }

    updateStatus("Hex grid created. Click on hexagons to reveal the map.");
}

function createHexagon(x, y) {
    const hexagon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const points = calculateHexPoints(x, y);
    hexagon.setAttribute("points", points);
    hexagon.setAttribute("class", "hexagon");
    hexagon.addEventListener("click", revealHexagon);
    return hexagon;
}

function calculateHexPoints(x, y) {
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = 2 * Math.PI / 6 * i;
        const hx = x + hexSize * Math.cos(angle);
        const hy = y + hexSize * Math.sin(angle);
        points.push(`${hx},${hy}`);
    }
    return points.join(" ");
}

function revealHexagon(event) {
    event.target.classList.add("revealed");
    updateStatus("Hexagon revealed!");
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

// Remove window.onload and let the Google Maps API callback handle initialization
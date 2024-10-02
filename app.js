let map;
let hexSize = 30; // We'll adjust this based on screen size

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
    hexGrid.innerHTML = ''; // Clear existing grid
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    hexGrid.appendChild(svg);

    // Adjust hexSize based on screen width
    hexSize = Math.max(15, Math.min(30, window.innerWidth / 20));

    const hexHeight = hexSize * 2;
    const hexWidth = Math.sqrt(3) / 2 * hexHeight;

    for (let x = 0; x < window.innerWidth; x += hexWidth * 0.75) {
        for (let y = 0; y < window.innerHeight; y += hexHeight * 0.75) {
            const hexagon = createHexagon(x, y);
            svg.appendChild(hexagon);
        }
    }

    updateStatus("Hex grid created. Tap on hexagons to reveal the map.");
}

function createHexagon(x, y) {
    const hexagon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const points = calculateHexPoints(x, y);
    hexagon.setAttribute("points", points);
    hexagon.setAttribute("class", "hexagon");
    hexagon.addEventListener("click", revealHexagon);
    hexagon.addEventListener("touchstart", revealHexagon);
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
    event.preventDefault(); // Prevent default touch behavior
    event.target.classList.add("revealed");
    updateStatus("Hexagon revealed!");
}

function updateStatus(message) {
    console.log(message);
    document.getElementById("status").textContent = "Status: " + message;
}

// Add event listener for window resize
window.addEventListener('resize', createHexGrid);

// Remove window.onload and let the Google Maps API callback handle initialization
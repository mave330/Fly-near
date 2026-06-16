let airfields = [];
const locateBtn = document.getElementById('locate-btn');
const statusText = document.getElementById('status');
const airportList = document.getElementById('airport-list');

// 1. Charger la base de données
async function loadDatabase() {
    try {
        const response = await fetch('airfields.json');
        if (!response.ok) throw new Error("Fichier introuvable");
        airfields = await response.json();
        statusText.textContent = `Base prête (${airfields.length} terrains)`;
        locateBtn.textContent = "Trouver les terrains les plus proches";
        locateBtn.disabled = false;
    } catch (error) {
        statusText.textContent = "Erreur: base de données introuvable. Attendez l'automatisation.";
    }
}

// Mathématiques : Distance et Cap
function toRad(value) { return value * Math.PI / 180; }
function calcDist(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return 3440.065 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
function calcHead(lat1, lon1, lat2, lon2) {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// 2. Action du bouton GPS
locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return statusText.textContent = "GPS non supporté.";
    statusText.textContent = "Recherche GPS en cours...";
    locateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition((pos) => {
        const uLat = pos.coords.latitude, uLon = pos.coords.longitude;
        
        let processed = airfields.map(ap => ({
            ...ap,
            dist: calcDist(uLat, uLon, ap.lat, ap.lon),
            head: calcHead(uLat, uLon, ap.lat, ap.lon)
        }));

        processed.sort((a, b) => a.dist - b.dist);
        renderList(processed.slice(0, 10));
        
        statusText.textContent = "Top 10 affiché.";
        locateBtn.disabled = false;
    }, (err) => {
        statusText.textContent = "Erreur GPS. Veuillez autoriser la localisation.";
        locateBtn.disabled = false;
    }, { enableHighAccuracy: true });
});

function renderList(airports) {
    airportList.innerHTML = '';
    airports.forEach(ap => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="airport-info">
                <h2>${ap.icao} <span style="font-size:14px;font-weight:normal">${ap.name}</span></h2>
                <p>Alt: ${ap.alt} ft</p>
                <p><strong>${ap.qfu}</strong> (${ap.rwy}m - ${ap.sfc})</p>
            </div>
            <div class="nav-data">
                <div class="distance">${ap.dist.toFixed(1)} NM</div>
                <div class="heading">${Math.round(ap.head)}°</div>
            </div>`;
        airportList.appendChild(li);
    });
}

// Démarrage
loadDatabase();

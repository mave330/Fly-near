let airfields = [];
const locateBtn = document.getElementById('locate-btn');
const statusText = document.getElementById('status');
const airportList = document.getElementById('airport-list');

// Gestion des réglages (Vitesse)
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const speedInput = document.getElementById('speed-input');

// Charge la vitesse sauvegardée (ou 100kt par défaut)
let userSpeed = localStorage.getItem('userSpeed') || 100;
speedInput.value = userSpeed;

settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'block'; });
saveSettingsBtn.addEventListener('click', () => {
    userSpeed = speedInput.value;
    localStorage.setItem('userSpeed', userSpeed);
    settingsModal.style.display = 'none';
    // Si on a déjà des résultats affichés, on relance la localisation pour mettre à jour les temps
    if(airportList.innerHTML !== '') locateBtn.click();
});

// Variables Carte
let map = null;
let mapLayers = [];

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
        statusText.textContent = "Erreur: base de données introuvable.";
    }
}

// Mathématiques
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
        
        let processed = airfields.map(ap => {
            let dist = calcDist(uLat, uLon, ap.lat, ap.lon);
            // Calcul du temps en minutes (Distance / Vitesse * 60)
            let timeMins = (dist / userSpeed) * 60;
            return {
                ...ap,
                dist: dist,
                head: calcHead(uLat, uLon, ap.lat, ap.lon),
                time: timeMins
            };
        });

        processed.sort((a, b) => a.dist - b.dist);
        const top10 = processed.slice(0, 10);
        
        renderList(top10);
        updateMap(uLat, uLon, top10);
        
        statusText.textContent = `Top 10 (Calculé à ${userSpeed} kt)`;
        locateBtn.disabled = false;
    }, (err) => {
        statusText.textContent = "Erreur GPS. Veuillez autoriser la localisation.";
        locateBtn.disabled = false;
    }, { enableHighAccuracy: true });
});

// 3. Carte (Identique)
function updateMap(uLat, uLon, airports) {
    document.getElementById('map-container').style.display = 'block';
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([uLat, uLon], 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap, &copy; CARTO'
        }).addTo(map);
    }
    mapLayers.forEach(layer => map.removeLayer(layer));
    mapLayers = [];
    let bounds = L.latLngBounds([[uLat, uLon]]);
    let userMarker = L.circleMarker([uLat, uLon], { color: '#0A84FF', fillColor: '#0A84FF', fillOpacity: 1, radius: 6 }).addTo(map);
    mapLayers.push(userMarker);

    airports.forEach(ap => {
        let apMarker = L.circleMarker([ap.lat, ap.lon], { color: '#FF453A', fillColor: '#FF453A', fillOpacity: 0.8, radius: 4 }).addTo(map).bindPopup(`<b>${ap.icao}</b>`);
        mapLayers.push(apMarker);
        let vectorLine = L.polyline([[uLat, uLon], [ap.lat, ap.lon]], { color: '#0A84FF', weight: 2, dashArray: '5, 5', opacity: 0.4 }).addTo(map);
        mapLayers.push(vectorLine);
        bounds.extend([ap.lat, ap.lon]);
    });
    map.fitBounds(bounds, { padding: [20, 20] });
    setTimeout(() => { map.invalidateSize(); }, 100);
}

// Utilitaires Visuels pour la Liste
function getRwyColor(length) {
    if (length === 0) return '#555'; // Inconnu
    if (length < 400) return 'var(--rwy-short)';
    if (length < 700) return 'var(--rwy-med)';
    return 'var(--rwy-long)';
}

function getRwyRotation(qfu) {
    // Extrait les deux premiers chiffres du QFU (ex: "08/26" -> "08" -> 80 degrés)
    let match = String(qfu).match(/(\d{2})/);
    if (match) return parseInt(match[1]) * 10;
    return 0; // Si "N/A"
}

function formatTime(mins) {
    if (mins < 60) return `${Math.round(mins)} min`;
    let h = Math.floor(mins / 60);
    let m = Math.round(mins % 60);
    return `${h}h${m < 10 ? '0'+m : m}`;
}

// 4. Affichage de la liste HTML
function renderList(airports) {
    airportList.innerHTML = '';
    airports.forEach(ap => {
        const rwyColor = getRwyColor(ap.rwy);
        const rotation = getRwyRotation(ap.qfu);
        const formattedTime = formatTime(ap.time);
        
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="airport-info">
                <h2>${ap.icao} <span style="font-size:14px;font-weight:normal">${ap.name}</span></h2>
                <p>Alt: ${ap.alt} ft</p>
                <div class="rwy-badge" style="background-color: ${rwyColor}">
                    ${ap.qfu} - ${ap.rwy}m (${ap.sfc})
                </div>
            </div>
            
            <div class="rwy-diagram">
                <svg width="24" height="24" viewBox="0 0 30 30">
                    <circle cx="15" cy="15" r="14" stroke="#444" stroke-width="1" fill="none"/>
                    <rect x="13" y="4" width="4" height="22" fill="${rwyColor}" transform="rotate(${rotation} 15 15)"/>
                </svg>
            </div>

            <div class="nav-data">
                <div class="distance">${ap.dist.toFixed(1)} NM</div>
                <div class="time">⏱ ${formattedTime}</div>
                <div class="heading">🧭 ${Math.round(ap.head)}°</div>
            </div>`;
        airportList.appendChild(li);
    });
}

// Démarrage
loadDatabase();

const MAP_API = "/api";
let mapInstance = null;
let markersLayer = null;

async function loadMapData() {
    // We fetch everything in parallel
    let [lieux, events, persons, relEvLieu, relPersLieu] = await Promise.all([
        fetch(`${MAP_API}/entities/Lieu`).then(r => r.json()),
        fetch(`${MAP_API}/entities/Evenement`).then(r => r.json()),
        fetch(`${MAP_API}/entities/Personnages`).then(r => r.json()),
        fetch(`${MAP_API}/links/Lien_evenement_lieux`).then(r => r.json()),
        fetch(`${MAP_API}/links/Lien_personnage_lieux`).then(r => r.json())
    ]);

    return { lieux, events, persons, relEvLieu, relPersLieu };
}

async function initOrRefreshMap() {
    if (!mapInstance) {
        // Initialize the map centered over France by default (Zoom level 5)
        mapInstance = L.map('map-container').setView([46.603354, 1.888334], 5);
        
        // Add OpenStreetMap tiles layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);
        
        markersLayer = L.layerGroup().addTo(mapInstance);
        
        // Fetch DB data and populate the map
        try {
            const data = await loadMapData();
            drawMarkers(data);
        } catch (err) {
            console.error('Erreur lors du chargement des données Lieu:', err);
        }
    }
    
    // InvalidateSize forces Leaflet to recalculate the map dimensions.
    // Important because the container is display:none on page load.
    setTimeout(() => {
        mapInstance.invalidateSize();
    }, 200);
}

function drawMarkers({ lieux, events, persons, relEvLieu, relPersLieu }) {
    markersLayer.clearLayers();

    lieux.forEach(lieu => {
        // GPS coordinates expected in free string format "lat, lon" or "lat,lon" 
        // e.g "48.8566, 2.3522" for Paris
        if (!lieu.Coordonne) return;
        
        const coords = lieu.Coordonne.split(',').map(c => parseFloat(c.trim()));
        if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return;

        // Cross-reference finding : Events at this place
        const evIds = relEvLieu.filter(r => r.ID_lieux === lieu.ID).map(r => r.ID_evenement);
        const linkedEv = events.filter(e => evIds.includes(e.ID));
        
        // Cross-reference finding : People linked to this place
        const persIds = relPersLieu.filter(r => r.ID_lieux === lieu.ID).map(r => r.ID_personnage);
        const linkedPers = persons.filter(p => persIds.includes(p.ID));

        // Building Popup Content dynamically
        let popupContent = `
            <h3 style="margin: 0 0 5px 0; color: #d35400;">${lieu.titre}</h3>
            ${lieu.type ? `<span class="badge" style="background:#6c757d; margin-bottom:10px;">${lieu.type}</span>` : ''}
            ${lieu.description ? `<p style="margin: 5px 0;"><i>${lieu.description}</i></p>` : ''}
        `;
        
        if (linkedEv.length > 0) {
            popupContent += `
                <div style="margin-top: 10px;">
                    <b>Évènements historiques :</b>
                    <ul style="padding-left: 20px; margin-top: 5px;">
                        ${linkedEv.map(e => `<li>${e.titre}</li>`).join('')}
                    </ul>
                </div>`;
        }
        
        if (linkedPers.length > 0) {
            popupContent += `
                <div style="margin-top: 10px;">
                    <b>Personnalités associées :</b>
                    <ul style="padding-left: 20px; margin-top: 5px;">
                        ${linkedPers.map(p => `<li>${p.Nom}</li>`).join('')}
                    </ul>
                </div>`;
        }

        // Create the Marker & inject popup
        const marker = L.marker([coords[0], coords[1]]).addTo(markersLayer);
        marker.bindPopup(popupContent, { maxWidth: 300 });
    });
}
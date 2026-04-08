const API = "/api";
let currentTable = null;

// Helpers for dates formatting
const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function formatCustomDate(dateStr, precision) {
    if (!dateStr) return "";
    let d = new Date(dateStr);
    if(isNaN(d.getTime())) return dateStr; // fallback

    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    if (precision === "Jour") {
        return `${day} ${month} ${year}`;
    } else if (precision === "Mois") {
        return `${month} ${year}`;
    } else if (precision === "Année") {
        return `${year}`;
    } else {
        return dateStr; // basic fallback
    }
}

// Fetch helper (returns JSON)
async function fetchApi(endpoint) {
    const res = await fetch(`${API}${endpoint}`);
    return await res.json();
}

// Complex Data Fetcher: Merges Entity with its relationships
async function fetchEntityWithRelations(entityType) {
    try {
        const entities = await fetchApi(`/entities/${entityType}`);
        
        // Very simplistic map for the required entities. For this POC, we focus on Evenement & Personnages
        if (entityType === 'Evenement') {
            const [relPers, relLieu, allPers, allLieu] = await Promise.all([
                fetchApi('/links/Lien_evenement_personnage'),
                fetchApi('/links/Lien_evenement_lieux'),
                fetchApi('/entities/Personnages'),
                fetchApi('/entities/Lieu')
            ]);
            
            // Map names
            return entities.map(e => {
                // Find relationships
                const linkedP = relPers.filter(r => r.ID_evenement === e.ID).map(r => allPers.find(p => p.ID === r.ID_personnage)?.Nom).filter(Boolean);
                const linkedL = relLieu.filter(r => r.ID_evenement === e.ID).map(r => allLieu.find(l => l.ID === r.ID_lieux)?.titre).filter(Boolean);
                
                // Formatted dates
                e._formattedDebut = formatCustomDate(e.Date_Debut, e.precision_Debut);
                e._formattedFin = formatCustomDate(e.Date_Fin, e.precision_Fin);
                
                // Attach badge array strings
                e._personnages = linkedP.map(p => `<span class="badge" title="Personnage lié">${p}</span>`).join('');
                e._lieux = linkedL.map(l => `<span class="badge" style="background:#28a745" title="Lieu lié">${l}</span>`).join('');
                
                return e;
            });
        }
        
        if(entityType === 'Personnages') {
            const [relLieu, allLieu] = await Promise.all([
                fetchApi('/links/Lien_personnage_lieux'),
                fetchApi('/entities/Lieu')
            ]);
            return entities.map(e => {
                const linkedL = relLieu.filter(r => r.ID_personnage === e.ID).map(r => allLieu.find(l => l.ID === r.ID_lieux)?.titre).filter(Boolean);
                e._formattedDebut = formatCustomDate(e.Date_Naissance, e.precision_Naissance);
                e._formattedFin = formatCustomDate(e.Date_Mort, e.precision_Mort);
                e._lieux = linkedL.map(l => `<span class="badge" style="background:#28a745" title="Lieu lié">${l}</span>`).join('');
                return e;
            });
        }
        
        // Fallback generic for Lieu, Entite_politique...
        return entities.map(e => {
             e._formattedDebut = formatCustomDate(e.Date_Debut, e.precision_Debut);
             e._formattedFin = formatCustomDate(e.Date_Fin, e.precision_Fin);
             return e;
        });

    } catch(err) {
        console.error("Error fetching data:", err);
        return [];
    }
}

// Columns definitions for the Tabulator (DataTables equivalent)
const columnsDef = {
    'Evenement': [
        {title:"ID", field:"ID", width: 60, sorter:"number"},
        {title:"Titre", field:"titre", headerFilter:"input", width: 250},
        {title:"Date Début", field:"_formattedDebut", sorter:"string", headerFilter:"input"},
        {title:"Date Fin", field:"_formattedFin", sorter:"string"},
        {title:"Personnages liés (Badges)", field:"_personnages", formatter:"html", headerFilter:"input", width: 200},
        {title:"Lieux", field:"_lieux", formatter:"html", headerFilter:"input"},
        {title:"Description", field:"description", formatter:"textarea"}
    ],
    'Personnages': [
        {title:"ID", field:"ID", width: 60, sorter:"number"},
        {title:"Nom", field:"Nom", headerFilter:"input", width: 200},
        {title:"Naissance", field:"_formattedDebut", sorter:"string"},
        {title:"Mort", field:"_formattedFin", sorter:"string"},
        {title:"Lieux", field:"_lieux", formatter:"html", headerFilter:"input"},
        {title:"Description", field:"description"}
    ],
    'Lieu': [
        {title:"ID", field:"ID", width: 60, sorter:"number"},
        {title:"Titre (Lieu)", field:"titre", headerFilter:"input", width: 200},
        {title:"Type", field:"type", headerFilter:"input"},
        {title:"Coordonnées", field:"Coordonne"},
        {title:"Description", field:"description"}
    ]
};

async function loadTableData() {
    const entityType = document.getElementById('filter-entity').value;
    let tableData = await fetchEntityWithRelations(entityType);

    // Apply global filters
    if (typeof filterEntities === 'function') {
        tableData = filterEntities(tableData, entityType);
    }

    // Destroy previous table instance if it exists
    if(currentTable) {
        currentTable.destroy();
    }

    const cols = columnsDef[entityType] || [
        {title:"Titre/Nom", field: entityType === 'Personnages' ? "Nom" : "titre", headerFilter:"input"}
    ];

    // Initialize Tabulator (Pure JS DataTable Alternative, very powerful for filtering and sorting)
    currentTable = new Tabulator("#data-table", {
        data: tableData, // load row data
        layout:"fitColumns", // fit columns to block
        responsiveLayout:"hide", 
        pagination:"local", // enable local pagination.
        paginationSize:10, // 10 rows per page
        movableColumns:true, // allow column order to be changed
        columns: cols,
        locale: "fr"
    });
}

function applyFilters() {
    const term = document.getElementById('filter-text').value;
    // Basic multi-column text search implementation across title/nom
    currentTable.setFilter(function(data){
        let searchString = term.toLowerCase();
        let valueToSearch = (data.titre || data.Nom || "") + " " + (data._personnages || "") + " " + (data.description || "");
        return valueToSearch.toLowerCase().includes(searchString);
    });
}

function clearFilters() {
    document.getElementById('filter-text').value = '';
    currentTable.clearFilter();
}

// Init on load
document.addEventListener("DOMContentLoaded", () => {
    loadTableData();
});
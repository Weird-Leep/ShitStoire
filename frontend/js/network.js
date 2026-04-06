const NET_API = "http://localhost:3000/api";
let networkInstance = null;
let nodesDataSet = new vis.DataSet();
let edgesDataSet = new vis.DataSet();

// Configuration styles pour les noeuds par type d'entité
const TYPES = {
    'ev': { color: { background: '#D2E5FF', border: '#2B7CE9' }, shape: 'box' },            // Evènements
    'pe': { color: { background: '#FFF3CD', border: '#FFC107' }, shape: 'ellipse' },        // Personnages
    'li': { color: { background: '#D4EDDA', border: '#28A745' }, shape: 'triangle' },       // Lieux
    'ep': { color: { background: '#F8D7DA', border: '#DC3545' }, shape: 'diamond' }         // Entités Politiques
};

async function fetchJSON(url) {
    const res = await fetch(API + url);
    return await res.json();
}

function initNetwork() {
    if (networkInstance) return; // Already initialized
    
    const container = document.getElementById('network-container');
    const data = {
        nodes: nodesDataSet,
        edges: edgesDataSet
    };
    
    const options = {
        nodes: {
            borderWidth: 2,
            font: { size: 14, face: 'arial' },
            shadow: true
        },
        edges: {
            width: 1.5,
            color: { inherit: 'from' },
            font: { size: 12, align: 'middle' },
            smooth: { type: 'continuous' }
        },
        physics: {
            forceAtlas2Based: {
                gravitationalConstant: -150, // Pousse les noeuds à s'écarter
                centralGravity: 0.01,
                springLength: 150,           // Longueur de base des liens
                springConstant: 0.04
            },
            maxVelocity: 50,
            solver: 'forceAtlas2Based',
            timestep: 0.35,
            stabilization: { iterations: 150 }
        },
        interaction: { hover: true, tooltipDelay: 200 }
    };
    
    networkInstance = new vis.Network(container, data, options);
    loadNetworkData();
}

async function loadNetworkData() {
    const sEv = document.getElementById('net-check-ev').checked;
    const sPe = document.getElementById('net-check-pe').checked;
    const sLi = document.getElementById('net-check-li').checked;
    const sEp = document.getElementById('net-check-ep').checked;

    // Reset datasets
    nodesDataSet.clear();
    edgesDataSet.clear();

    const nodesArr = [];
    const edgesArr = [];

    // --- FETCH ENTITIES ---
    let events = [], persons = [], lieux = [], politics = [];
    if(sEv) events = await fetchJSON('/entities/Evenement');
    if(sPe) persons = await fetchJSON('/entities/Personnages');
    if(sLi) lieux = await fetchJSON('/entities/Lieu');
    if(sEp) politics = await fetchJSON('/entities/Entite_politique');

    if (typeof filterEntities === 'function') {
        events = filterEntities(events, 'Evenement');
        persons = filterEntities(persons, 'Personnages');
        lieux = filterEntities(lieux, 'Lieu');
        politics = filterEntities(politics, 'Entite_politique');
    }

    // Create Nodes
    events.forEach(e => nodesArr.push({ id: `ev_${e.ID}`, label: e.titre, title: `<b>${e.titre}</b><br>${e.description||''}`, ...TYPES.ev }));
    persons.forEach(p => nodesArr.push({ id: `pe_${p.ID}`, label: p.Nom, title: `<b>${p.Nom}</b><br>${p.description||''}`, ...TYPES.pe }));
    lieux.forEach(l => nodesArr.push({ id: `li_${l.ID}`, label: l.titre, title: `<b>${l.titre}</b><br>${l.description||''}`, ...TYPES.li }));
    politics.forEach(ep => nodesArr.push({ id: `ep_${ep.ID}`, label: ep.titre, title: `<b>${ep.titre}</b><br>${ep.description||''}`, ...TYPES.ep }));
    
    nodesDataSet.add(nodesArr);

    // --- FETCH & CREATE RELATIONS (EDGES) ---
    // Only fetch relations if both sides of the node are supposed to be visible

    // Example 1: Evènement <-> Personnage (Needs both selected)
    if (sEv && sPe) {
        const evPe = await fetchJSON('/links/Lien_evenement_personnage');
        evPe.forEach(rel => edgesArr.push({
            from: `ev_${rel.ID_evenement}`, 
            to: `pe_${rel.ID_personnage}`,
            label: rel.description || ''
        }));
    }

    // Example 2: Evènement <-> Lieux
    if (sEv && sLi) {
        const evLi = await fetchJSON('/links/Lien_evenement_lieux');
        evLi.forEach(rel => edgesArr.push({
            from: `ev_${rel.ID_evenement}`, 
            to: `li_${rel.ID_lieux}`,
            label: rel.description || ''
        }));
    }
    
    // Example 3: Personnage <-> Personnage (Recursive/Intern)
    if (sPe) {
        const pePe = await fetchJSON('/links/Lien_personnage_personnage');
        pePe.forEach(rel => edgesArr.push({
            from: `pe_${rel.ID_personnage_A}`, 
            to: `pe_${rel.ID_personnage_B}`,
            label: rel.description || '',
            arrows: 'to' // Add an arrow to show direction of relation if any
        }));
    }

    // Example 4: Personnage <-> Lieux
    if (sPe && sLi) {
        const peLi = await fetchJSON('/links/Lien_personnage_lieux');
        peLi.forEach(rel => edgesArr.push({
            from: `pe_${rel.ID_personnage}`, 
            to: `li_${rel.ID_lieux}`,
            label: rel.description || ''
        }));
    }
    
    // Example 5: Personnage <-> Entité Politique
    if (sPe && sEp) {
         const peEp = await fetchJSON('/links/Lien_personnage_entite_politique');
         peEp.forEach(rel => edgesArr.push({
             from: `pe_${rel.ID_personnage}`, 
             to: `ep_${rel.ID_entite_politique}`,
             label: rel.description || ''
         }));
    }
    
    // Example 6: Lieu <-> Entité Politique
    if (sLi && sEp) {
        const liEp = await fetchJSON('/links/Lien_lieu_entite_politique');
        liEp.forEach(rel => edgesArr.push({
            from: `li_${rel.ID_lieu}`, 
            to: `ep_${rel.ID_entite_politique}`,
            label: rel.description || ''
        }));
   }

    // Apply edges
    edgesDataSet.add(edgesArr);
}
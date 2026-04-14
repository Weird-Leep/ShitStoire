const NET_API = "/api";
let networkInstance = null;
let nodesDataSet = new vis.DataSet();
let edgesDataSet = new vis.DataSet();

const TYPES = {
    ev: { color: { background: "#D2E5FF", border: "#2B7CE9" }, shape: "box" },
    pe: { color: { background: "#FFF3CD", border: "#FFC107" }, shape: "ellipse" },
    li: { color: { background: "#D4EDDA", border: "#28A745" }, shape: "triangle" },
    ep: { color: { background: "#F8D7DA", border: "#DC3545" }, shape: "diamond" },
    dt: { color: { background: "#FFF7E6", border: "#FF9800" }, shape: "dot", size: 10 },
};

async function fetchJSON(url) {
    const res = await fetch(NET_API + url);
    return await res.json();
}

function parseDateStr(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function normalizeDatePoint(dateObj, precision, isEnd = false) {
    if (!dateObj) return null;
    const normalized = new Date(dateObj);

    if (precision === "Année") {
        normalized.setMonth(isEnd ? 11 : 0, isEnd ? 31 : 1);
        normalized.setHours(isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
        return normalized;
    }

    if (precision === "Mois") {
        if (isEnd) {
            normalized.setMonth(normalized.getMonth() + 1, 0);
            normalized.setHours(23, 59, 59, 999);
        } else {
            normalized.setDate(1);
            normalized.setHours(0, 0, 0, 0);
        }
        return normalized;
    }

    normalized.setHours(isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
    return normalized;
}

function formatDateLabel(dateObj, precision) {
    if (!dateObj) return "Date inconnue";
    const options = precision === "Année"
        ? { year: "numeric" }
        : precision === "Mois"
            ? { month: "long", year: "numeric" }
            : { day: "numeric", month: "long", year: "numeric" };
    return dateObj.toLocaleDateString("fr-FR", options);
}

function buildDatePointKey(dateObj) {
    if (!dateObj) return null;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildDateNodeId(dateKey) {
    return `dt_${dateKey}`;
}

function buildNetworkItems(events, persons, lieux, politics) {
    const nodesArr = [];
    const edgesArr = [];
    const dateNodes = new Map();
    const eventDateLinks = [];

    events.forEach((e) => {
        const nodeId = `ev_${e.ID}`;
        nodesArr.push({
            id: nodeId,
            label: e.titre,
            title: `<b>${e.titre}</b><br>${e.description || ""}`,
            ...TYPES.ev,
        });

        const startRaw = parseDateStr(e.Date_Debut);
        const endRaw = parseDateStr(e.Date_Fin);
        const startDate = normalizeDatePoint(startRaw, e.precision_Debut, false);
        const endDate = normalizeDatePoint(endRaw || startRaw, e.precision_Fin || e.precision_Debut, true);

        const dateEntries = [];
        if (startDate) dateEntries.push({ date: startDate, precision: e.precision_Debut || "Jour", kind: "Début" });
        if (endDate && (!startDate || endDate.getTime() !== startDate.getTime())) {
            dateEntries.push({ date: endDate, precision: e.precision_Fin || e.precision_Debut || "Jour", kind: "Fin" });
        }

        dateEntries.forEach((entry) => {
            const dateKey = buildDatePointKey(entry.date);
            const dateNodeId = buildDateNodeId(dateKey);

            if (!dateNodes.has(dateNodeId)) {
                dateNodes.set(dateNodeId, {
                    id: dateNodeId,
                    label: formatDateLabel(entry.date, entry.precision),
                    title: `<b>${formatDateLabel(entry.date, entry.precision)}</b>`,
                    group: "date",
                    ...TYPES.dt,
                });
            }

            eventDateLinks.push({
                from: dateNodeId,
                to: nodeId,
                label: entry.kind,
                arrows: "to",
                dashes: true,
                color: { color: "#ff9800", inherit: false },
            });
        });
    });

    const sortedDateNodes = [...dateNodes.values()].sort((a, b) => {
        const aKey = String(a.id).replace("dt_", "");
        const bKey = String(b.id).replace("dt_", "");
        return aKey.localeCompare(bKey);
    });

    sortedDateNodes.forEach((node, index) => {
        const dateKey = String(node.id).replace("dt_", "");
        if (index < sortedDateNodes.length - 1) {
            const nextNode = sortedDateNodes[index + 1];
            edgesArr.push({
                from: node.id,
                to: nextNode.id,
                arrows: "to",
                dashes: false,
                color: { color: "#999999", inherit: false },
                width: 2,
                smooth: { type: "cubicBezier" },
                title: `Chronologie: ${dateKey}`,
            });
        }
    });

    nodesArr.push(...sortedDateNodes);
    edgesArr.push(...eventDateLinks);

    persons.forEach((p) => {
        nodesArr.push({
            id: `pe_${p.ID}`,
            label: p.Nom,
            title: `<b>${p.Nom}</b><br>${p.description || ""}`,
            ...TYPES.pe,
        });
    });

    lieux.forEach((l) => {
        nodesArr.push({
            id: `li_${l.ID}`,
            label: l.titre,
            title: `<b>${l.titre}</b><br>${l.description || ""}`,
            ...TYPES.li,
        });
    });

    politics.forEach((ep) => {
        nodesArr.push({
            id: `ep_${ep.ID}`,
            label: ep.titre,
            title: `<b>${ep.titre}</b><br>${ep.description || ""}`,
            ...TYPES.ep,
        });
    });

    return { nodesArr, edgesArr };
}

function initNetwork() {
    if (networkInstance) {
        loadNetworkData();
        networkInstance.redraw();
        return;
    }

    const container = document.getElementById("network-container");
    const data = {
        nodes: nodesDataSet,
        edges: edgesDataSet,
    };

    const options = {
        nodes: {
            borderWidth: 2,
            font: { size: 14, face: "arial" },
            shadow: true,
        },
        edges: {
            width: 1.5,
            color: { inherit: "from" },
            font: { size: 12, align: "middle" },
            smooth: { type: "continuous" },
        },
        physics: {
            forceAtlas2Based: {
                gravitationalConstant: -150,
                centralGravity: 0.01,
                springLength: 150,
                springConstant: 0.04,
            },
            maxVelocity: 50,
            solver: "forceAtlas2Based",
            timestep: 0.35,
            stabilization: { iterations: 150 },
        },
        interaction: { hover: true, tooltipDelay: 200 },
    };

    networkInstance = new vis.Network(container, data, options);
    loadNetworkData();
}

async function loadNetworkData() {
    const sEv = document.getElementById("net-check-ev").checked;
    const sPe = document.getElementById("net-check-pe").checked;
    const sLi = document.getElementById("net-check-li").checked;
    const sEp = document.getElementById("net-check-ep").checked;

    nodesDataSet.clear();
    edgesDataSet.clear();

    let events = [];
    let persons = [];
    let lieux = [];
    let politics = [];

    if (sEv) events = await fetchJSON("/entities/Evenement");
    if (sPe) persons = await fetchJSON("/entities/Personnages");
    if (sLi) lieux = await fetchJSON("/entities/Lieu");
    if (sEp) politics = await fetchJSON("/entities/Entite_politique");

    const { nodesArr, edgesArr } = buildNetworkItems(events, persons, lieux, politics);
    nodesDataSet.add(nodesArr);

    if (sEv && sPe) {
        const evPe = await fetchJSON("/links/Lien_evenement_personnage");
        evPe.forEach((rel) => {
            edgesArr.push({
                from: `ev_${rel.ID_evenement}`,
                to: `pe_${rel.ID_personnage}`,
                label: rel.description || "",
            });
        });
    }

    if (sEv) {
        const evEv = await fetchJSON("/links/Lien_evenement_evenement");
        evEv.forEach((rel) => {
            edgesArr.push({
                from: `ev_${rel.ID_evenement_A}`,
                to: `ev_${rel.ID_evenement_B}`,
                label: rel.description || "",
            });
        });
    }

    if (sEv && sLi) {
        const evLi = await fetchJSON("/links/Lien_evenement_lieux");
        evLi.forEach((rel) => {
            edgesArr.push({
                from: `ev_${rel.ID_evenement}`,
                to: `li_${rel.ID_lieux}`,
                label: rel.description || "",
            });
        });
    }

    if (sPe) {
        const pePe = await fetchJSON("/links/Lien_personnage_personnage");
        pePe.forEach((rel) => {
            edgesArr.push({
                from: `pe_${rel.ID_personnage_A}`,
                to: `pe_${rel.ID_personnage_B}`,
                label: rel.description || "",
                arrows: "to",
            });
        });
    }

    if (sPe && sLi) {
        const peLi = await fetchJSON("/links/Lien_personnage_lieux");
        peLi.forEach((rel) => {
            edgesArr.push({
                from: `pe_${rel.ID_personnage}`,
                to: `li_${rel.ID_lieux}`,
                label: rel.description || "",
            });
        });
    }

    if (sPe && sEp) {
        const peEp = await fetchJSON("/links/Lien_personnage_entite_politique");
        peEp.forEach((rel) => {
            edgesArr.push({
                from: `pe_${rel.ID_personnage}`,
                to: `ep_${rel.ID_entite_politique}`,
                label: rel.description || "",
            });
        });
    }

    if (sLi && sEp) {
        const liEp = await fetchJSON("/links/Lien_lieu_entite_politique");
        liEp.forEach((rel) => {
            edgesArr.push({
                from: `li_${rel.ID_lieu}`,
                to: `ep_${rel.ID_entite_politique}`,
                label: rel.description || "",
            });
        });
    }

    edgesDataSet.add(edgesArr);
}

window.initNetwork = initNetwork;
window.loadNetworkData = loadNetworkData;

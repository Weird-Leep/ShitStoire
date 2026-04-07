let timelineInstance = null;

// The backend endpoint defined for reusable code
const TL_API = "http://localhost:3000/api";

function parseDateStr(dateStr) {
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return null;
    return d;
}

// Initialize Timeline Data based on checkboxes
async function loadTimelineData() {
    const showEv = document.getElementById('check-ev').checked;
    const showPe = document.getElementById('check-pe').checked;
    const showEp = document.getElementById('check-ep').checked;

    let itemsData = [];
    let groupsData = [];

    let [events, persons, politics] = await Promise.all([
        fetch(`${TL_API}/entities/Evenement`).then(r => r.json()),
        fetch(`${TL_API}/entities/Personnages`).then(r => r.json()),
        fetch(`${TL_API}/entities/Entite_politique`).then(r => r.json())
    ]);

    if (typeof filterEntities === 'function') {
        events = filterEntities(events, 'Evenement');
        persons = filterEntities(persons, 'Personnages');
        politics = filterEntities(politics, 'Entite_politique');
    }

    if (showEv) {
        groupsData.push({ id: 'ev', content: 'Évènements', order: 1 });
        events.forEach(e => {
            const start = parseDateStr(e.Date_Debut);
            const end = parseDateStr(e.Date_Fin);
            
            if (start) {
                // Calculate duration in days 
                let isShort = false;
                if(end) {
                    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
                    if(daysDiff < 30) isShort = true;
                } else {
                    isShort = true; // No end date = single point = short
                }
                
                itemsData.push({
                    id: 'ev_' + e.ID,
                    group: 'ev',
                    subgroup: isShort ? '1' : '2',
                    content: `<div><b>${e.titre}</b></div>`,
                    start: start,
                    end: end,
                    type: isShort ? 'box' : 'range',
                    className: 'timeline-item-event' + (isShort ? ' vis-item-short' : '') + ' item-id-ev_' + e.ID,
                    customData: {
                        type: 'ev', id: e.ID, title: e.titre, start: e.Date_Debut, end: e.Date_Fin, description: e.description
                    }
                });
            }
        });
    }

    if (showPe) {
        groupsData.push({ id: 'pe', content: 'Personnages', order: 2 });
        persons.forEach(p => {
            const start = parseDateStr(p.Date_Naissance);
            const end = parseDateStr(p.Date_Mort);
            if (start) {
                let isShort = false;
                if(end) {
                    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
                    if(daysDiff < 30) isShort = true;
                } else {
                    isShort = true;
                }

                itemsData.push({
                    id: 'pe_' + p.ID,
                    group: 'pe',
                    subgroup: isShort ? '1' : '2',
                    content: `<div>👤 ${p.Nom}</div>`,
                    start: start,
                    end: end,
                    type: isShort ? 'box' : 'range',
                    className: 'timeline-item-person' + (isShort ? ' vis-item-short' : '') + ' item-id-pe_' + p.ID,
                    customData: {
                        type: 'pe', id: p.ID, title: p.Nom, start: p.Date_Naissance, end: p.Date_Mort, description: p.description
                    }
                });
            }
        });
    }

    if (showEp) {
        groupsData.push({ id: 'ep', content: 'Entités Politiques', order: 3 });
        politics.forEach(ep => {
            const start = parseDateStr(ep.Date_Debut);
            const end = parseDateStr(ep.Date_Fin);
            if (start) {
                let isShort = false;
                if(end) {
                    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
                    if(daysDiff < 30) isShort = true;
                } else {
                    isShort = true;
                }

                itemsData.push({
                    id: 'ep_' + ep.ID,
                    group: 'ep',
                    subgroup: isShort ? '1' : '2',
                    content: `<div>🛡️ ${ep.titre}</div>`,
                    start: start,
                    end: end,
                    type: isShort ? 'box' : 'range',
                    className: 'timeline-item-politics' + (isShort ? ' vis-item-short' : '') + ' item-id-ep_' + ep.ID,
                    customData: {
                        type: 'ep', id: ep.ID, title: ep.titre, start: ep.Date_Debut, end: ep.Date_Fin, description: ep.description
                    }
                });
            }
        });
    }

    return { 
        items: new vis.DataSet(itemsData), 
        groups: new vis.DataSet(groupsData) 
    };
}

async function renderTimeline() {
    const container = document.getElementById('timeline-container');
    const { items, groups } = await loadTimelineData();

    // Timeline Configuration to handle stacking intelligently
    const options = {
        stack: true,           // Superpose neatly overlapping events
        zoomMin: 1000 * 60 * 60 * 24 * 30, // Max zoom in (about a month)
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 1000, // Max zoom out (about 1000 years)
        orientation: 'top',    // Time axis placed on top
        locale: 'fr',
        groupOrder: 'order',   // Sort groups by their explicit order property
        subgroupOrder: 'subgroup', // Sort subgroups numerically/alphabetically (subgroup 1 before subgroup 2)
        margin: { item: 10, axis: 5 }
    };

    if (timelineInstance) {
        timelineInstance.destroy(); // Clear previous instance if modifying settings heavily
    }

    // Ensure TooltipManager is initialized
    if(window.TooltipManager) await window.TooltipManager.init();

    timelineInstance = new vis.Timeline(container, items, groups, options);

    // Timeline hover events for custom tooltip
    timelineInstance.on('itemover', function (properties) {
        if (window.TooltipManager) {
            const item = items.get(properties.item);
            if (item && item.customData) {
                window.TooltipManager.show(properties.event, item.customData);
            }
        }
        if (properties.item) {
            document.querySelectorAll('.item-id-' + properties.item).forEach(el => el.classList.add('vis-item-hovered'));
        }
    });

    timelineInstance.on('itemout', function (properties) {
        if (window.TooltipManager) window.TooltipManager.hide();
        if (properties.item) {
            document.querySelectorAll('.item-id-' + properties.item).forEach(el => el.classList.remove('vis-item-hovered'));
        }
    });
}

// Global scope reload triggers
window.reloadTimeline = async function() {
    if (!timelineInstance) return;
    const { items, groups } = await loadTimelineData();
    timelineInstance.setGroups(groups);
    timelineInstance.setItems(items);
    timelineInstance.fit(); // Automatically adjust bounds to fit new items
};

// Start initialization once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Optional CSS injection for timeline item colors
    const style = document.createElement('style');
    style.innerHTML = `
        .timeline-item-event { background-color: #d1ecf1; border-color: #bee5eb; }
        .timeline-item-person { background-color: #fff3cd; border-color: #ffeeba; }
        .timeline-item-politics { background-color: #f8d7da; border-color: #f5c6cb; }

        /* Effet global au survol pour la boîte et le trait vertical */
        .vis-item.vis-item-hovered {
            z-index: 1000 !important;
            border-color: #333 !important;
        }
        .vis-line.vis-item-hovered {
            border-left-color: #333 !important;
            border-left-width: 3px !important;
            opacity: 1 !important;
            z-index: 1000 !important;
        }

        /* Rend le texte entièrement visible pour les événement de longue durée (range) */
        .vis-item.vis-range,
        .vis-item.vis-range .vis-item-overflow,
        .vis-item.vis-range .vis-item-content {
            overflow: visible !important;
        }

    `;
    document.head.appendChild(style);

    // Call render once to build UI
    renderTimeline();
});

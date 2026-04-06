// The backend endpoint defined for reusable code
const SEQ_API = "http://localhost:3000/api";

function parseDateStrSeq(dateStr) {
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return d;
}

window.reloadSequential = async function() {
    await renderSequential();
};

async function loadSequentialData() {
    const showEv = document.getElementById('seq-check-ev').checked;
    const showPe = document.getElementById('seq-check-pe').checked;
    const showEp = document.getElementById('seq-check-ep').checked;

    let allItems = [];

    let [events, persons, politics] = await Promise.all([
        fetch(`${SEQ_API}/entities/Evenement`).then(r => r.json()),
        fetch(`${SEQ_API}/entities/Personnages`).then(r => r.json()),
        fetch(`${SEQ_API}/entities/Entite_politique`).then(r => r.json())
    ]);

    if (typeof filterEntities === 'function') {
        events = filterEntities(events, 'Evenement');
        persons = filterEntities(persons, 'Personnages');
        politics = filterEntities(politics, 'Entite_politique');
    }

    if (showEv) {
        events.forEach(e => {
            const start = parseDateStrSeq(e.Date_Debut);
            if (start) {
                allItems.push({
                    type: 'ev', id: e.ID, title: e.titre, start: start, end: parseDateStrSeq(e.Date_Fin), description: e.description, className: 'seq-item-event'
                });
            }
        });
    }

    if (showPe) {
        persons.forEach(p => {
            const start = parseDateStrSeq(p.Date_Naissance);
            if (start) {
                allItems.push({
                    type: 'pe', id: p.ID, title: `👤 ${p.Nom}`, start: start, end: parseDateStrSeq(p.Date_Mort), description: p.description, className: 'seq-item-person'
                });
            }
        });
    }

    if (showEp) {
        politics.forEach(ep => {
            const start = parseDateStrSeq(ep.Date_Debut);
            if (start) {
                allItems.push({
                    type: 'ep', id: ep.ID, title: `🛡️ ${ep.titre}`, start: start, end: parseDateStrSeq(ep.Date_Fin), description: ep.description, className: 'seq-item-politics'
                });
            }
        });
    }

    allItems.sort((a, b) => a.start - b.start);
    return allItems;
}

async function renderSequential() {
    const container = document.getElementById('sequential-container');
    container.innerHTML = '<p>Chargement...</p>';
    container.style.display = 'block'; 
    container.style.alignItems = 'initial'; 
    
    if(window.TooltipManager) await window.TooltipManager.init();

    const items = await loadSequentialData();
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<p>Aucune donnée à afficher avec ces filtres.</p>';
        return;
    }

    let dateSet = new Set();
    items.forEach(item => {
        if(item.start) dateSet.add(item.start.getTime());
        if(item.end) dateSet.add(item.end.getTime());
    });
    const timepoints = Array.from(dateSet).sort((a,b) => a - b);

    // Compute layout tracks
    items.forEach(item => {
        item.startCol = timepoints.findIndex(t => t === item.start.getTime()) + 2; 
        item.endCol = item.end ? timepoints.findIndex(t => t === item.end.getTime()) + 2 : item.startCol + 1;
        if(item.endCol <= item.startCol) item.endCol = item.startCol + 1; 
    });

    function assignTracks(groupItems) {
        groupItems.sort((a,b) => (a.startCol - b.startCol) || ((b.endCol - b.startCol) - (a.endCol - a.startCol)));
        const tracks = [];
        groupItems.forEach(item => {
            let t = 0;
            while(tracks[t] && tracks[t] > item.startCol) t++;
            tracks[t] = item.endCol; // Register when this track is free
            item.track = t + 1; // +1 to skip label column visually 
        });
        return tracks.length; 
    }

    const politics = items.filter(i => i.type === 'ep');
    const epRows = assignTracks(politics);

    const events = items.filter(i => i.type === 'ev');
    const evRows = assignTracks(events);

    const persons = items.filter(i => i.type === 'pe');
    const peRows = assignTracks(persons);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gap = '15px 10px';
    grid.style.padding = '10px';
    grid.style.gridTemplateColumns = `max-content repeat(${timepoints.length}, minmax(200px, auto))`; 
    
    timepoints.forEach((time, index) => {
        const dateStr = new Date(time).toLocaleDateString();
        const header = document.createElement('div');
        header.style.gridRow = '1';
        header.style.gridColumn = `${index + 2}`;
        header.style.borderLeft = '2px solid #ccc';
        header.style.paddingLeft = '5px';
        header.style.fontWeight = 'bold';
        header.style.color = '#777';
        header.style.fontSize = '0.85em';
        header.innerText = dateStr;
        grid.appendChild(header);
    });

    let currentRow = 2;
    const renderGroup = (groupItems, numRows, labelText) => {
        if(groupItems.length === 0) return;
        let startRow = currentRow;
        let endRow = currentRow + Math.max(numRows, 1) - 1;
        
        const rowLabel = document.createElement('div');
        rowLabel.style.gridColumn = '1';
        rowLabel.style.gridRow = `${startRow} / ${endRow + 1}`;
        rowLabel.style.position = 'sticky';
        rowLabel.style.left = '0';
        rowLabel.style.background = 'white';
        rowLabel.style.zIndex = '10';
        rowLabel.style.fontWeight = 'bold';
        rowLabel.style.padding = '10px 20px 10px 0';
        rowLabel.style.borderRight = '2px solid #555';
        rowLabel.style.display = 'flex';
        rowLabel.style.alignItems = 'center';
        rowLabel.innerText = labelText;
        grid.appendChild(rowLabel);

        groupItems.forEach(item => {
            const div = document.createElement('div');
            div.className = `seq-item ${item.className}`;
            div.style.gridColumn = `${item.startCol} / ${item.endCol}`;
            div.style.gridRow = `${startRow + item.track - 1}`;
            div.style.maxWidth = 'none'; div.style.minWidth = '0'; div.style.margin = '0 5px';
            div.innerHTML = `<div class="seq-title">${item.title}</div><div class="seq-date">${item.start.toLocaleDateString()}${item.end ? ' - ' + item.end.toLocaleDateString() : ''}</div>`;
            div.addEventListener('mouseenter', (e) => { if(window.TooltipManager) window.TooltipManager.show(e, item); });
            div.addEventListener('mouseleave', () => { if(window.TooltipManager) window.TooltipManager.hide(); });
            grid.appendChild(div);
        });

        currentRow += Math.max(numRows, 1);
        const divider = document.createElement('div');
        divider.style.gridColumn = `1 / -1`; divider.style.gridRow = `${currentRow}`;
        divider.style.borderBottom = '2px dashed #ccc'; divider.style.margin = '5px 0 15px 0';
        grid.appendChild(divider);
        currentRow++;
    };

    renderGroup(politics, epRows, "Entités Politiques");
    renderGroup(events, evRows, "Évènements");
    renderGroup(persons, peRows, "Personnages");

    container.appendChild(grid);
}

document.addEventListener("DOMContentLoaded", () => {});

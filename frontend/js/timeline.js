let timelineInstance = null;

const TL_API = "/api";

const timelineRelationMap = {
    Evenement: {
        dateStart: "Date_Debut",
        dateEnd: "Date_Fin",
        links: {
            Evenement: { table: "Lien_evenement_evenement", fkSrc: "ID_evenement_A", fkDest: "ID_evenement_B", symmetric: true },
            Personnages: { table: "Lien_evenement_personnage", fkSrc: "ID_evenement", fkDest: "ID_personnage" },
            Lieu: { table: "Lien_evenement_lieux", fkSrc: "ID_evenement", fkDest: "ID_lieux" },
            Tags: { table: "Lien_evenement_tags", fkSrc: "ID_evenement", fkDest: "ID_tags" },
            Source: { table: "Lien_evenement_sources", fkSrc: "ID_evenement", fkDest: "ID_sources" },
            Entite_politique: { table: "Lien_evenement_entite_politique", fkSrc: "ID_evenement", fkDest: "ID_entite_politique" }
        }
    },
    Personnages: {
        dateStart: "Date_Naissance",
        dateEnd: "Date_Mort",
        links: {
            Personnages: { table: "Lien_personnage_personnage", fkSrc: "ID_personnage_A", fkDest: "ID_personnage_B", symmetric: true },
            Fonctions: { table: "Lien_personnage_fonctions", fkSrc: "ID_personnage", fkDest: "ID_fonctions" },
            Lieu: { table: "Lien_personnage_lieux", fkSrc: "ID_personnage", fkDest: "ID_lieux" },
            Source: { table: "Lien_personnage_sources", fkSrc: "ID_personnage", fkDest: "ID_sources" },
            Entite_politique: { table: "Lien_personnage_entite_politique", fkSrc: "ID_personnage", fkDest: "ID_entite_politique" },
            Tags: { table: "Lien_personnage_tags", fkSrc: "ID_personnage", fkDest: "ID_tags" }
        }
    },
    Entite_politique: {
        dateStart: "Date_Debut",
        dateEnd: "Date_Fin",
        links: {
            Entite_politique: { table: "Lien_entite_politique_entite_politique", fkSrc: "ID_entite_politique_A", fkDest: "ID_entite_politique_B", symmetric: true },
            Fonctions: { table: "Lien_fonctions_entite_politique", fkSrc: "ID_entite_politique", fkDest: "ID_fonctions" },
            Evenement: { table: "Lien_evenement_entite_politique", fkSrc: "ID_entite_politique", fkDest: "ID_evenement" },
            Source: { table: "Lien_entite_politique_sources", fkSrc: "ID_entite_politique", fkDest: "ID_sources" },
            Tags: { table: "Lien_entite_politique_tags", fkSrc: "ID_entite_politique", fkDest: "ID_tags" }
        }
    }
};

const appliesToValues = ["Evenement", "Personnages", "Entite_politique"];

let timelineFilters = [];
const timelineApiCache = {};

function parseDateStr(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function parseId(rawId) {
    const value = Number(rawId);
    return Number.isNaN(value) ? rawId : value;
}

function isShortDuration(start, end) {
    if (!start) return false;
    if (!end) return true;
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    return daysDiff < 30;
}

function getEntityDisplayName(entity) {
    return entity.titre || entity.Nom || entity.Titre || `ID ${entity.ID}`;
}

async function fetchJsonWithCache(url) {
    if (timelineApiCache[url]) {
        return timelineApiCache[url];
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erreur ${response.status} sur ${url}`);
    }
    const data = await response.json();
    timelineApiCache[url] = data;
    return data;
}

async function fetchEntityList(entityType) {
    return fetchJsonWithCache(`${TL_API}/entities/${entityType}`);
}

async function fetchLinkRows(appliesTo, targetType) {
    const relation = timelineRelationMap[appliesTo]?.links?.[targetType];
    if (!relation) return [];
    return fetchJsonWithCache(`${TL_API}/links/${relation.table}`);
}

function toComparableDate(dateValue, fallbackDate) {
    if (dateValue) {
        const parsed = parseDateStr(dateValue);
        if (parsed) return parsed;
    }
    return fallbackDate;
}

function isDateRangeOverlap(entityStart, entityEnd, filterStart, filterEnd) {
    if (!entityStart && !entityEnd) return false;

    const minDate = new Date(-8640000000000000);
    const maxDate = new Date(8640000000000000);
    const eStart = toComparableDate(entityStart, minDate);
    const eEnd = toComparableDate(entityEnd, maxDate);
    const fStart = toComparableDate(filterStart, minDate);
    const fEnd = toComparableDate(filterEnd, maxDate);

    return eStart <= fEnd && fStart <= eEnd;
}

function passesDateFilter(entity, appliesTo, filter) {
    const config = timelineRelationMap[appliesTo];
    if (!config) return true;
    return isDateRangeOverlap(
        entity[config.dateStart],
        entity[config.dateEnd],
        filter.dateStart,
        filter.dateEnd
    );
}

async function getLinkedIdsForEntity(appliesTo, sourceEntityId, targetType) {
    const relation = timelineRelationMap[appliesTo]?.links?.[targetType];
    if (!relation) return [];

    const linkRows = await fetchLinkRows(appliesTo, targetType);
    const linkedIds = new Set();

    for (const row of linkRows) {
        if (row[relation.fkSrc] === sourceEntityId) {
            linkedIds.add(row[relation.fkDest]);
        }
        if (relation.symmetric && row[relation.fkDest] === sourceEntityId) {
            linkedIds.add(row[relation.fkSrc]);
        }
    }

    return Array.from(linkedIds);
}

async function passesLinkFilter(entity, appliesTo, filter) {
    if (!filter.linkTarget || !Array.isArray(filter.linkIds) || filter.linkIds.length === 0) {
        return true;
    }
    const linkedIds = await getLinkedIdsForEntity(appliesTo, entity.ID, filter.linkTarget);
    return filter.linkIds.some((targetId) => linkedIds.includes(targetId));
}

async function applyFiltersForType(entities, appliesTo) {
    const filtersForType = timelineFilters.filter((f) => f.appliesTo === appliesTo);
    if (filtersForType.length === 0) return entities;

    let filtered = entities;
    for (const filter of filtersForType) {
        if (filter.kind === "date") {
            filtered = filtered.filter((entity) => passesDateFilter(entity, appliesTo, filter));
            continue;
        }

        if (filter.kind === "link") {
            const keepFlags = await Promise.all(filtered.map((entity) => passesLinkFilter(entity, appliesTo, filter)));
            filtered = filtered.filter((_, index) => keepFlags[index]);
        }
    }

    return filtered;
}

function createNewTimelineFilter() {
    return {
        id: `timeline_filter_${Math.random().toString(36).slice(2, 10)}`,
        appliesTo: "Evenement",
        kind: "date",
        dateStart: "",
        dateEnd: "",
        linkTarget: "",
        linkIds: []
    };
}

function findTimelineFilter(filterId) {
    return timelineFilters.find((filter) => filter.id === filterId);
}

function getLinkTargetOptions(appliesTo) {
    return Object.keys(timelineRelationMap[appliesTo]?.links || {});
}

async function renderTimelineFilterUI() {
    const container = document.getElementById("timeline-filter-list");
    if (!container) return;

    container.innerHTML = "";

    if (timelineFilters.length === 0) {
        const empty = document.createElement("p");
        empty.className = "timeline-filter-empty";
        empty.textContent = "Aucun filtre actif.";
        container.appendChild(empty);
        return;
    }

    for (const filter of timelineFilters) {
        const row = document.createElement("div");
        row.className = "timeline-filter-row";
        row.id = `timeline-filter-${filter.id}`;

        const appliesToOptions = appliesToValues
            .map((value) => `<option value="${value}" ${filter.appliesTo === value ? "selected" : ""}>${value}</option>`)
            .join("");

        const kindOptions = ["date", "link"]
            .map((value) => `<option value="${value}" ${filter.kind === value ? "selected" : ""}>${value}</option>`)
            .join("");

        let rowHtml = `
            <label>
                Appliquer à
                <select onchange="updateTimelineFilterAppliesTo('${filter.id}', this.value)">
                    ${appliesToOptions}
                </select>
            </label>
            <label>
                Type
                <select onchange="updateTimelineFilterKind('${filter.id}', this.value)">
                    ${kindOptions}
                </select>
            </label>
        `;

        if (filter.kind === "date") {
            rowHtml += `
                <label>
                    Date début
                    <input type="date" value="${filter.dateStart || ""}" onchange="updateTimelineFilterDateStart('${filter.id}', this.value)">
                </label>
                <label>
                    Date fin
                    <input type="date" value="${filter.dateEnd || ""}" onchange="updateTimelineFilterDateEnd('${filter.id}', this.value)">
                </label>
            `;
        }

        if (filter.kind === "link") {
            const targets = getLinkTargetOptions(filter.appliesTo);
            const targetOptions = [`<option value="">Choisir une cible</option>`]
                .concat(
                    targets.map((target) => `<option value="${target}" ${filter.linkTarget === target ? "selected" : ""}>${target}</option>`)
                )
                .join("");

            rowHtml += `
                <label>
                    Cible
                    <select onchange="updateTimelineFilterLinkTarget('${filter.id}', this.value)">
                        ${targetOptions}
                    </select>
                </label>
            `;

            if (filter.linkTarget) {
                const entities = await fetchEntityList(filter.linkTarget);
                const checkboxesHtml = entities
                    .map((entity) => {
                        const checked = filter.linkIds.includes(entity.ID) ? "checked" : "";
                        return `<label class="timeline-filter-dropdown-item"><input type="checkbox" value="${entity.ID}" ${checked} onchange="updateTimelineLinkFilterCheckbox('${filter.id}', this.value, this.checked)"><span>${getEntityDisplayName(entity)}</span></label>`;
                    })
                    .join("");

                const selectedCount = filter.linkIds.length;
                const displayText = selectedCount === 0 ? "- Sélectionnez un élément -" : `${selectedCount} élément${selectedCount > 1 ? "s" : ""} sélectionné${selectedCount > 1 ? "s" : ""}`;

                rowHtml += `
                    <div class="timeline-filter-dropdown-wrapper">
                        <button type="button" class="timeline-filter-dropdown-toggle" onclick="toggleTimelineFilterDropdown('${filter.id}')">${displayText}</button>
                        <div class="timeline-filter-dropdown-panel" data-filter-id="${filter.id}" style="display: none;">
                            <input type="text" class="timeline-filter-dropdown-search" placeholder="Rechercher..." onkeyup="filterTimelineLinkValuesDisplay('${filter.id}', this.value)">
                            <div class="timeline-filter-dropdown-list" data-filter-id="${filter.id}">
                                ${checkboxesHtml}
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        rowHtml += `<button type="button" class="timeline-filter-remove" onclick="removeTimelineFilter('${filter.id}')">Supprimer</button>`;

        row.innerHTML = rowHtml;
        container.appendChild(row);
    }
}

async function loadTimelineData() {
    const showEv = document.getElementById("check-ev").checked;
    const showPe = document.getElementById("check-pe").checked;
    const showEp = document.getElementById("check-ep").checked;

    const itemsData = [];
    const groupsData = [];

    let [events, persons, politics] = await Promise.all([
        fetchEntityList("Evenement"),
        fetchEntityList("Personnages"),
        fetchEntityList("Entite_politique")
    ]);

    events = await applyFiltersForType(events, "Evenement");
    persons = await applyFiltersForType(persons, "Personnages");
    politics = await applyFiltersForType(politics, "Entite_politique");

    if (showEv) {
        groupsData.push({ id: "ev-short", content: "Évènements courts", order: 2 });
        groupsData.push({ id: "ev-long", content: "Évènements longs", order: 1 });
        events.forEach((eventEntity) => {
            const start = parseDateStr(eventEntity.Date_Debut);
            const end = parseDateStr(eventEntity.Date_Fin);

            if (!start) return;

            const shortDuration = isShortDuration(start, end);
            itemsData.push({
                id: `ev_${eventEntity.ID}`,
                group: shortDuration ? "ev-short" : "ev-long",
                content: `<div><b>${eventEntity.titre}</b></div>`,
                start,
                end,
                type: shortDuration ? "box" : "range",
                align: "left",
                className: `timeline-item-event${shortDuration ? " vis-item-short" : ""} item-id-ev_${eventEntity.ID}`,
                customData: {
                    type: "ev",
                    id: eventEntity.ID,
                    title: eventEntity.titre,
                    start: eventEntity.Date_Debut,
                    end: eventEntity.Date_Fin,
                    description: eventEntity.description
                }
            });
        });
    }

    if (showPe) {
        groupsData.push({ id: "pe", content: "Personnages", order: 3 });
        persons.forEach((personEntity) => {
            const start = parseDateStr(personEntity.Date_Naissance);
            const end = parseDateStr(personEntity.Date_Mort);
            if (!start) return;

            const shortDuration = isShortDuration(start, end);
            itemsData.push({
                id: `pe_${personEntity.ID}`,
                group: "pe",
                subgroup: shortDuration ? "1" : "2",
                content: `<div>👤 ${personEntity.Nom}</div>`,
                start,
                end,
                type: shortDuration ? "box" : "range",
                className: `timeline-item-person${shortDuration ? " vis-item-short" : ""} item-id-pe_${personEntity.ID}`,
                customData: {
                    type: "pe",
                    id: personEntity.ID,
                    title: personEntity.Nom,
                    start: personEntity.Date_Naissance,
                    end: personEntity.Date_Mort,
                    description: personEntity.description
                }
            });
        });
    }

    if (showEp) {
        groupsData.push({ id: "ep", content: "Entités Politiques", order: 4 });
        politics.forEach((politicEntity) => {
            const start = parseDateStr(politicEntity.Date_Debut);
            const end = parseDateStr(politicEntity.Date_Fin);
            if (!start) return;

            const shortDuration = isShortDuration(start, end);
            itemsData.push({
                id: `ep_${politicEntity.ID}`,
                group: "ep",
                subgroup: shortDuration ? "1" : "2",
                content: `<div>🛡️ ${politicEntity.titre}</div>`,
                start,
                end,
                type: shortDuration ? "box" : "range",
                className: `timeline-item-politics${shortDuration ? " vis-item-short" : ""} item-id-ep_${politicEntity.ID}`,
                customData: {
                    type: "ep",
                    id: politicEntity.ID,
                    title: politicEntity.titre,
                    start: politicEntity.Date_Debut,
                    end: politicEntity.Date_Fin,
                    description: politicEntity.description
                }
            });
        });
    }

    return {
        items: new vis.DataSet(itemsData),
        groups: new vis.DataSet(groupsData)
    };
}

async function renderTimeline() {
    const container = document.getElementById("timeline-container");
    const { items, groups } = await loadTimelineData();

    const options = {
        stack: true,
        zoomMin: 1000 * 60 * 60 * 24 * 30,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 1000,
        orientation: "top",
        locale: "fr",
        groupOrder: "order",
        subgroupOrder: "subgroup",
        margin: { item: 10, axis: 5 }
    };

    if (timelineInstance) {
        timelineInstance.destroy();
    }

    if (window.TooltipManager) {
        await window.TooltipManager.init();
    }

    timelineInstance = new vis.Timeline(container, items, groups, options);
    window.timelineInstance = timelineInstance;

    timelineInstance.on("itemover", function(properties) {
        if (window.TooltipManager) {
            const item = items.get(properties.item);
            if (item && item.customData) {
                window.TooltipManager.show(properties.event, item.customData);
            }
        }
        if (properties.item) {
            document.querySelectorAll(`.item-id-${properties.item}`).forEach((element) => element.classList.add("vis-item-hovered"));
        }
    });

    timelineInstance.on("itemout", function(properties) {
        if (window.TooltipManager) {
            window.TooltipManager.hide();
        }
        if (properties.item) {
            document.querySelectorAll(`.item-id-${properties.item}`).forEach((element) => element.classList.remove("vis-item-hovered"));
        }
    });
}

window.fitTimeline = function() {
    if (timelineInstance) {
        timelineInstance.fit();
    }
};

window.reloadTimeline = async function() {
    if (!timelineInstance) return;
    const { items, groups } = await loadTimelineData();
    timelineInstance.setGroups(groups);
    timelineInstance.setItems(items);
};

window.addTimelineFilter = async function() {
    timelineFilters.push(createNewTimelineFilter());
    await renderTimelineFilterUI();
    await window.reloadTimeline();
};

window.clearTimelineFilters = async function() {
    timelineFilters = [];
    await renderTimelineFilterUI();
    await window.reloadTimeline();
};

window.removeTimelineFilter = async function(filterId) {
    timelineFilters = timelineFilters.filter((filter) => filter.id !== filterId);
    await renderTimelineFilterUI();
    await window.reloadTimeline();
};

window.updateTimelineFilterAppliesTo = async function(filterId, appliesTo) {
    const filter = findTimelineFilter(filterId);
    if (!filter) return;
    filter.appliesTo = appliesTo;
    filter.linkTarget = "";
    filter.linkIds = [];
    await renderTimelineFilterUI();
    await window.reloadTimeline();
};

window.updateTimelineFilterKind = async function(filterId, kind) {
    const filter = findTimelineFilter(filterId);
    if (!filter) return;
    filter.kind = kind;
    filter.dateStart = "";
    filter.dateEnd = "";
    filter.linkTarget = "";
    filter.linkIds = [];
    await renderTimelineFilterUI();
    await window.reloadTimeline();
};

window.updateTimelineFilterDateStart = async function(filterId, dateStart) {
    const filter = findTimelineFilter(filterId);
    if (!filter) return;
    filter.dateStart = dateStart || "";
    await window.reloadTimeline();
};

window.updateTimelineFilterDateEnd = async function(filterId, dateEnd) {
    const filter = findTimelineFilter(filterId);
    if (!filter) return;
    filter.dateEnd = dateEnd || "";
    await window.reloadTimeline();
};

window.updateTimelineFilterLinkTarget = async function(filterId, linkTarget) {
    const filter = findTimelineFilter(filterId);
    if (!filter) return;
    filter.linkTarget = linkTarget || "";
    filter.linkIds = [];
    await renderTimelineFilterUI();
    await window.reloadTimeline();
};

window.toggleTimelineFilterDropdown = function(filterId) {
    const panel = document.querySelector(`.timeline-filter-dropdown-panel[data-filter-id="${filterId}"]`);
    if (!panel) return;
    const isHidden = panel.style.display === "none";
    panel.style.display = isHidden ? "block" : "none";
    if (isHidden) {
        const search = panel.querySelector(".timeline-filter-dropdown-search");
        if (search) search.focus();
    }
};

window.updateTimelineLinkFilterCheckbox = async function(filterId, value, checked) {
    const filter = findTimelineFilter(filterId);
    if (!filter) return;
    const id = parseId(value);
    if (checked) {
        if (!filter.linkIds.includes(id)) {
            filter.linkIds.push(id);
        }
    } else {
        filter.linkIds = filter.linkIds.filter((item) => item !== id);
    }
    
    const selectedCount = filter.linkIds.length;
    const displayText = selectedCount === 0 ? "- Sélectionnez un élément -" : `${selectedCount} élément${selectedCount > 1 ? "s" : ""} sélectionné${selectedCount > 1 ? "s" : ""}`;
    const wrapper = document.querySelector(`.timeline-filter-dropdown-wrapper:has(.timeline-filter-dropdown-panel[data-filter-id="${filterId}"])`);
    if (wrapper) {
        const toggle = wrapper.querySelector(".timeline-filter-dropdown-toggle");
        if (toggle) toggle.textContent = displayText;
    }
    
    await window.reloadTimeline();
};

window.filterTimelineLinkValuesDisplay = function(filterId, searchText) {
    const container = document.querySelector(`.timeline-filter-dropdown-list[data-filter-id="${filterId}"]`);
    if (!container) return;
    const checkboxLabels = container.querySelectorAll(".timeline-filter-dropdown-item");
    const query = searchText.toLowerCase();
    checkboxLabels.forEach((label) => {
        const text = label.textContent.toLowerCase();
        label.style.display = text.includes(query) ? "" : "none";
    });
};

document.addEventListener("DOMContentLoaded", async () => {
    const style = document.createElement("style");
    style.innerHTML = `
        .timeline-item-event { background-color: #d1ecf1; border-color: #bee5eb; }
        .timeline-item-person { background-color: #fff3cd; border-color: #ffeeba; }
        .timeline-item-politics { background-color: #f8d7da; border-color: #f5c6cb; }

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

        .vis-item.vis-range,
        .vis-item.vis-range .vis-item-overflow,
        .vis-item.vis-range .vis-item-content {
            overflow: visible !important;
        }
    `;
    document.head.appendChild(style);

    await renderTimelineFilterUI();
    await renderTimeline();
    
    document.addEventListener("click", (event) => {
        const dropdowns = document.querySelectorAll(".timeline-filter-dropdown-panel");
        dropdowns.forEach((panel) => {
            const wrapper = panel.parentElement;
            if (!wrapper.contains(event.target)) {
                panel.style.display = "none";
            }
        });
    });
});

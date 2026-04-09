// Global Filters system
let globalLinks = [];
let allEntitiesCache = {};
let filtersReady = false;

// The types we can filter by
const FILTER_TYPES = ['Evenement', 'Personnages', 'Lieu', 'Entite_politique', 'Tags', 'Fonctions', 'Source'];

function initSelect2ForFilters(scope = document) {
    if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.select2) return;

    const $ = window.jQuery;
    const $scope = $(scope);
    const targets = $scope.find('.link-filter, #filter-entity');

    targets.each(function() {
        const $select = $(this);
        if ($select.hasClass('select2-hidden-accessible')) {
            $select.select2('destroy');
        }

        const placeholder = $select.find('option:first').text() || 'Sélectionner';
        $select.select2({
            width: '220px',
            placeholder,
            allowClear: true
        });
    });
}

function buildFilterUI() {
    const containers = document.querySelectorAll('.vis-link-filters');
    containers.forEach(container => {
        container.innerHTML = `
            <b>Filtres par liens :</b>
            ${FILTER_TYPES.map(type => `<select class="link-filter" data-type="${type}" onchange="triggerActiveVisualisationRefresh()"><option value="">-- ${type.replace('_', ' ')} --</option></select>`).join('')}
            <span style="margin-left:15px; border-left: 1px solid #ccc; padding-left: 15px;"><b>Filtres par dates :</b>
            <input type="date" class="date-filter-start" onchange="triggerActiveVisualisationRefresh()"> au
            <input type="date" class="date-filter-end" onchange="triggerActiveVisualisationRefresh()"></span>
            <button onclick="resetActiveFilters(this)" style="margin-left: 10px;">Réinitialiser</button>
        `;
    });

    initSelect2ForFilters();
}

async function initFilters() {
    buildFilterUI();

    // 1. Fetch all link tables
    const linkTables = [
        'Lien_evenement_personnage', 'Lien_evenement_lieux', 'Lien_evenement_tags', 'Lien_evenement_sources',
        'Lien_evenement_evenement',
        'Lien_personnage_fonctions', 'Lien_personnage_lieux', 'Lien_personnage_sources', 'Lien_personnage_personnage',
        'Lien_personnage_entite_politique', 'Lien_personnage_tags',
        'Lien_lieu_entite_politique', 'Lien_fonctions_entite_politique', 'Lien_entite_politique_tags',
        'Lien_image_evenement', 'Lien_image_personnage', 'Lien_image_fonctions', 'Lien_image_tags', 'Lien_image_lieu', 'Lien_image_entite_politique', 'Lien_image_source'
    ];
    
    // Fetch links
    await Promise.all(linkTables.map(async table => {
        try {
            const res = await fetch(`${API}/links/${table}`);
            const data = await res.json();
            if (data && !data.error) {
                globalLinks.push({ table, data });
            }
        } catch(e) {}
    }));

    // Fetch entity lists to populate the filter dropdowns
    await Promise.all(FILTER_TYPES.map(async type => {
        try {
            const res = await fetch(`${API}/entities/${type}`);
            const data = await res.json();
            if (data && !data.error) {
                allEntitiesCache[type] = data;
                populateFilterSelect(type, data);
            }
        } catch(e) {}
    }));

    filtersReady = true;
}

function getDisplayF(type) {
    if (['Personnages'].includes(type)) return 'Nom';
    if (['Evenement', 'Entite_politique', 'Lieu'].includes(type)) return 'titre';
    return 'Titre';
}

function populateFilterSelect(type, data) {
    const displayF = getDisplayF(type);
    let html = `<option value="">-- Tous les ${type} --</option>`;
    data.forEach(d => {
        html += `<option value="${d.ID}">${d[displayF] || 'Sans titre'}</option>`;
    });
    
    document.querySelectorAll(`.link-filter[data-type="${type}"]`).forEach(select => {
        select.innerHTML = html;
    });

    initSelect2ForFilters();
}

function triggerActiveVisualisationRefresh() {
    const activeSection = document.querySelector('.vis-section.active');
    if (!activeSection) return;
    const activeId = activeSection.id;

    if (activeId === 'vis-tableur' && typeof loadTableData === 'function') loadTableData();
    if (activeId === 'vis-timeline' && typeof reloadTimeline === 'function') reloadTimeline();
    if (activeId === 'vis-carte' && typeof initOrRefreshMap === 'function') initOrRefreshMap();
    if (activeId === 'vis-reseau' && typeof loadNetworkData === 'function') loadNetworkData();
}

function resetActiveFilters(btn) {
    const container = btn.closest('.vis-link-filters');
    if (!container) return;
    container.querySelectorAll('.link-filter').forEach(s => {
        s.value = '';
        if (window.jQuery) {
            window.jQuery(s).trigger('change.select2');
        }
    });
    container.querySelector('.date-filter-start').value = '';
    container.querySelector('.date-filter-end').value = '';
    triggerActiveVisualisationRefresh();
}

// Complex function to determine if an entity is linked to the selected filters
function filterEntities(entities, entityType) {
    if (!filtersReady) return entities;
    
    // Get active filters for CURRENT VISUALISATION ONLY
    const activeFilters = {};
    const activeSection = document.querySelector('.vis-section.active');
    let startDateFilter = null;
    let endDateFilter = null;

    if (activeSection) {
        activeSection.querySelectorAll('.link-filter').forEach(select => {
            if(select.value) {
                activeFilters[select.dataset.type] = parseInt(select.value, 10);
            }
        });

        const startInput = activeSection.querySelector('.date-filter-start');
        const endInput = activeSection.querySelector('.date-filter-end');

        if (startInput && startInput.value) {
            startDateFilter = new Date(startInput.value);
            startDateFilter.setHours(0, 0, 0, 0);
        }
        if (endInput && endInput.value) {
            endDateFilter = new Date(endInput.value);
            endDateFilter.setHours(23, 59, 59, 999);
        }
    }

    if (Object.keys(activeFilters).length === 0 && !startDateFilter && !endDateFilter) return entities; // No filters active

    // For each entity, check if it satisfies all active filters
    return entities.filter(ent => {
        // Date filtering logic
        if (startDateFilter || endDateFilter) {
            const startStr = ent.Date_Debut || ent.Date_Naissance || ent.Date_Creation;
            const endStr = ent.Date_Fin || ent.Date_Mort || ent.Date_Dissolution || startStr; // Fallback to start if no end

            if (!startStr) {
                return false; // Si l'entité n'a pas de date et qu'on filtre par date, on l'exclut.
            }

            const itemStart = new Date(startStr);
            const itemEnd = endStr ? new Date(endStr) : itemStart;

            if (startDateFilter && itemEnd < startDateFilter) return false;
            if (endDateFilter && itemStart > endDateFilter) return false;
        }

        for (const [filterType, filterId] of Object.entries(activeFilters)) {
            // If the entity itself is the filtered type, just check if IDs match
            if (entityType === filterType) {
                if (ent.ID !== filterId) return false;
                continue;
            }

            // Check links
            let linked = false;
            // Check all link tables that might connect entityType and filterType
            for (const lt of globalLinks) {
                const tableName = lt.table;
                const rows = lt.data;
                
                // Identify columns for this relation
                const colEntity = `ID_${entityType.toLowerCase()}`;
                const colFilter = `ID_${filterType.toLowerCase()}`;
                
                // Handling specific names
                let actualColEntity = colEntity;
                let actualColFilter = colFilter;
                
                if (tableName === 'Lien_evenement_personnage' && entityType === 'Evenement' && filterType === 'Personnages') {
                    actualColEntity = 'ID_evenement'; actualColFilter = 'ID_personnage';
                } else if (tableName === 'Lien_evenement_personnage' && entityType === 'Personnages' && filterType === 'Evenement') {
                    actualColEntity = 'ID_personnage'; actualColFilter = 'ID_evenement';
                }
                // ... This is a simplified lookup logic. A robust way is to check the keys of a row to see if it links the two.
                
                if (rows.length > 0) {
                    const rowKeys = Object.keys(rows[0]);
                    
                    // Simple heuristic: find a column containing the entity type part, and another for filter type part
                    let ce = rowKeys.find(k => k.toLowerCase().includes(entityType.toLowerCase().replace(/s$/, ''))); 
                    let cf = rowKeys.find(k => k.toLowerCase().includes(filterType.toLowerCase().replace(/s$/, '')));
                    
                    if (tableName === 'Lien_personnage_personnage' && entityType === 'Personnages' && filterType === 'Personnages') {
                        // Internal link
                        linked = rows.some(r => (r.ID_personnage_A == ent.ID && r.ID_personnage_B == filterId) || (r.ID_personnage_B == ent.ID && r.ID_personnage_A == filterId));
                        if(linked) break;
                    } else if (tableName === 'Lien_evenement_evenement' && entityType === 'Evenement' && filterType === 'Evenement') {
                        linked = rows.some(r => (r.ID_evenement_A == ent.ID && r.ID_evenement_B == filterId) || (r.ID_evenement_B == ent.ID && r.ID_evenement_A == filterId));
                        if(linked) break;
                    } else if (ce && cf && ce !== cf) {
                        linked = rows.some(r => r[ce] == ent.ID && r[cf] == filterId);
                        if(linked) break;
                    }
                }
            }
            if (!linked) return false;
        }
        return true;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initFilters();
    initSelect2ForFilters();
});
const API = "/api";
let currentEntity = null;
let currentRows = [];
let cachedLinkData = {};
let cachedLinkIds = {};
let editingId = null;
let pendingLinks = [];
let sortState = { field: null, dir: "asc" };
let selectedRowIds = new Set();
let adminFilters = [];
let nextAdminFilterId = 1;
let lastFilteredRows = [];
let isMobileEntityNavOpen = false;

const mobileEntityNavMedia = window.matchMedia("(max-width: 640px)");

const tablesWithDates = new Set([
  "Lien_personnage_fonctions",
  "Lien_personnage_lieux",
  "Lien_lieu_entite_politique",
  "Lien_fonctions_entite_politique",
  "Lien_entite_politique_entite_politique",
]);

const LINK_TABLE_LABELS = {
  Lien_image_evenement: "Image ↔ Évènement",
  Lien_image_personnage: "Image ↔ Personnage",
  Lien_image_fonctions: "Image ↔ Fonctions",
  Lien_image_tags: "Image ↔ Tags",
  Lien_image_lieu: "Image ↔ Lieu",
  Lien_image_entite_politique: "Image ↔ Entité Politique",
  Lien_image_source: "Image ↔ Source",
  Lien_evenement_personnage: "Évènement ↔ Personnage",
  Lien_evenement_lieux: "Évènement ↔ Lieux",
  Lien_evenement_tags: "Évènement ↔ Tags",
  Lien_evenement_sources: "Évènement ↔ Sources",
  Lien_evenement_entite_politique: "Évènement ↔ Entité Politique",
  Lien_personnage_fonctions: "Personnage ↔ Fonctions",
  Lien_personnage_lieux: "Personnage ↔ Lieux",
  Lien_personnage_sources: "Personnage ↔ Sources",
  Lien_personnage_personnage: "Personnage ↔ Personnage",
  Lien_lieu_entite_politique: "Lieu ↔ Entité Politique",
  Lien_lieu_sources: "Lieu ↔ Sources",
  Lien_personnage_entite_politique: "Personnage ↔ Entité Politique",
  Lien_evenement_evenement: "Évènement ↔ Évènement",
  Lien_fonctions_entite_politique: "Fonctions ↔ Entité Politique",
  Lien_fonctions_sources: "Fonctions ↔ Sources",
  Lien_personnage_tags: "Personnage ↔ Tags",
  Lien_entite_politique_tags: "Entité Politique ↔ Tags",
  Lien_entite_politique_sources: "Entité Politique ↔ Sources",
  Lien_entite_politique_entite_politique: "Entité Politique ↔ Entité Politique"
};

const datedTablesWithRowIdDelete = new Set([
  "Lien_personnage_fonctions",
  "Lien_personnage_lieux",
  "Lien_lieu_entite_politique",
  "Lien_fonctions_entite_politique",
  "Lien_entite_politique_entite_politique",
]);

const bulkCreateLinkTableConfig = {
  Lien_image_evenement: { fkSrc: "ID_image", fkDest: "ID_evenement" },
  Lien_image_personnage: { fkSrc: "ID_image", fkDest: "ID_personnage" },
  Lien_image_fonctions: { fkSrc: "ID_image", fkDest: "ID_fonctions" },
  Lien_image_tags: { fkSrc: "ID_image", fkDest: "ID_tags" },
  Lien_image_lieu: { fkSrc: "ID_image", fkDest: "ID_lieu" },
  Lien_image_entite_politique: { fkSrc: "ID_image", fkDest: "ID_entite_politique" },
  Lien_image_source: { fkSrc: "ID_image", fkDest: "ID_source" },
  Lien_evenement_personnage: { fkSrc: "ID_evenement", fkDest: "ID_personnage" },
  Lien_evenement_lieux: { fkSrc: "ID_evenement", fkDest: "ID_lieux" },
  Lien_evenement_tags: { fkSrc: "ID_evenement", fkDest: "ID_tags" },
  Lien_evenement_sources: { fkSrc: "ID_evenement", fkDest: "ID_sources" },
  Lien_evenement_entite_politique: { fkSrc: "ID_evenement", fkDest: "ID_entite_politique" },
  Lien_personnage_fonctions: { fkSrc: "ID_personnage", fkDest: "ID_fonctions" },
  Lien_personnage_lieux: { fkSrc: "ID_personnage", fkDest: "ID_lieux" },
  Lien_personnage_sources: { fkSrc: "ID_personnage", fkDest: "ID_sources" },
  Lien_personnage_personnage: { fkSrc: "ID_personnage_A", fkDest: "ID_personnage_B" },
  Lien_lieu_entite_politique: { fkSrc: "ID_lieu", fkDest: "ID_entite_politique" },
  Lien_lieu_sources: { fkSrc: "ID_lieu", fkDest: "ID_sources" },
  Lien_personnage_entite_politique: { fkSrc: "ID_personnage", fkDest: "ID_entite_politique" },
  Lien_evenement_evenement: { fkSrc: "ID_evenement_A", fkDest: "ID_evenement_B" },
  Lien_fonctions_entite_politique: { fkSrc: "ID_fonctions", fkDest: "ID_entite_politique" },
  Lien_fonctions_sources: { fkSrc: "ID_fonctions", fkDest: "ID_sources" },
  Lien_personnage_tags: { fkSrc: "ID_personnage", fkDest: "ID_tags" },
  Lien_entite_politique_tags: { fkSrc: "ID_entite_politique", fkDest: "ID_tags" },
  Lien_entite_politique_sources: { fkSrc: "ID_entite_politique", fkDest: "ID_sources" },
  Lien_entite_politique_entite_politique: { fkSrc: "ID_entite_politique_A", fkDest: "ID_entite_politique_B" },
};

let bulkCreateGroups = [];
let bulkCreateLinks = [];
let nextBulkCreateGroupId = 1;
let nextBulkCreateEntityId = 1;
let nextBulkCreateLinkId = 1;
let nextBulkCreateGroupLinkId = 1;
let bulkCreateEntityOptionsCache = {};
let bulkCreateValidationErrors = [];

const adminViewStateStorageKey = "shitstoire.adminViewState.v1";

let linkDateFieldsTouched = false;
let linkTargetRowsCache = {};

function cloneAdminFilters(filters) {
  return (Array.isArray(filters) ? filters : []).map((filter) => ({
    ...filter,
    targetIds: Array.isArray(filter.targetIds) ? [...filter.targetIds] : [],
  }));
}

function readAdminViewState() {
  try {
    const raw = window.localStorage.getItem(adminViewStateStorageKey);
    if (!raw) return { version: 1, lastEntity: null, entities: {} };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return { version: 1, lastEntity: null, entities: {} };
    }

    parsed.entities = parsed.entities && typeof parsed.entities === "object" ? parsed.entities : {};
    return parsed;
  } catch (err) {
    return { version: 1, lastEntity: null, entities: {} };
  }
}

function writeAdminViewState(state) {
  try {
    window.localStorage.setItem(adminViewStateStorageKey, JSON.stringify(state));
  } catch (err) {}
}

function persistAdminViewState() {
  if (!currentEntity) return;

  const state = readAdminViewState();
  state.version = 1;
  state.lastEntity = currentEntity;
  state.entities = state.entities && typeof state.entities === "object" ? state.entities : {};
  state.entities[currentEntity] = {
    filters: cloneAdminFilters(adminFilters),
    search: document.getElementById("admin-search-input")?.value || "",
    sortState: { ...sortState },
  };

  writeAdminViewState(state);
}

function restoreAdminViewState(entity) {
  const state = readAdminViewState();
  const entityState = state.entities?.[entity] || null;

  if (!entityState) {
    adminFilters = [];
    nextAdminFilterId = 1;
    sortState = { field: null, dir: "asc" };
    const searchInput = document.getElementById("admin-search-input");
    if (searchInput) searchInput.value = "";
    return;
  }

  adminFilters = cloneAdminFilters(entityState.filters);
  nextAdminFilterId = adminFilters.reduce((max, filter) => Math.max(max, Number(filter.id) || 0), 0) + 1;
  sortState = entityState.sortState && typeof entityState.sortState === "object"
    ? { field: entityState.sortState.field || null, dir: entityState.sortState.dir === "desc" ? "desc" : "asc" }
    : { field: null, dir: "asc" };

  const searchInput = document.getElementById("admin-search-input");
  if (searchInput) searchInput.value = entityState.search || "";
}

function markLinkDateFieldsTouched() {
  linkDateFieldsTouched = true;
}

function resetLinkDateFieldsTouched() {
  linkDateFieldsTouched = false;
}

function bindLinkDateTouchTracking() {
  ["link-date-debut", "link-date-fin", "link-precision-debut", "link-precision-fin"].forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;
    field.addEventListener("input", markLinkDateFieldsTouched);
    field.addEventListener("change", markLinkDateFieldsTouched);
  });
}

function getPoliticalEntityDateRangeFromValues(values) {
  if (!values) return null;

  return {
    start: values.Date_Debut || "",
    precisionStart: values.precision_Debut || getDefaultPrecision(),
    end: values.Date_Fin || "",
    precisionEnd: values.precision_Fin || getDefaultPrecision(),
  };
}

function getCurrentPoliticalEntityDateRange() {
  if (currentEntity !== "Entite_politique") return null;

  return getPoliticalEntityDateRangeFromValues({
    Date_Debut: document.getElementById("input_Date_Debut")?.value || "",
    precision_Debut: document.getElementById("input_precision_Debut")?.value || getDefaultPrecision(),
    Date_Fin: document.getElementById("input_Date_Fin")?.value || "",
    precision_Fin: document.getElementById("input_precision_Fin")?.value || getDefaultPrecision(),
  });
}

function getPoliticalEntityDateRangeFromRow(row) {
  if (!row) return null;
  return getPoliticalEntityDateRangeFromValues(row);
}

function compareDateStrings(a, b) {
  const aDate = parseDateOrNull(a);
  const bDate = parseDateOrNull(b);
  if (!aDate && !bDate) return 0;
  if (!aDate) return -1;
  if (!bDate) return 1;
  return aDate.getTime() - bDate.getTime();
}

function buildPoliticalLinkDateSuggestion(currentRange, targetRange) {
  if (!currentRange && !targetRange) return null;

  if (!currentRange) return targetRange;
  if (!targetRange) return currentRange;

  const startCandidates = [currentRange.start, targetRange.start].filter(Boolean);
  const endCandidates = [currentRange.end, targetRange.end].filter(Boolean);

  const start = startCandidates.reduce((best, candidate) => {
    if (!best) return candidate;
    return compareDateStrings(candidate, best) > 0 ? candidate : best;
  }, "");

  const end = endCandidates.reduce((best, candidate) => {
    if (!best) return candidate;
    return compareDateStrings(candidate, best) < 0 ? candidate : best;
  }, "");

  if (start && end && compareDateStrings(start, end) > 0) {
    return currentRange;
  }

  const precisionStart = start === currentRange.start
    ? currentRange.precisionStart
    : targetRange.precisionStart;
  const precisionEnd = end === currentRange.end
    ? currentRange.precisionEnd
    : targetRange.precisionEnd;

  return {
    start,
    precisionStart: precisionStart || getDefaultPrecision(),
    end,
    precisionEnd: precisionEnd || getDefaultPrecision(),
  };
}

function applyLinkDateSuggestion(range) {
  const dateDebut = document.getElementById("link-date-debut");
  const dateFin = document.getElementById("link-date-fin");
  const precisionDebut = document.getElementById("link-precision-debut");
  const precisionFin = document.getElementById("link-precision-fin");

  if (!dateDebut || !dateFin || !precisionDebut || !precisionFin || !range) return;
  if (linkDateFieldsTouched) return;

  dateDebut.value = range.start || "";
  dateFin.value = range.end || "";
  precisionDebut.value = range.precisionStart || getDefaultPrecision();
  precisionFin.value = range.precisionEnd || getDefaultPrecision();
}

function refreshLinkDateSuggestion() {
  const targetType = document.getElementById("link-target-type")?.value;
  const targetId = document.getElementById("link-target-id")?.value;
  if (!targetType || !targetId) return;

  const relation = getRelationByTarget(targetType);
  if (!relation || !tablesWithDates.has(relation.table)) return;

  const targetRow = (linkTargetRowsCache[targetType] || []).find((row) => String(row.ID) === String(targetId));
  const targetRange = targetType === "Entite_politique" ? getPoliticalEntityDateRangeFromRow(targetRow) : null;
  const currentRange = getCurrentPoliticalEntityDateRange();

  if (currentEntity === "Entite_politique" && targetType === "Entite_politique") {
    applyLinkDateSuggestion(buildPoliticalLinkDateSuggestion(currentRange, targetRange));
    return;
  }

  if (currentEntity === "Entite_politique") {
    applyLinkDateSuggestion(currentRange);
    return;
  }

  if (targetType === "Entite_politique") {
    applyLinkDateSuggestion(targetRange);
  }
}

function resetLinkDateFields() {
  const dateDebut = document.getElementById("link-date-debut");
  const dateFin = document.getElementById("link-date-fin");
  const precisionDebut = document.getElementById("link-precision-debut");
  const precisionFin = document.getElementById("link-precision-fin");

  if (dateDebut) dateDebut.value = "";
  if (dateFin) dateFin.value = "";
  if (precisionDebut) precisionDebut.value = getDefaultPrecision();
  if (precisionFin) precisionFin.value = getDefaultPrecision();
  resetLinkDateFieldsTouched();
}

async function ensureAdminSession() {
  try {
    const res = await fetch(`${API}/admin/me`);
    if (res.ok) return true;
  } catch (e) {}

  const next = encodeURIComponent(window.location.pathname || "/admin.html");
  window.location.replace(`/admin-login.html?next=${next}`);
  return false;
}

async function logoutAdmin() {
  try {
    await fetch(`${API}/admin/logout`, { method: "POST" });
  } catch (e) {}

  window.location.replace("/admin-login.html");
}

window.logoutAdmin = logoutAdmin;

function initSelect2Admin(scope = document) {
  if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.select2) return;

  const $ = window.jQuery;
  const $scope = $(scope);
  const targets = $scope.find(
    "#link-target-type, #link-target-id, #link-target-mode, .admin-filter-kind, .admin-filter-target-type, .admin-filter-target-values, #bulk-link-target-type, #bulk-link-target-ids, .bulk-create-entity-table, .bulk-create-link-table, .bulk-create-ref-mode, .bulk-create-ref-select",
  );

  targets.each(function () {
    const $select = $(this);
    if ($select.hasClass("select2-hidden-accessible")) {
      $select.select2("destroy");
    }

    const placeholder = $select.find("option:first").text() || "Sélectionner";
    $select.select2({
      width: "260px",
      placeholder,
      allowClear: true,
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDefaultPrecision() {
  return "Jour";
}

function clearLinkTransientFields(resetTarget = false) {
  const desc = document.getElementById("link-description");
  const dateDebut = document.getElementById("link-date-debut");
  const dateFin = document.getElementById("link-date-fin");
  const precisionDebut = document.getElementById("link-precision-debut");
  const precisionFin = document.getElementById("link-precision-fin");
  const targetId = document.getElementById("link-target-id");

  if (desc) desc.value = "";
  if (dateDebut) dateDebut.value = "";
  if (dateFin) dateFin.value = "";
  if (precisionDebut) precisionDebut.value = getDefaultPrecision();
  if (precisionFin) precisionFin.value = getDefaultPrecision();
  resetLinkDateFieldsTouched();
  if (resetTarget && targetId) targetId.innerHTML = '<option value="">-- Sélectionnez un élément --</option>';
}

function getEntityDateColumns(entityName) {
  if (entityName === "Evenement" || entityName === "Entite_politique") {
    return { start: "Date_Debut", end: "Date_Fin" };
  }
  if (entityName === "Personnages") {
    return { start: "Date_Naissance", end: "Date_Mort" };
  }
  return null;
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function rowMatchesDateRange(row, entityName, startFilter, endFilter) {
  const cols = getEntityDateColumns(entityName);
  if (!cols) return true;

  const start = parseDateOrNull(row[cols.start]);
  const end = parseDateOrNull(row[cols.end]) || start;

  if (!start) return false;
  if (startFilter && end && end < startFilter) return false;
  if (endFilter && start > endFilter) return false;
  return true;
}

function getCurrentEntityRelations() {
  return relationMapClient[currentEntity] || [];
}

function getVisibleRowIds() {
  return lastFilteredRows.map((row) => Number(row.ID));
}

function updateBulkButtonState() {
  const bulkBtn = document.getElementById("btn-bulk-link");
  if (!bulkBtn) return;
  bulkBtn.style.display = currentEntity ? "inline-block" : "none";
  bulkBtn.disabled = selectedRowIds.size === 0;
  bulkBtn.textContent = selectedRowIds.size > 0
    ? `Édition de liens en masse (${selectedRowIds.size})`
    : "Édition de liens en masse";
}

function pruneSelectionToCurrentRows() {
  const allowed = new Set((currentRows || []).map((row) => Number(row.ID)));
  selectedRowIds = new Set([...selectedRowIds].filter((id) => allowed.has(Number(id))));
}

// Form template definition per entity
const schemas = {
  Evenement: [
    { name: "titre", label: "Titre", type: "text" },
    { name: "Date_Debut", label: "Date Début", type: "text" },
    {
      name: "precision_Debut",
      label: "Précision",
      type: "select",
      opts: ["Jour", "Mois", "Année"],
    },
    { name: "Date_Fin", label: "Date Fin", type: "text" },
    {
      name: "precision_Fin",
      label: "Précision",
      type: "select",
      opts: ["Jour", "Mois", "Année"],
    },
    { name: "description", label: "Description", type: "textarea" },
  ],
  Personnages: [
    { name: "Nom", label: "Nom", type: "text" },
    { name: "Date_Naissance", label: "Date Naissance", type: "text" },
    {
      name: "precision_Naissance",
      label: "Précision",
      type: "select",
      opts: ["Jour", "Mois", "Année"],
    },
    { name: "Date_Mort", label: "Date Mort", type: "text" },
    {
      name: "precision_Mort",
      label: "Précision",
      type: "select",
      opts: ["Jour", "Mois", "Année"],
    },
    { name: "description", label: "Description", type: "textarea" },
  ],
  Lieu: [
    { name: "titre", label: "Titre", type: "text" },
    {
      name: "Coordonne",
      label: "Coordonnées (GPS format : Latitude,Longitude)",
      type: "text",
    },
    { name: "description", label: "Description", type: "textarea" },
    { name: "type", label: "Type (ex: ville, pays..)", type: "text" },
  ],
  Entite_politique: [
    { name: "titre", label: "Titre", type: "text" },
    { name: "Date_Debut", label: "Date Création", type: "text" },
    {
      name: "precision_Debut",
      label: "Précision",
      type: "select",
      opts: ["Jour", "Mois", "Année"],
    },
    { name: "Date_Fin", label: "Date Chute", type: "text" },
    {
      name: "precision_Fin",
      label: "Précision",
      type: "select",
      opts: ["Jour", "Mois", "Année"],
    },
    { name: "description", label: "Description", type: "textarea" },
  ],
  Fonctions: [
    { name: "Titre", label: "Titre", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
  Tags: [{ name: "Titre", label: "Titre", type: "text" }],
  Source: [
    { name: "Titre", label: "Titre", type: "text" },
    { name: "lien", label: "Lien Web / Info livre", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
  Image: [
    { name: "Titre", label: "Titre", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};

async function loadEntity(entity) {
  const entityChanged = currentEntity !== entity;
  currentEntity = entity;
  editingId = null;
  sortState = { field: null, dir: "asc" };
  pendingLinks = [];
  if (entityChanged) {
    selectedRowIds.clear();
  }
  document.getElementById("current-entity-title").innerText =
    "Gestion - " + entity;

  const headersTr = document.getElementById("table-headers");
  const tbody = document.getElementById("table-body");
  headersTr.innerHTML = "<th>Chargement...</th>";
  tbody.innerHTML = "";

  document.getElementById("btn-add-new").style.display = "inline-block";
  document.getElementById("admin-search-input").style.display = "inline-block";
  document.getElementById("btn-add-filter").style.display = "inline-block";
  document.getElementById("btn-clear-filters").style.display = "inline-block";
  document.getElementById("btn-bulk-create").style.display = "inline-block";
  document.getElementById("admin-filters-panel").style.display = "block";
  document.getElementById("form-container").style.display = "none";
  document.getElementById("data-table-container").style.display = "block";
  document.getElementById("bulk-editor-container").style.display = "none";
  document.getElementById("bulk-create-container").style.display = "none";

  restoreAdminViewState(entity);

  const res = await fetch(`${API}/entities/${entity}`);
  currentRows = await res.json();

  // Attempt to load associated links for preview in table
  const relationships = relationMapClient[entity] || [];
  const linkData = {};
  const linkIds = {};
  for (let r of relationships) {
    linkData[r.target] = [];
    linkIds[r.target] = [];
    try {
      const tableRes = await fetch(`${API}/links/${r.table}`);
      const tableLinks = await tableRes.json();

      const targetRes = await fetch(`${API}/entities/${r.target}`);
      const targets = await targetRes.json();

      const displayF = getDisplayField(r.target);

      tableLinks.forEach((l) => {
        const srcValue = l[r.fkSrc];
        const destValue = l[r.fkDest];
        if (srcValue === undefined || srcValue === null || destValue === undefined || destValue === null) {
          return;
        }

        if (!linkData[r.target][srcValue]) linkData[r.target][srcValue] = [];
        if (!linkIds[r.target][srcValue]) linkIds[r.target][srcValue] = [];

        const directTarget = targets.find((t) => Number(t.ID) === Number(destValue));
        if (directTarget) {
          linkData[r.target][srcValue].push(directTarget[displayF]);
        }
        linkIds[r.target][srcValue].push(Number(destValue));

        if (symmetricLinkTablesClient.has(r.table)) {
          if (!linkData[r.target][destValue]) linkData[r.target][destValue] = [];
          if (!linkIds[r.target][destValue]) linkIds[r.target][destValue] = [];

          const reverseTarget = targets.find((t) => Number(t.ID) === Number(srcValue));
          if (reverseTarget) {
            linkData[r.target][destValue].push(reverseTarget[displayF]);
          }
          linkIds[r.target][destValue].push(Number(srcValue));
        }
      });
    } catch (e) {}
  }
  
  cachedLinkData = linkData;
  cachedLinkIds = linkIds;
  renderAdminFilters();
  applyAllAdminFilters();
  updateBulkButtonState();

  persistAdminViewState();

  if (mobileEntityNavMedia.matches) {
    setMobileEntityNavOpen(false);
  }
}

function compareValues(a, b, fieldName) {
  const aVal = a?.[fieldName] ?? "";
  const bVal = b?.[fieldName] ?? "";

  if (fieldName.includes("Date")) {
    const aDate = aVal ? new Date(aVal).getTime() : Number.NEGATIVE_INFINITY;
    const bDate = bVal ? new Date(bVal).getTime() : Number.NEGATIVE_INFINITY;
    return aDate - bDate;
  }

  const aNum = Number(aVal);
  const bNum = Number(bVal);
  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);
  if (aIsNum && bIsNum) {
    return aNum - bNum;
  }

  return String(aVal).localeCompare(String(bVal), "fr", { sensitivity: "base" });
}

function getSortedRows(rows) {
  const copied = [...rows];
  if (!sortState.field) return copied;

  copied.sort((a, b) => {
    const cmp = compareValues(a, b, sortState.field);
    return sortState.dir === "asc" ? cmp : -cmp;
  });

  return copied;
}

function toggleSort(fieldName) {
  if (sortState.field === fieldName) {
    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  } else {
    sortState.field = fieldName;
    sortState.dir = "asc";
  }
  applyAllAdminFilters();
}

window.toggleSort = toggleSort;

function renderAdminTable(rowsToRender) {
  const headersTr = document.getElementById("table-headers");
  const tbody = document.getElementById("table-body");
  
  if (!schemas[currentEntity]) return;
  const relationships = relationMapClient[currentEntity] || [];

  // RENDER Table
  let extraHeaders = relationships
    .map((r) => `<th>Liens: ${r.target}</th>`)
    .join("");
  const fieldHeaders = schemas[currentEntity]
    .map((f) => {
      const marker = sortState.field === f.name ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";
      return `<th class="sortable" onclick="toggleSort('${f.name}')">${escapeHtml(f.label)}${marker}</th>`;
    })
    .join("");

  const visibleIds = new Set((rowsToRender || []).map((row) => Number(row.ID)));
  const allVisibleSelected = visibleIds.size > 0 && [...visibleIds].every((id) => selectedRowIds.has(id));

  headersTr.innerHTML =
    `<th><input type="checkbox" id="select-all-rows" ${allVisibleSelected ? "checked" : ""}></th>` +
    fieldHeaders +
    extraHeaders +
    `<th>Actions</th>`;

  const selectAll = document.getElementById("select-all-rows");
  if (selectAll) {
    selectAll.addEventListener("change", (event) => {
      if (event.target.checked) {
        visibleIds.forEach((id) => selectedRowIds.add(id));
      } else {
        visibleIds.forEach((id) => selectedRowIds.delete(id));
      }
      updateBulkButtonState();
      renderBulkOverrides();
    });
  }

  tbody.innerHTML = "";

  if (!Array.isArray(rowsToRender) || rowsToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${schemas[currentEntity].length + relationships.length + 2}">Aucune donnée trouvée.</td></tr>`;
    return;
  }

  const sorted = getSortedRows(rowsToRender);

  sorted.forEach((row) => {
    const tr = document.createElement("tr");

    let extraCols = relationships
      .map((r) => {
        const links = cachedLinkData[r.target] && cachedLinkData[r.target][row.ID] ? cachedLinkData[r.target][row.ID] : [];
        return `<td><small>${links.join(", ")}</small></td>`;
      })
      .join("");

    const baseCols = schemas[currentEntity]
      .map((f) => {
        if (currentEntity === "Image" && f.name === "Titre") {
          const thumb = row.chemin_fichier
            ? `<img src="${escapeHtml(row.chemin_fichier)}" alt="miniature" style="width:42px;height:42px;object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle;">`
            : "";
          return `<td>${thumb}${escapeHtml(row[f.name] || "")}</td>`;
        }
        return `<td>${escapeHtml(row[f.name] || "")}</td>`;
      })
      .join("");

    tr.innerHTML =
      `<td><input type="checkbox" class="row-selector" data-id="${Number(row.ID)}" ${selectedRowIds.has(Number(row.ID)) ? "checked" : ""}></td>` +
      baseCols +
      extraCols +
      `<td><button onclick="editRow(${row.ID})">Éditer/Lier</button> <button onclick="deleteRow(${row.ID})">Supprimer</button></td>`;

    const selector = tr.querySelector(".row-selector");
    if (selector) {
      selector.addEventListener("change", (event) => {
        const rowId = Number(event.target.dataset.id);
        if (event.target.checked) selectedRowIds.add(rowId);
        else selectedRowIds.delete(rowId);
        updateBulkButtonState();
        renderBulkOverrides();
      });
    }

    tbody.appendChild(tr);
  });
}

function filterAdminTable() {
  applyAllAdminFilters();
}

function applyAllAdminFilters() {
  if (!currentEntity || !Array.isArray(currentRows)) return;

  const q = document.getElementById("admin-search-input").value.toLowerCase();
  const relationships = relationMapClient[currentEntity] || [];

  let filtered = currentRows.filter((row) => {
    // Check main entity fields
    const schemaMatch = schemas[currentEntity].some((f) => {
      const val = row[f.name];
      return val && val.toString().toLowerCase().includes(q);
    });
    
    if (schemaMatch) return true;

    // Check associated link display names
    const linkMatch = relationships.some((r) => {
        const links = cachedLinkData[r.target] && cachedLinkData[r.target][row.ID] ? cachedLinkData[r.target][row.ID] : [];
        return links.some((linkName) => linkName.toLowerCase().includes(q));
    });
    
    return linkMatch;
  });

  const dateFilters = adminFilters.filter((f) => f.kind === "date");
  const linkFilters = adminFilters.filter((f) => f.kind === "link");

  dateFilters.forEach((filter) => {
    const startDate = parseDateOrNull(filter.startDate);
    const endDate = parseDateOrNull(filter.endDate);
    if (!startDate && !endDate) return;
    filtered = filtered.filter((row) => rowMatchesDateRange(row, currentEntity, startDate, endDate));
  });

  linkFilters.forEach((filter) => {
    if (!filter.targetType || !Array.isArray(filter.targetIds) || filter.targetIds.length === 0) return;
    filtered = filtered.filter((row) => {
      const linkedIds = (cachedLinkIds[filter.targetType] && cachedLinkIds[filter.targetType][row.ID]) || [];
      const linkedSet = new Set(linkedIds.map((id) => Number(id)));
      return filter.targetIds.some((id) => linkedSet.has(Number(id)));
    });
  });

  lastFilteredRows = filtered;
  pruneSelectionToCurrentRows();
  renderAdminTable(filtered);
  renderAdminFilterSummary(filtered.length, currentRows.length);
  updateBulkButtonState();
  persistAdminViewState();
}

async function readApiResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await res.json();
    json._status = res.status;
    json._url = res.url;
    json._contentType = contentType;
    return json;
  }

  const text = await res.text();
  return {
    error: text || `Réponse non JSON (HTTP ${res.status})`,
    _rawText: text,
    _status: res.status,
    _url: res.url,
    _contentType: contentType,
  };
}

function ensureBulkResponse(payload, contextLabel) {
  if (payload && typeof payload.successCount === "number" && typeof payload.failureCount === "number") {
    return payload;
  }

  if (payload && payload.error) {
    const raw = String(payload._rawText || payload.error || "").trim();
    const compact = raw.replace(/\s+/g, " ").slice(0, 180);
    if (compact.startsWith("<!DOCTYPE") || compact.startsWith("<html")) {
      const diagnostics = [
        `${contextLabel}: le serveur a renvoyé une page HTML au lieu de JSON.`,
        `URL appelée: ${payload._url || "inconnue"}`,
        `Origine page: ${window.location.origin}`,
        `Content-Type: ${payload._contentType || "inconnu"}`,
      ];
      if (window.location.hostname === "localhost" && window.location.port !== "3000") {
        diagnostics.push("Cause probable: admin ouverte hors backend Node. Ouvre http://localhost:3000/admin.html");
      }
      throw new Error(diagnostics.join(" "));
    }
    throw new Error(`${contextLabel}: ${compact || "réponse invalide du serveur"}`);
  }

  throw new Error(`${contextLabel}: réponse bulk invalide (compteurs manquants).`);
}

function renderAdminFilterSummary(filteredCount, totalCount) {
  const summary = document.getElementById("admin-filter-summary");
  if (!summary) return;
  summary.textContent = `${filteredCount} résultat(s) sur ${totalCount}. ${selectedRowIds.size} ligne(s) sélectionnée(s).`;
}

function updateAdminFilterTargetValues(id, selectEl) {
  const filter = adminFilters.find((item) => item.id === id);
  if (!filter || !selectEl) return;
  filter.targetIds = Array.from(selectEl.selectedOptions).map((opt) => Number(opt.value));
  applyAllAdminFilters();
}

async function addAdminFilterRule() {
  if (!currentEntity) return;
  adminFilters.push({ id: nextAdminFilterId++, kind: "date", startDate: "", endDate: "", targetType: "", targetIds: [] });
  await renderAdminFilters();
  applyAllAdminFilters();
}

async function renderAdminFilters() {
  const list = document.getElementById("admin-filters-list");
  if (!list) return;

  if (adminFilters.length === 0) {
    list.innerHTML = "<div class=\"admin-filter-row\">Aucun filtre actif.</div>";
    initSelect2Admin();
    return;
  }

  list.innerHTML = adminFilters
    .map((filter) => {
      const relationOptions = getCurrentEntityRelations()
        .map((rel) => `<option value=\"${escapeHtml(rel.target)}\" ${rel.target === filter.targetType ? "selected" : ""}>${escapeHtml(rel.target)}</option>`)
        .join("");

      return `<div class="admin-filter-row" data-filter-id="${filter.id}">
        <b>Filtre</b>
        <select class="admin-filter-kind" onchange="updateAdminFilterKind(${filter.id}, this.value)">
          <option value="date" ${filter.kind === "date" ? "selected" : ""}>Date</option>
          <option value="link" ${filter.kind === "link" ? "selected" : ""}>Lien</option>
        </select>
        <span class="admin-filter-date" style="display:${filter.kind === "date" ? "inline-flex" : "none"}; gap:8px; align-items:center;">
          <input type="date" value="${escapeHtml(filter.startDate || "")}" onchange="updateAdminFilterDate(${filter.id}, 'startDate', this.value)">
          <span>à</span>
          <input type="date" value="${escapeHtml(filter.endDate || "")}" onchange="updateAdminFilterDate(${filter.id}, 'endDate', this.value)">
        </span>
        <span class="admin-filter-link" style="display:${filter.kind === "link" ? "inline-flex" : "none"}; gap:8px; align-items:center;">
          <select class="admin-filter-target-type" onchange="updateAdminFilterTargetType(${filter.id}, this.value)">
            <option value="">Type lié</option>
            ${relationOptions}
          </select>
          <select class="admin-filter-target-values" multiple data-filter-id="${filter.id}" onchange="updateAdminFilterTargetValues(${filter.id}, this)"></select>
        </span>
        <button type="button" onclick="removeAdminFilterRule(${filter.id})">Retirer</button>
      </div>`;
    })
    .join("");

  await populateAdminFilterTargetValues();
  initSelect2Admin();
}

async function populateAdminFilterTargetValues() {
  const selectors = document.querySelectorAll(".admin-filter-target-values");
  for (const select of selectors) {
    const filterId = Number(select.dataset.filterId);
    const filter = adminFilters.find((item) => item.id === filterId);
    if (!filter || filter.kind !== "link" || !filter.targetType) {
      select.innerHTML = "";
      continue;
    }

    const res = await fetch(`${API}/entities/${filter.targetType}`);
    const data = await res.json();
    const displayF = getDisplayField(filter.targetType);
    select.innerHTML = data
      .map((row) => {
        const selected = filter.targetIds.includes(Number(row.ID)) ? "selected" : "";
        return `<option value="${Number(row.ID)}" ${selected}>${escapeHtml(row[displayF] || "Sans nom")}</option>`;
      })
      .join("");
  }
}

function updateAdminFilterKind(id, kind) {
  const filter = adminFilters.find((item) => item.id === id);
  if (!filter) return;
  filter.kind = kind;
  if (kind === "date") {
    filter.targetType = "";
    filter.targetIds = [];
  }
  renderAdminFilters().then(() => applyAllAdminFilters());
}

function updateAdminFilterDate(id, field, value) {
  const filter = adminFilters.find((item) => item.id === id);
  if (!filter) return;
  filter[field] = value;
  applyAllAdminFilters();
}

function updateAdminFilterTargetType(id, value) {
  const filter = adminFilters.find((item) => item.id === id);
  if (!filter) return;
  filter.targetType = value;
  filter.targetIds = [];
  renderAdminFilters().then(() => applyAllAdminFilters());
}

function removeAdminFilterRule(id) {
  adminFilters = adminFilters.filter((item) => item.id !== id);
  renderAdminFilters().then(() => applyAllAdminFilters());
}

function clearAdminFilters() {
  adminFilters = [];
  const searchInput = document.getElementById("admin-search-input");
  if (searchInput) searchInput.value = "";
  renderAdminFilters().then(() => applyAllAdminFilters());
}

window.addAdminFilterRule = addAdminFilterRule;
window.removeAdminFilterRule = removeAdminFilterRule;
window.updateAdminFilterKind = updateAdminFilterKind;
window.updateAdminFilterDate = updateAdminFilterDate;
window.updateAdminFilterTargetType = updateAdminFilterTargetType;
window.updateAdminFilterTargetValues = updateAdminFilterTargetValues;
window.clearAdminFilters = clearAdminFilters;

function showAddForm(rowData = null) {
  document.getElementById("data-table-container").style.display = "none";
  document.getElementById("form-container").style.display = "block";
  const bulkCreateContainer = document.getElementById("bulk-create-container");
  if (bulkCreateContainer) bulkCreateContainer.style.display = "none";
  editingId = rowData ? rowData.ID : null;

  const formFields = document.getElementById("form-fields");
  formFields.innerHTML = "";

  schemas[currentEntity].forEach((field) => {
    const wrapper = document.createElement("div");
    const val = rowData ? rowData[field.name] : "";

    let inputHtml = "";
    if (field.type === "select") {
      // Default to 'Jour' if val is empty
      const effectiveVal = val || "Jour";
      const optsHtml = field.opts
        .map(
          (o) =>
            `<option value="${o}" ${effectiveVal === o ? "selected" : ""}>${o}</option>`,
        )
        .join("");
      inputHtml = `<select name="${field.name}" id="input_${field.name}">${optsHtml}</select>`;
    } else if (field.type === "textarea") {
      inputHtml = `<textarea name="${field.name}" id="input_${field.name}">${val || ""}</textarea>`;
    } else if (field.name.includes("Date")) {
      inputHtml = `<input type="date" name="${field.name}" id="input_${field.name}" value="${val || ""}">`;
    } else {
      inputHtml = `<input type="text" name="${field.name}" id="input_${field.name}" value="${val || ""}">`;
    }

    wrapper.innerHTML = `<label>${field.label}:</label> ${inputHtml}`;
    formFields.appendChild(wrapper);
  });

  if (currentEntity === "Image" && !rowData) {
    const uploadWrapper = document.createElement("div");
    uploadWrapper.innerHTML = `<label>Fichier image:</label> <input type="file" id="input_imageFile" accept="image/*" required>`;
    formFields.appendChild(uploadWrapper);
  }

  document.getElementById("form-title").innerText = rowData
    ? `Modifier ${currentEntity}`
    : `Créer ${currentEntity}`;

  document.getElementById("links-manager-container").style.display = "block";
  document.getElementById("existing-links-container").style.display = rowData ? "block" : "none";
  document.getElementById("pending-links-container").style.display = rowData ? "none" : "block";

  pendingLinks = [];
  renderPendingLinks();
  populateLinkTargetTypes();
  clearLinkTransientFields(true);
  if (rowData) loadExistingLinks();

  bindLinkDateTouchTracking();

  initSelect2Admin();
}

async function editRow(id) {
  const row = currentRows.find((r) => r.ID === id);
  showAddForm(row);
}

function getDisplayField(entityName) {
  switch (entityName) {
    case "Personnages":
      return "Nom";
    case "Evenement":
    case "Entite_politique":
    case "Lieu":
      return "titre";
    case "Fonctions":
    case "Tags":
    case "Source":
    case "Image":
      return "Titre";
    default:
      return "ID";
  }
}

const relationMapClient = {
  Evenement: [
    {
      target: "Evenement",
      table: "Lien_evenement_evenement",
      fkSrc: "ID_evenement_A",
      fkDest: "ID_evenement_B",
    },
    {
      target: "Personnages",
      table: "Lien_evenement_personnage",
      fkSrc: "ID_evenement",
      fkDest: "ID_personnage",
    },
    {
      target: "Lieu",
      table: "Lien_evenement_lieux",
      fkSrc: "ID_evenement",
      fkDest: "ID_lieux",
    },
    {
      target: "Tags",
      table: "Lien_evenement_tags",
      fkSrc: "ID_evenement",
      fkDest: "ID_tags",
    },
    {
      target: "Source",
      table: "Lien_evenement_sources",
      fkSrc: "ID_evenement",
      fkDest: "ID_sources",
    },
    {
      target: "Entite_politique",
      table: "Lien_evenement_entite_politique",
      fkSrc: "ID_evenement",
      fkDest: "ID_entite_politique",
    },
  ],
  Personnages: [
    {
      target: "Fonctions",
      table: "Lien_personnage_fonctions",
      fkSrc: "ID_personnage",
      fkDest: "ID_fonctions",
    },
    {
      target: "Lieu",
      table: "Lien_personnage_lieux",
      fkSrc: "ID_personnage",
      fkDest: "ID_lieux",
    },
    {
      target: "Source",
      table: "Lien_personnage_sources",
      fkSrc: "ID_personnage",
      fkDest: "ID_sources",
    },
    {
      target: "Entite_politique",
      table: "Lien_personnage_entite_politique",
      fkSrc: "ID_personnage",
      fkDest: "ID_entite_politique",
    },
    {
      target: "Tags",
      table: "Lien_personnage_tags",
      fkSrc: "ID_personnage",
      fkDest: "ID_tags",
    },
    {
      target: "Personnages",
      table: "Lien_personnage_personnage",
      fkSrc: "ID_personnage_A",
      fkDest: "ID_personnage_B",
    }, // Recursive
  ],
  Lieu: [
    {
      target: "Entite_politique",
      table: "Lien_lieu_entite_politique",
      fkSrc: "ID_lieu",
      fkDest: "ID_entite_politique",
    },
    {
      target: "Source",
      table: "Lien_lieu_sources",
      fkSrc: "ID_lieu",
      fkDest: "ID_sources",
    },
  ],
  Fonctions: [
    {
      target: "Entite_politique",
      table: "Lien_fonctions_entite_politique",
      fkSrc: "ID_fonctions",
      fkDest: "ID_entite_politique",
    },
    {
      target: "Source",
      table: "Lien_fonctions_sources",
      fkSrc: "ID_fonctions",
      fkDest: "ID_sources",
    },
  ],
  Entite_politique: [
    {
      target: "Fonctions",
      table: "Lien_fonctions_entite_politique",
      fkSrc: "ID_entite_politique",
      fkDest: "ID_fonctions",
    },
    {
      target: "Evenement",
      table: "Lien_evenement_entite_politique",
      fkSrc: "ID_entite_politique",
      fkDest: "ID_evenement",
    },
    {
      target: "Source",
      table: "Lien_entite_politique_sources",
      fkSrc: "ID_entite_politique",
      fkDest: "ID_sources",
    },
    {
      target: "Tags",
      table: "Lien_entite_politique_tags",
      fkSrc: "ID_entite_politique",
      fkDest: "ID_tags",
    },
    {
      target: "Entite_politique",
      table: "Lien_entite_politique_entite_politique",
      fkSrc: "ID_entite_politique_A",
      fkDest: "ID_entite_politique_B",
    },
  ],
  Tags: [
    {
      target: "Personnages",
      table: "Lien_personnage_tags",
      fkSrc: "ID_tags",
      fkDest: "ID_personnage",
    },
    {
      target: "Entite_politique",
      table: "Lien_entite_politique_tags",
      fkSrc: "ID_tags",
      fkDest: "ID_entite_politique",
    },
  ],
  Image: [
    {
      target: "Evenement",
      table: "Lien_image_evenement",
      fkSrc: "ID_image",
      fkDest: "ID_evenement",
    },
    {
      target: "Personnages",
      table: "Lien_image_personnage",
      fkSrc: "ID_image",
      fkDest: "ID_personnage",
    },
    {
      target: "Fonctions",
      table: "Lien_image_fonctions",
      fkSrc: "ID_image",
      fkDest: "ID_fonctions",
    },
    {
      target: "Tags",
      table: "Lien_image_tags",
      fkSrc: "ID_image",
      fkDest: "ID_tags",
    },
    {
      target: "Lieu",
      table: "Lien_image_lieu",
      fkSrc: "ID_image",
      fkDest: "ID_lieu",
    },
    {
      target: "Entite_politique",
      table: "Lien_image_entite_politique",
      fkSrc: "ID_image",
      fkDest: "ID_entite_politique",
    },
    {
      target: "Source",
      table: "Lien_image_source",
      fkSrc: "ID_image",
      fkDest: "ID_source",
    },
  ],
  Source: [
    {
      target: "Lieu",
      table: "Lien_lieu_sources",
      fkSrc: "ID_sources",
      fkDest: "ID_lieu",
    },
    {
      target: "Fonctions",
      table: "Lien_fonctions_sources",
      fkSrc: "ID_sources",
      fkDest: "ID_fonctions",
    },
    {
      target: "Entite_politique",
      table: "Lien_entite_politique_sources",
      fkSrc: "ID_sources",
      fkDest: "ID_entite_politique",
    },
  ],
};

const symmetricLinkTablesClient = new Set([
  "Lien_evenement_evenement",
  "Lien_personnage_personnage",
  "Lien_entite_politique_entite_politique",
]);

function populateLinkTargetTypes() {
  const select = document.getElementById("link-target-type");
  const relations = relationMapClient[currentEntity] || [];
  select.innerHTML =
    '<option value="">-- Sélectionnez un type à lier --</option>';
  relations.forEach((rel) => {
    select.innerHTML += `<option value="${rel.target}">${rel.target}</option>`;
  });
  document.getElementById("link-target-id").innerHTML = '<option value="">-- Sélectionnez un élément --</option>';
  initSelect2Admin();
}

async function loadLinkTargets() {
  clearLinkTransientFields();

  const targetType = document.getElementById("link-target-type").value;
  const modeSelect = document.getElementById("link-target-mode");
  const selectId = document.getElementById("link-target-id");
  const dateFields = document.getElementById("link-date-fields");
  selectId.innerHTML = '<option value="">Chargement...</option>';

  if (!targetType) {
    if (modeSelect) modeSelect.style.display = "none";
    if (dateFields) dateFields.style.display = "none";
    return;
  }

  const currentRelations = relationMapClient[currentEntity] || [];
  const rel = currentRelations.find(
    (r) => r.target === targetType,
  );

  if (!rel) {
    if (modeSelect) modeSelect.style.display = "none";
    if (dateFields) dateFields.style.display = "none";
    return;
  }

  if (modeSelect) modeSelect.style.display = "inline-block";

  if (tablesWithDates.has(rel.table) && dateFields) {
    dateFields.style.display = "block";
  } else if (dateFields) {
    dateFields.style.display = "none";
  }

  const mode = modeSelect ? modeSelect.value : "existing";

  if (mode === "draft") {
    // Mode draft : chercher dans bulkCreateGroups
    const drafts = [];
    bulkCreateGroups.forEach(g => {
      if (g.table === targetType) {
        g.entities.forEach(e => {
          drafts.push({ ref: e.ref, label: e.overrides?.titre || e.overrides?.Titre || e.ref });
        });
      }
    });

    selectId.innerHTML =
      '<option value="">-- Sélectionnez un brouillon --</option>' +
      drafts
      .map(d => `<option value="${escapeHtml(d.ref)}">${escapeHtml(d.label)} (brouillon)</option>`)
      .join("");
      
    if (selectId.value) {
      refreshLinkDateSuggestion();
    }
    initSelect2Admin();
    return;
  }

  // Mode existant
  const res = await fetch(`${API}/entities/${targetType}`);
  let data = await res.json();
  linkTargetRowsCache[targetType] = Array.isArray(data) ? data : [];

  if (rel.table === "Lien_evenement_evenement" && editingId) {
    data = data.filter((d) => String(d.ID) !== String(editingId));
  }

  if (rel.table === "Lien_entite_politique_entite_politique" && editingId) {
    data = data.filter((d) => String(d.ID) !== String(editingId));
  }

  const displayF = getDisplayField(targetType);
  selectId.innerHTML =
    '<option value="">-- Sélectionnez un élément --</option>' +
    data
    .map(
      (d) =>
        `<option value="${d.ID}">${d[displayF] || "Sans nom"} (ID: ${d.ID})</option>`,
    )
    .join("");

  if (selectId.value) {
    refreshLinkDateSuggestion();
  }

  initSelect2Admin();
}

function handleLinkTargetSelectionChange() {
  const targetId = document.getElementById("link-target-id")?.value;
  if (!targetId) {
    resetLinkDateFields();
    return;
  }

  resetLinkDateFieldsTouched();
  refreshLinkDateSuggestion();
}

window.handleLinkTargetSelectionChange = handleLinkTargetSelectionChange;

function getRelationByTarget(targetType) {
  const relations = getCurrentEntityRelations();
  return relations.find((rel) => rel.target === targetType) || null;
}

function toggleBulkEditor(show) {
  const container = document.getElementById("bulk-editor-container");
  if (!container) return;
  if (!show) {
    container.style.display = "none";
    return;
  }

  const createContainer = document.getElementById("bulk-create-container");
  if (createContainer) createContainer.style.display = "none";

  if (selectedRowIds.size === 0) {
    alert("Sélectionnez au moins une ligne dans le tableau.");
    return;
  }

  container.style.display = "block";
  populateBulkTargetTypes();
  onBulkActionChanged();
  loadBulkTargetOptions();
  renderBulkOverrides();
  initSelect2Admin(container);
}

function populateBulkTargetTypes() {
  const select = document.getElementById("bulk-link-target-type");
  if (!select) return;
  const relations = getCurrentEntityRelations();
  select.innerHTML = '<option value="">-- Sélectionnez un type lié --</option>' + relations
    .map((rel) => `<option value="${escapeHtml(rel.target)}">${escapeHtml(rel.target)}</option>`)
    .join("");
}

function onBulkActionChanged() {
  const action = document.getElementById("bulk-action")?.value || "create";
  const targetType = document.getElementById("bulk-link-target-type")?.value;
  const relation = targetType ? getRelationByTarget(targetType) : null;
  const canUseDates = relation ? tablesWithDates.has(relation.table) : false;
  const dateFields = document.getElementById("bulk-common-date-fields");
  const isDelete = action === "delete";
  const descriptionInput = document.getElementById("bulk-common-description");

  if (descriptionInput) descriptionInput.disabled = isDelete;
  if (dateFields) dateFields.style.display = !isDelete && canUseDates ? "grid" : "none";
}

function canBulkRelationUseDates() {
  const targetType = document.getElementById("bulk-link-target-type")?.value;
  const relation = targetType ? getRelationByTarget(targetType) : null;
  return Boolean(relation && tablesWithDates.has(relation.table));
}

async function loadBulkTargetOptions() {
  const targetType = document.getElementById("bulk-link-target-type")?.value;
  const targetSelect = document.getElementById("bulk-link-target-ids");
  if (!targetSelect) return;

  if (!targetType) {
    targetSelect.innerHTML = "";
    return;
  }

  const relation = getRelationByTarget(targetType);
  if (!relation) {
    targetSelect.innerHTML = "";
    return;
  }

  const res = await fetch(`${API}/entities/${targetType}`);
  let rows = await res.json();

  if (symmetricLinkTablesClient.has(relation.table)) {
    rows = rows.filter((row) => !selectedRowIds.has(Number(row.ID)));
  }

  const displayF = getDisplayField(targetType);
  targetSelect.innerHTML = rows
    .map((row) => `<option value="${Number(row.ID)}">${escapeHtml(row[displayF] || "Sans nom")} (ID ${Number(row.ID)})</option>`)
    .join("");

  onBulkActionChanged();
  renderBulkOverrides();
  initSelect2Admin(document.getElementById("bulk-editor-container"));
}

function renderBulkOverrides() {
  const container = document.getElementById("bulk-overrides-container");
  if (!container) return;
  const selectedRows = currentRows.filter((row) => selectedRowIds.has(Number(row.ID)));
  const allowDates = canBulkRelationUseDates();

  if (selectedRows.length === 0) {
    container.innerHTML = "<p>Aucune ligne sélectionnée.</p>";
    return;
  }

  container.innerHTML = selectedRows
    .map((row) => {
      const displayLabelField = getDisplayField(currentEntity);
      const label = row[displayLabelField] || row.titre || row.Nom || row.Titre || `ID ${row.ID}`;
      return `<div class="bulk-override-row" data-row-id="${Number(row.ID)}">
        <div class="row-title">${escapeHtml(String(label))} (ID ${Number(row.ID)})</div>
        <div class="bulk-override-fields">
          <input type="text" class="bulk-override-desc" placeholder="Description spécifique (optionnel)">
          ${allowDates ? `
          <input type="date" class="bulk-override-date-debut" title="Date début spécifique">
          <select class="bulk-override-precision-debut"><option value="">Précision début commune</option><option value="Jour">Jour</option><option value="Mois">Mois</option><option value="Année">Année</option></select>
          <input type="date" class="bulk-override-date-fin" title="Date fin spécifique">
          <select class="bulk-override-precision-fin"><option value="">Précision fin commune</option><option value="Jour">Jour</option><option value="Mois">Mois</option><option value="Année">Année</option></select>
          ` : ``}
        </div>
      </div>`;
    })
    .join("");
}

function collectCommonBulkFields(allowDates) {
  const payload = {};
  const desc = document.getElementById("bulk-common-description")?.value?.trim();
  const dDebut = document.getElementById("bulk-common-date-debut")?.value;
  const pDebut = document.getElementById("bulk-common-precision-debut")?.value;
  const dFin = document.getElementById("bulk-common-date-fin")?.value;
  const pFin = document.getElementById("bulk-common-precision-fin")?.value;

  if (desc) payload.description = desc;
  if (allowDates && dDebut) payload.Date_Debut = dDebut;
  if (allowDates && pDebut) payload.precision_Debut = pDebut;
  if (allowDates && dFin) payload.Date_Fin = dFin;
  if (allowDates && pFin) payload.precision_Fin = pFin;
  return payload;
}

function collectOverrideFieldsByRow(allowDates) {
  const overrides = {};
  document.querySelectorAll("#bulk-overrides-container .bulk-override-row").forEach((rowEl) => {
    const rowId = Number(rowEl.dataset.rowId);
    const payload = {};
    const desc = rowEl.querySelector(".bulk-override-desc")?.value?.trim();
    const dDebut = rowEl.querySelector(".bulk-override-date-debut")?.value;
    const pDebut = rowEl.querySelector(".bulk-override-precision-debut")?.value;
    const dFin = rowEl.querySelector(".bulk-override-date-fin")?.value;
    const pFin = rowEl.querySelector(".bulk-override-precision-fin")?.value;

    if (desc) payload.description = desc;
    if (allowDates && dDebut) payload.Date_Debut = dDebut;
    if (allowDates && pDebut) payload.precision_Debut = pDebut;
    if (allowDates && dFin) payload.Date_Fin = dFin;
    if (allowDates && pFin) payload.precision_Fin = pFin;
    overrides[rowId] = payload;
  });
  return overrides;
}

async function submitBulkLinks() {
  const action = document.getElementById("bulk-action")?.value;
  const targetType = document.getElementById("bulk-link-target-type")?.value;
  const targetSelect = document.getElementById("bulk-link-target-ids");
  const targetIds = targetSelect ? Array.from(targetSelect.selectedOptions).map((opt) => Number(opt.value)) : [];

  if (!targetType) {
    alert("Choisissez un type lié.");
    return;
  }
  if (targetIds.length === 0) {
    alert("Choisissez au moins un élément lié.");
    return;
  }
  if (selectedRowIds.size === 0) {
    alert("Aucune ligne sélectionnée.");
    return;
  }

  const relation = getRelationByTarget(targetType);
  if (!relation) {
    alert("Relation introuvable pour ce type.");
    return;
  }

  const allowDates = tablesWithDates.has(relation.table);

  const selectedIds = [...selectedRowIds].map((id) => Number(id));
  const commonFields = collectCommonBulkFields(allowDates);
  const overridesByRow = collectOverrideFieldsByRow(allowDates);

  try {
    if (action === "create") {
      const rows = [];
      selectedIds.forEach((sourceId) => {
        targetIds.forEach((targetId) => {
          const payload = {
            [relation.fkSrc]: sourceId,
            [relation.fkDest]: targetId,
            ...commonFields,
            ...(overridesByRow[sourceId] || {}),
          };
          rows.push(payload);
        });
      });

      const res = await fetch(`${API}/links/${relation.table}/batch-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, atomic: false }),
      });
      const payload = await readApiResponse(res);
      if (!res.ok) throw new Error(payload.error || "Création en masse impossible");
      const result = ensureBulkResponse(payload, "Création en masse");

      alert(`Création en masse terminée: ${result.successCount} succès, ${result.failureCount} échec(s).`);
    }

    if (action === "update") {
      const rows = [];
      selectedIds.forEach((sourceId) => {
        targetIds.forEach((targetId) => {
          const updates = { ...commonFields, ...(overridesByRow[sourceId] || {}) };
          if (Object.keys(updates).length === 0) return;
          rows.push({ keys: { [relation.fkSrc]: sourceId, [relation.fkDest]: targetId }, updates });
        });
      });

      if (rows.length === 0) {
        alert("Aucune modification à appliquer.");
        return;
      }

      const res = await fetch(`${API}/links/${relation.table}/batch-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, atomic: false }),
      });
      const payload = await readApiResponse(res);
      if (!res.ok) throw new Error(payload.error || "Mise à jour en masse impossible");
      const result = ensureBulkResponse(payload, "Mise à jour en masse");

      alert(`Mise à jour en masse terminée: ${result.successCount} succès, ${result.failureCount} échec(s).`);
    }

    if (action === "delete") {
      const rows = [];
      selectedIds.forEach((sourceId) => {
        targetIds.forEach((targetId) => {
          rows.push({ keys: { [relation.fkSrc]: sourceId, [relation.fkDest]: targetId } });
        });
      });

      const res = await fetch(`${API}/links/${relation.table}/batch-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, atomic: false }),
      });
      const payload = await readApiResponse(res);
      if (!res.ok) throw new Error(payload.error || "Suppression en masse impossible");
      const result = ensureBulkResponse(payload, "Suppression en masse");

      alert(`Suppression en masse terminée: ${result.successCount} succès, ${result.failureCount} échec(s).`);
    }

    await loadEntity(currentEntity);
    toggleBulkEditor(false);
  } catch (err) {
    alert(`Erreur édition de masse: ${err.message}`);
  }
}

const bulkCreateRequiredFields = {
  Evenement: ["titre"],
  Personnages: ["Nom"],
  Lieu: ["titre"],
  Entite_politique: ["titre"],
  Fonctions: ["Titre"],
  Tags: ["Titre"],
  Source: ["Titre"],
};

const fkColumnToEntity = {
  ID_image: "Image",
  ID_evenement: "Evenement",
  ID_evenement_A: "Evenement",
  ID_evenement_B: "Evenement",
  ID_personnage: "Personnages",
  ID_personnage_A: "Personnages",
  ID_personnage_B: "Personnages",
  ID_fonctions: "Fonctions",
  ID_tags: "Tags",
  ID_lieu: "Lieu",
  ID_lieux: "Lieu",
  ID_entite_politique: "Entite_politique",
  ID_entite_politique_A: "Entite_politique",
  ID_entite_politique_B: "Entite_politique",
  ID_source: "Source",
  ID_sources: "Source",
};

function getBulkCreateEntityTables() {
  return Object.keys(schemas).filter((table) => table !== "Image");
}

function getBulkCreateLinkTables() {
  return Object.keys(bulkCreateLinkTableConfig);
}

function sanitizeDataPayload(payload) {
  const out = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    out[key] = value;
  });
  return out;
}

function createBlankDataForEntity(table) {
  const fields = schemas[table] || [];
  const data = {};
  fields.forEach((field) => {
    if (field.name.toLowerCase().includes("precision")) {
      data[field.name] = "Jour";
    } else {
      data[field.name] = "";
    }
  });
  return data;
}

function createDefaultLinkFields() {
  return {
    description: "",
    Date_Debut: "",
    precision_Debut: "Jour",
    Date_Fin: "",
    precision_Fin: "Jour",
  };
}

function getLinkFieldConfig(table) {
  const fields = [
    { name: "description", label: "Description", type: "text" },
  ];

  if (tablesWithDates.has(table)) {
    fields.push(
      { name: "Date_Debut", label: "Date début", type: "date" },
      { name: "precision_Debut", label: "Précision début", type: "select", opts: ["Jour", "Mois", "Année"] },
      { name: "Date_Fin", label: "Date fin", type: "date" },
      { name: "precision_Fin", label: "Précision fin", type: "select", opts: ["Jour", "Mois", "Année"] },
    );
  }

  return fields;
}

function getEntityFromFkColumn(column) {
  return fkColumnToEntity[column] || null;
}

function getDraftReferenceOptions(entityName) {
  const options = [];
  bulkCreateGroups.forEach((group) => {
    if (group.table !== entityName) return;
    group.entities.forEach((entityRow) => {
      const labelField = getDisplayField(group.table);
      const merged = { ...group.commonData, ...entityRow.overrides };
      const label = merged[labelField] || `Réf ${entityRow.ref}`;
      options.push({ value: entityRow.ref, label: `${label} (${entityRow.ref})` });
    });
  });
  return options;
}

function ensureBulkCreateEntityOptions(entityName) {
  if (!entityName) return;
  const cached = bulkCreateEntityOptionsCache[entityName];
  if (cached?.rows || cached?.loading) return false;

  bulkCreateEntityOptionsCache[entityName] = { loading: true, rows: [] };
  fetch(`${API}/entities/${entityName}`)
    .then((res) => res.json())
    .then((rows) => {
      bulkCreateEntityOptionsCache[entityName] = { loading: false, rows: Array.isArray(rows) ? rows : [] };
      renderBulkCreate();
    })
    .catch(() => {
      bulkCreateEntityOptionsCache[entityName] = { loading: false, rows: [] };
      renderBulkCreate();
    });

  return true;
}

function getExistingReferenceOptions(entityName) {
  const cached = bulkCreateEntityOptionsCache[entityName];
  if (!cached || cached.loading) return [];
  const rows = Array.isArray(cached.rows) ? cached.rows : [];
  const displayField = getDisplayField(entityName);
  return rows.map((row) => ({
    value: String(Number(row.ID)),
    label: `${row[displayField] || "Sans nom"} (ID ${Number(row.ID)})`,
  }));
}

function normalizeBulkCreateLinkRefModes(link) {
  const relationConfig = bulkCreateLinkTableConfig[link.table];
  if (!relationConfig) return;

  const sourceEntity = getEntityFromFkColumn(relationConfig.fkSrc);
  const targetEntity = getEntityFromFkColumn(relationConfig.fkDest);

  if (!sourceEntity || !targetEntity) return;

  const sourceDrafts = getDraftReferenceOptions(sourceEntity);
  const targetDrafts = getDraftReferenceOptions(targetEntity);

  if (sourceEntity === "Image") {
    link.sourceMode = "existing";
  } else if (link.sourceMode !== "draft" && link.sourceMode !== "existing") {
    link.sourceMode = sourceDrafts.length > 0 ? "draft" : "existing";
  }

  if (targetEntity === "Image") {
    link.targetMode = "existing";
  } else if (link.targetMode !== "draft" && link.targetMode !== "existing") {
    link.targetMode = targetDrafts.length > 0 ? "draft" : "existing";
  }

  if (link.sourceMode === "draft" && !sourceDrafts.some((opt) => opt.value === link.sourceDraftRef)) {
    link.sourceDraftRef = sourceDrafts[0]?.value || "";
  }
  if (link.targetMode === "draft" && !targetDrafts.some((opt) => opt.value === link.targetDraftRef)) {
    link.targetDraftRef = targetDrafts[0]?.value || "";
  }

  const sourceExisting = getExistingReferenceOptions(sourceEntity);
  const targetExisting = getExistingReferenceOptions(targetEntity);
  if (link.sourceMode === "existing" && !sourceExisting.some((opt) => opt.value === link.sourceExistingId)) {
    link.sourceExistingId = sourceExisting[0]?.value || "";
  }
  if (link.targetMode === "existing" && !targetExisting.some((opt) => opt.value === link.targetExistingId)) {
    link.targetExistingId = targetExisting[0]?.value || "";
  }
}

function resetBulkCreateState() {
  bulkCreateGroups = [];
  bulkCreateLinks = [];
  bulkCreateEntityOptionsCache = {};
  bulkCreateValidationErrors = [];
  nextBulkCreateGroupId = 1;
  nextBulkCreateEntityId = 1;
  nextBulkCreateLinkId = 1;
  nextBulkCreateGroupLinkId = 1;
}

function addBulkCreateGroup() {
  const fallback = currentEntity && currentEntity !== "Image" && schemas[currentEntity]
    ? currentEntity
    : getBulkCreateEntityTables()[0];

  const group = {
    id: nextBulkCreateGroupId++,
    table: fallback,
    commonData: createBlankDataForEntity(fallback),
    activeCommonFields: [],
    entities: [],
    links: [],
  };

  bulkCreateGroups.push(group);
  addBulkCreateEntityRow(group.id);
  renderBulkCreate();
}

function removeBulkCreateGroup(groupId) {
  bulkCreateGroups = bulkCreateGroups.filter((group) => group.id !== groupId);
  renderBulkCreate();
}

function addBulkCreateEntityRow(groupId) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;

  group.entities.push({
    id: nextBulkCreateEntityId++,
    ref: `draft_${group.id}_${group.entities.length + 1}`,
    overrides: createBlankDataForEntity(group.table),
    links: [],
  });

  renderBulkCreate();
}

function removeBulkCreateEntityRow(groupId, rowId) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  group.entities = group.entities.filter((row) => row.id !== rowId);
  renderBulkCreate();
}

function updateBulkCreateGroupTable(groupId, table) {
  if (table === "Image") return;
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  group.table = table;
  group.links = []; // Clear links when group type changes
  group.commonData = createBlankDataForEntity(table);
  group.activeCommonFields = [];
  group.entities = group.entities.map((row, idx) => ({
    ...row,
    ref: `draft_${group.id}_${idx + 1}`,
    overrides: createBlankDataForEntity(table),
  }));
  renderBulkCreate();
}

function addBulkCreateGroupCommonField(groupId) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  const select = document.getElementById(`bulk-create-common-field-select-${groupId}`);
  if (!select || !select.value) return;
  
  if (!group.activeCommonFields.includes(select.value)) {
    group.activeCommonFields.push(select.value);
    renderBulkCreate();
  }
}

function removeBulkCreateGroupCommonField(groupId, fieldName) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  
  group.activeCommonFields = group.activeCommonFields.filter(f => f !== fieldName);
  group.commonData[fieldName] = createBlankDataForEntity(group.table)[fieldName];
  renderBulkCreate();
}

function updateBulkCreateGroupField(groupId, fieldName, value) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  group.commonData[fieldName] = value;
  renderBulkCreateStatus();
}

function updateBulkCreateEntityRef(groupId, rowId, value) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  const row = group.entities.find((item) => item.id === rowId);
  if (!row) return;
  row.ref = value;
  renderBulkCreateStatus();
}

function updateBulkCreateEntityField(groupId, rowId, fieldName, value) {
  const group = bulkCreateGroups.find((item) => item.id === groupId);
  if (!group) return;
  const row = group.entities.find((item) => item.id === rowId);
  if (!row) return;
  row.overrides[fieldName] = value;
  renderBulkCreateStatus();
}

function renderBulkFieldControl(field, value, onChangeExpr, prefixLabel = "", contextAttrs = "") {
  const safeValue = value ?? "";
  const label = `${prefixLabel}${field.label}`;

  if (field.type === "textarea") {
    return `<label>${escapeHtml(label)}</label><textarea ${contextAttrs} oninput="${onChangeExpr}">${escapeHtml(safeValue)}</textarea>`;
  }

  if (field.type === "select") {
    const options = ['<option value="">--</option>']
      .concat((field.opts || []).map((opt) => {
        const selected = safeValue === opt ? "selected" : "";
        return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
      }))
      .join("");
    return `<label>${escapeHtml(label)}</label><select ${contextAttrs} oninput="${onChangeExpr}">${options}</select>`;
  }

  const type = field.name.includes("Date") ? "date" : "text";
  return `<label>${escapeHtml(label)}</label><input type="${type}" ${contextAttrs} value="${escapeHtml(safeValue)}" oninput="${onChangeExpr}">`;
}

function getGroupLinkAllowedTables(groupTable) {
  return Object.keys(bulkCreateLinkTableConfig).filter((table) => {
    const config = bulkCreateLinkTableConfig[table];
    return getEntityFromFkColumn(config.fkSrc) === groupTable || getEntityFromFkColumn(config.fkDest) === groupTable;
  });
}

function getGroupLinkTargetEntity(table, groupTable) {
  const config = bulkCreateLinkTableConfig[table];
  const srcE = getEntityFromFkColumn(config.fkSrc);
  const destE = getEntityFromFkColumn(config.fkDest);
  if (srcE === groupTable && destE === groupTable) return groupTable;
  if (srcE === groupTable) return destE;
  return srcE;
}

function addBulkCreateGroupLink(groupId) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  if (!group) return;

  const allowedTables = getGroupLinkAllowedTables(group.table);
  if (allowedTables.length === 0) {
    alert("Aucun type de lien disponible pour " + group.table);
    return;
  }

  const table = allowedTables[0];
  const targetEntity = getGroupLinkTargetEntity(table, group.table);

  if (!group.links) group.links = [];
  group.links.push({
    id: nextBulkCreateGroupLinkId++,
    table: table,
    targetMode: targetEntity === "Image" ? "existing" : "existing",
    targetRef: "",
    fields: createDefaultLinkFields()
  });

  renderBulkCreate();
}

function removeBulkCreateGroupLink(groupId, linkId) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  if (!group) return;
  group.links = group.links.filter((l) => l.id !== linkId);
  renderBulkCreate();
}

function updateBulkCreateGroupLinkTable(groupId, linkId, table) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const link = group?.links?.find((l) => l.id === linkId);
  if (!link) return;

  link.table = table;
  const targetEntity = getGroupLinkTargetEntity(table, group.table);
  link.targetMode = targetEntity === "Image" ? "existing" : "existing";
  link.targetRef = "";
  link.fields = createDefaultLinkFields();

  renderBulkCreate();
}

function updateBulkCreateGroupLinkMode(groupId, linkId, mode) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const link = group?.links?.find((l) => l.id === linkId);
  if (!link) return;
  link.targetMode = mode;
  link.targetRef = "";
  renderBulkCreate(); // re-render to update the select options
}

function updateBulkCreateGroupLinkRef(groupId, linkId, ref) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const link = group?.links?.find((l) => l.id === linkId);
  if (!link) return;
  link.targetRef = ref;
  renderBulkCreateStatus();
}

function updateBulkCreateGroupLinkField(groupId, linkId, fieldName, value) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const link = group?.links?.find((l) => l.id === linkId);
  if (!link) return;
  link.fields[fieldName] = value;
  renderBulkCreateStatus();
}

function addBulkCreateEntityLink(groupId, rowId) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  if (!group) return;
  const row = group.entities.find((r) => r.id === rowId);
  if (!row) return;

  const allowedTables = getGroupLinkAllowedTables(group.table);
  if (allowedTables.length === 0) {
    alert("Aucun type de lien disponible pour " + group.table);
    return;
  }

  const table = allowedTables[0];
  const targetEntity = getGroupLinkTargetEntity(table, group.table);

  if (!row.links) row.links = [];
  row.links.push({
    id: nextBulkCreateGroupLinkId++,
    table: table,
    targetMode: targetEntity === "Image" ? "existing" : "existing",
    targetRef: "",
    fields: createDefaultLinkFields()
  });

  renderBulkCreate();
}

function removeBulkCreateEntityLink(groupId, rowId, linkId) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const row = group?.entities.find((r) => r.id === rowId);
  if (!row) return;
  row.links = row.links.filter((l) => l.id !== linkId);
  renderBulkCreate();
}

function updateBulkCreateEntityLinkTable(groupId, rowId, linkId, table) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const row = group?.entities.find((r) => r.id === rowId);
  const link = row?.links?.find((l) => l.id === linkId);
  if (!link) return;

  link.table = table;
  const targetEntity = getGroupLinkTargetEntity(table, group.table);
  link.targetMode = targetEntity === "Image" ? "existing" : "existing";
  link.targetRef = "";
  link.fields = createDefaultLinkFields();

  renderBulkCreate();
}

function updateBulkCreateEntityLinkMode(groupId, rowId, linkId, mode) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const row = group?.entities.find((r) => r.id === rowId);
  const link = row?.links?.find((l) => l.id === linkId);
  if (!link) return;
  link.targetMode = mode;
  link.targetRef = "";
  renderBulkCreate(); 
}

function updateBulkCreateEntityLinkRef(groupId, rowId, linkId, ref) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const row = group?.entities.find((r) => r.id === rowId);
  const link = row?.links?.find((l) => l.id === linkId);
  if (!link) return;
  link.targetRef = ref;
  renderBulkCreateStatus();
}

function updateBulkCreateEntityLinkField(groupId, rowId, linkId, fieldName, value) {
  const group = bulkCreateGroups.find((g) => g.id === groupId);
  const row = group?.entities.find((r) => r.id === rowId);
  const link = row?.links?.find((l) => l.id === linkId);
  if (!link) return;
  link.fields[fieldName] = value;
  renderBulkCreateStatus();
}

function renderBulkCreateGroups() {
  const container = document.getElementById("bulk-create-groups");
  if (!container) return;

  if (bulkCreateGroups.length === 0) {
    container.innerHTML = "<p>Aucun groupe d'entités. Ajoutez un groupe pour commencer.</p>";
    return;
  }

  const tableOptions = getBulkCreateEntityTables()
    .map((table) => `<option value="${escapeHtml(table)}">${escapeHtml(table)}</option>`)
    .join("");

  container.innerHTML = bulkCreateGroups.map((group) => {
    const schemaFields = schemas[group.table] || [];
    
    // Process active common fields
    if (!group.activeCommonFields) group.activeCommonFields = [];
    const availableFieldsForCommon = schemaFields.filter(f => {
      const fname = f.name.toLowerCase();
      return fname !== "titre" && fname !== "nom" && !group.activeCommonFields.includes(f.name);
    });
    
    const commonFieldsHtml = group.activeCommonFields.length > 0 
      ? group.activeCommonFields.map(fieldName => {
          const field = schemaFields.find(f => f.name === fieldName);
          if (!field) return "";
          return "<div class=\"bulk-create-common-field-wrapper bulk-create-row-head\">" +
            "<div class=\"bulk-create-common-field-control\">" +
              renderBulkFieldControl(
                field,
                group.commonData[field.name] || "",
                "updateBulkCreateGroupField(" + group.id + ", '" + field.name + "', this.value)",
                "",
                "data-group=\"" + group.id + "\" data-field=\"" + field.name + "\" data-is-common=\"true\""
              ) +
            "</div>" +
            "<button type=\"button\" class=\"bulk-create-common-remove\" onclick=\"removeBulkCreateGroupCommonField(" + group.id + ", '" + field.name + "')\" title=\"Retirer\">❌</button>" +
          "</div>";
        }).join("")
      : "";

    const addCommonFieldHtml = availableFieldsForCommon.length > 0 
      ? "<div class=\"bulk-create-common-add bulk-create-row-head\">" +
          "<select id=\"bulk-create-common-field-select-" + group.id + "\">" +
            "<option value=\"\">-- Choisir un champ commun --</option>" +
            availableFieldsForCommon.map(function(f) {
              return "<option value=\"" + escapeHtml(f.name) + "\">" + escapeHtml(f.label) + "</option>";
            }).join("") +
          "</select>" +
          "<button type=\"button\" onclick=\"addBulkCreateGroupCommonField(" + group.id + ")\">Ajouter ce champ commun</button>" +
        "</div>"
      : "";

    const entityRowsHtml = group.entities.length === 0
      ? "<p>Aucune entité dans ce groupe.</p>"
      : group.entities.map((row) => {
          const rowFieldsHtml = schemaFields
            .map((field) => renderBulkFieldControl(
              field,
              row.overrides[field.name] || "",
              `updateBulkCreateEntityField(${group.id}, ${row.id}, '${field.name}', this.value)`,
              "",
              `data-group="${group.id}" data-row="${row.id}" data-field="${field.name}"`
            ))
            .join("");

          const rowLinksHtml = (!row.links || row.links.length === 0)
            ? ""
            : row.links.map((link) => {
                const targetEntity = getGroupLinkTargetEntity(link.table, group.table);
                const allowedTables = getGroupLinkAllowedTables(group.table);
                
                const rLinkTableOptions = allowedTables.map(t => {
                  const targetEnt = getGroupLinkTargetEntity(t, group.table);
                  return `<option value="${escapeHtml(t)}" ${t === link.table ? "selected" : ""}>${escapeHtml(targetEnt)}</option>`;
                }).join("");
                
                const targetModeOptions = targetEntity === "Image"
                  ? '<option value="existing" selected>Existant</option>'
                  : `<option value="draft" ${link.targetMode === "draft" ? "selected" : ""}>Draft (en cours de création)</option><option value="existing" ${link.targetMode === "existing" ? "selected" : ""}>Existant</option>`;

                const targetOptions = link.targetMode === "draft"
                  ? getDraftReferenceOptions(targetEntity)
                  : getExistingReferenceOptions(targetEntity);
                  
                const hasDates = tablesWithDates.has(link.table);
                
                const targetRefSelect = renderReferenceSelect(targetOptions, link.targetRef, `updateBulkCreateEntityLinkRef(${group.id}, ${row.id}, ${link.id}, this.value)`, `data-group="${group.id}" data-row="${row.id}" data-rlink="${link.id}" data-field="targetRef"`);

                return `<div class="bulk-create-link-row link-form-row" data-rlink-id="${link.id}">
                  <div>
                    <select class="bulk-create-link-table" data-group="${group.id}" data-row="${row.id}" data-rlink="${link.id}" data-field="table" onchange="updateBulkCreateEntityLinkTable(${group.id}, ${row.id}, ${link.id}, this.value)">
                      ${rLinkTableOptions}
                    </select>
                    <span> avec </span>
                    <span class="bulk-create-mode-slot ${targetEntity === "Image" ? "is-hidden" : ""}">
                      <select class="bulk-create-ref-mode" data-group="${group.id}" data-row="${row.id}" data-rlink="${link.id}" data-field="targetMode" oninput="updateBulkCreateEntityLinkMode(${group.id}, ${row.id}, ${link.id}, this.value)">
                        ${targetModeOptions}
                      </select>
                    </span>
                    ${targetRefSelect}
              <input type="text" placeholder="Description courte (ex: commanditaire)" value="${escapeHtml(link.fields?.description || '')}" oninput="updateBulkCreateEntityLinkField(${group.id}, ${row.id}, ${link.id}, 'description', this.value)">
              <button type="button" class="btn-remove-link" onclick="removeBulkCreateEntityLink(${group.id}, ${row.id}, ${link.id})" style="background: #ffebee; color:#b71c1c; padding: 6px 10px; border-radius: 8px;">❌</button>
            </div>
                  <div class="link-date-fields ${hasDates ? "" : "is-hidden"}">
                    <label>Dates du lien (optionnelles) :</label>
                    <input type="date" title="Date début" value="${escapeHtml(link.fields?.Date_Debut || '')}" oninput="updateBulkCreateEntityLinkField(${group.id}, ${row.id}, ${link.id}, 'Date_Debut', this.value)">
                    <select oninput="updateBulkCreateEntityLinkField(${group.id}, ${row.id}, ${link.id}, 'precision_Debut', this.value)">
                      <option value="Jour" ${link.fields?.precision_Debut === "Jour" ? "selected" : ""}>Jour</option>
                      <option value="Mois" ${link.fields?.precision_Debut === "Mois" ? "selected" : ""}>Mois</option>
                      <option value="Année" ${link.fields?.precision_Debut === "Année" ? "selected" : ""}>Année</option>
                    </select>
                    <span> à </span>
                    <input type="date" title="Date fin" value="${escapeHtml(link.fields?.Date_Fin || '')}" oninput="updateBulkCreateEntityLinkField(${group.id}, ${row.id}, ${link.id}, 'Date_Fin', this.value)">
                    <select oninput="updateBulkCreateEntityLinkField(${group.id}, ${row.id}, ${link.id}, 'precision_Fin', this.value)">
                      <option value="Jour" ${link.fields?.precision_Fin === "Jour" ? "selected" : ""}>Jour</option>
                      <option value="Mois" ${link.fields?.precision_Fin === "Mois" ? "selected" : ""}>Mois</option>
                      <option value="Année" ${link.fields?.precision_Fin === "Année" ? "selected" : ""}>Année</option>
                    </select>
                  </div>
                </div>`;
            }).join("");

          return `<div class="bulk-create-entity-row" data-row-id="${row.id}">
            <div class="bulk-create-row-head">
              <label>Référence draft</label>
              <input type="text" class="bulk-create-entity-ref" data-group="${group.id}" data-row="${row.id}" data-field="ref" value="${escapeHtml(row.ref)}" oninput="updateBulkCreateEntityRef(${group.id}, ${row.id}, this.value)">
              <button type="button" onclick="removeBulkCreateEntityRow(${group.id}, ${row.id})">Retirer</button>
            </div>
            <div class="bulk-create-entity-fields">
              ${rowFieldsHtml}
            </div>
            <div class="bulk-create-row-links">
              ${rowLinksHtml}
              <button type="button" onclick="addBulkCreateEntityLink(${group.id}, ${row.id})" style="margin-top:8px;">Ajouter un lien individuel</button>
            </div>
          </div>`;
        }).join("");

    const groupLinksHtml = (!group.links || group.links.length === 0)
      ? ""
      : group.links.map((link) => {
          const targetEntity = getGroupLinkTargetEntity(link.table, group.table);
          const allowedTables = getGroupLinkAllowedTables(group.table);
          
          const gLinkTableOptions = allowedTables.map(t => {
            const targetEnt = getGroupLinkTargetEntity(t, group.table);
            return `<option value="${escapeHtml(t)}" ${t === link.table ? "selected" : ""}>${escapeHtml(targetEnt)}</option>`;
          }).join("");
          
          const targetModeOptions = targetEntity === "Image"
            ? '<option value="existing" selected>Existant</option>'
            : `<option value="draft" ${link.targetMode === "draft" ? "selected" : ""}>Draft (en cours de création)</option><option value="existing" ${link.targetMode === "existing" ? "selected" : ""}>Existant</option>`;

          const targetOptions = link.targetMode === "draft"
            ? getDraftReferenceOptions(targetEntity)
            : getExistingReferenceOptions(targetEntity);
            
          const hasDates = tablesWithDates.has(link.table);
          
          const targetRefSelect = renderReferenceSelect(targetOptions, link.targetRef, `updateBulkCreateGroupLinkRef(${group.id}, ${link.id}, this.value)`, `data-group="${group.id}" data-glink="${link.id}" data-field="targetRef"`);

          return `<div class="bulk-create-link-row link-form-row" data-glink-id="${link.id}">
            <div>
              <select class="bulk-create-link-table" data-group="${group.id}" data-glink="${link.id}" data-field="table" onchange="updateBulkCreateGroupLinkTable(${group.id}, ${link.id}, this.value)">
                ${gLinkTableOptions}
              </select>
              <span> avec </span>
              <span class="bulk-create-mode-slot ${targetEntity === "Image" ? "is-hidden" : ""}">
                <select class="bulk-create-ref-mode" data-group="${group.id}" data-glink="${link.id}" data-field="targetMode" oninput="updateBulkCreateGroupLinkMode(${group.id}, ${link.id}, this.value)">
              ${targetModeOptions}
                </select>
              </span>
              ${targetRefSelect}
              <input type="text" placeholder="Description courte (ex: commanditaire)" value="${escapeHtml(link.fields?.description || '')}" oninput="updateBulkCreateGroupLinkField(${group.id}, ${link.id}, 'description', this.value)">
              <button type="button" class="btn-remove-link" onclick="removeBulkCreateGroupLink(${group.id}, ${link.id})" style="background: #ffebee; color:#b71c1c; padding: 6px 10px; border-radius: 8px;">❌</button>
            </div>
            <div class="link-date-fields ${hasDates ? "" : "is-hidden"}">
              <label>Dates du lien (optionnelles) :</label>
              <input type="date" title="Date début" value="${escapeHtml(link.fields?.Date_Debut || '')}" oninput="updateBulkCreateGroupLinkField(${group.id}, ${link.id}, 'Date_Debut', this.value)">
              <select oninput="updateBulkCreateGroupLinkField(${group.id}, ${link.id}, 'precision_Debut', this.value)">
                <option value="Jour" ${link.fields?.precision_Debut === "Jour" ? "selected" : ""}>Jour</option>
                <option value="Mois" ${link.fields?.precision_Debut === "Mois" ? "selected" : ""}>Mois</option>
                <option value="Année" ${link.fields?.precision_Debut === "Année" ? "selected" : ""}>Année</option>
              </select>
              <span> à </span>
              <input type="date" title="Date fin" value="${escapeHtml(link.fields?.Date_Fin || '')}" oninput="updateBulkCreateGroupLinkField(${group.id}, ${link.id}, 'Date_Fin', this.value)">
              <select oninput="updateBulkCreateGroupLinkField(${group.id}, ${link.id}, 'precision_Fin', this.value)">
                <option value="Jour" ${link.fields?.precision_Fin === "Jour" ? "selected" : ""}>Jour</option>
                <option value="Mois" ${link.fields?.precision_Fin === "Mois" ? "selected" : ""}>Mois</option>
                <option value="Année" ${link.fields?.precision_Fin === "Année" ? "selected" : ""}>Année</option>
              </select>
            </div>
          </div>`;
      }).join("");

    return `<div class="bulk-create-group" data-group-id="${group.id}">
      <div class="bulk-create-group-head">
        <label>Type</label>
        <select class="bulk-create-entity-table" onchange="updateBulkCreateGroupTable(${group.id}, this.value)">
          ${tableOptions.replace(`value="${escapeHtml(group.table)}"`, `value="${escapeHtml(group.table)}" selected`)}
        </select>
        <button type="button" onclick="removeBulkCreateGroup(${group.id})">Supprimer le groupe</button>
      </div>
      
      <div class="bulk-create-group-fields">
        <h5>Liens communs à ce groupe</h5>
        ${groupLinksHtml}
        <button type="button" onclick="addBulkCreateGroupLink(${group.id})" style="margin-top:8px;">Ajouter un lien de groupe</button>
      </div>

      <div class="bulk-create-group-fields">
        <h5>Champs communs</h5>
        <div class="bulk-create-grid-fields">
          ${commonFieldsHtml}
        </div>
        ${addCommonFieldHtml}
      </div>
      <div class="bulk-create-entity-list">${entityRowsHtml}</div>
      <button type="button" onclick="addBulkCreateEntityRow(${group.id})">Ajouter une entité à ce groupe</button>
    </div>`;
  }).join("");

  ensureBulkCreateOptionLoadsForGroupLinks();
}

function addBulkCreateLinkDraft() {
  const firstTable = getBulkCreateLinkTables()[0];
  bulkCreateLinks.push({
    id: nextBulkCreateLinkId++,
    table: firstTable,
    sourceMode: "draft",
    sourceDraftRef: "",
    sourceExistingId: "",
    targetMode: "draft",
    targetDraftRef: "",
    targetExistingId: "",
    fields: createDefaultLinkFields(),
  });

  renderBulkCreate();
}

function removeBulkCreateLinkDraft(linkId) {
  bulkCreateLinks = bulkCreateLinks.filter((link) => link.id !== linkId);
  renderBulkCreate();
}

function updateBulkCreateLinkTable(linkId, table) {
  const link = bulkCreateLinks.find((item) => item.id === linkId);
  if (!link) return;
  link.table = table;
  link.fields = createDefaultLinkFields();
  normalizeBulkCreateLinkRefModes(link);
  renderBulkCreate();
}

function updateBulkCreateLinkMode(linkId, side, mode) {
  const link = bulkCreateLinks.find((item) => item.id === linkId);
  if (!link) return;
  if (side === "source") link.sourceMode = mode;
  if (side === "target") link.targetMode = mode;
  normalizeBulkCreateLinkRefModes(link);
  renderBulkCreate();
}

function autofillBulkCreateLinkDates(link) {
  if (!tablesWithDates.has(link.table)) return;
  const config = bulkCreateLinkTableConfig[link.table];
  if (!config) return;

  if (link.fields.Date_Debut || link.fields.Date_Fin) return;

  let sourceStartDate, sourceEndDate, sourceStartPrec, sourceEndPrec;
  if (link.sourceMode === "draft" && link.sourceDraftRef) {
    bulkCreateGroups.forEach((g) => {
      const row = g.entities.find((e) => e.ref === link.sourceDraftRef);
      if (row) {
        const merged = { ...g.commonData, ...row.overrides };
        sourceStartDate = merged.Date_Debut || merged.Date_Naissance;
        sourceEndDate = merged.Date_Fin || merged.Date_Mort;
        sourceStartPrec = merged.precision_Debut || merged.precision_Naissance;
        sourceEndPrec = merged.precision_Fin || merged.precision_Mort;
      }
    });
  }

  if (sourceStartDate) {
    link.fields.Date_Debut = sourceStartDate;
    if (sourceStartPrec) link.fields.precision_Debut = sourceStartPrec;
  }
  if (sourceEndDate) {
    link.fields.Date_Fin = sourceEndDate;
    if (sourceEndPrec) link.fields.precision_Fin = sourceEndPrec;
  }
}

function updateBulkCreateLinkRef(linkId, side, value) {
  const link = bulkCreateLinks.find((item) => item.id === linkId);
  if (!link) return;

  if (side === "source") {
    if (link.sourceMode === "draft") link.sourceDraftRef = value;
    else link.sourceExistingId = value;
  }
  if (side === "target") {
    if (link.targetMode === "draft") link.targetDraftRef = value;
    else link.targetExistingId = value;
  }
  
  autofillBulkCreateLinkDates(link);
  renderBulkCreate();
}

function updateBulkCreateLinkField(linkId, fieldName, value) {
  const link = bulkCreateLinks.find((item) => item.id === linkId);
  if (!link) return;
  link.fields[fieldName] = value;
  renderBulkCreateStatus();
}

function updateBulkCreateLinkCommonField(fieldName, value) {
  bulkCreateLinkCommonFields[fieldName] = value;
  renderBulkCreateStatus();
}

function renderReferenceSelect(options, selectedValue, onChangeExpr, contextAttrs = "") {
  const opts = ['<option value="">-- Sélectionner --</option>']
    .concat(options.map((opt) => `<option value="${escapeHtml(opt.value)}" ${String(selectedValue) === String(opt.value) ? "selected" : ""}>${escapeHtml(opt.label)}</option>`))
    .join("");
  return `<select class="bulk-create-ref-select" ${contextAttrs} oninput="${onChangeExpr}">${opts}</select>`;
}

function ensureBulkCreateOptionLoadsForGroupLinks() {
  bulkCreateGroups.forEach((group) => {
    if (group.links) {
      group.links.forEach((gLink) => {
        const targetEntity = getGroupLinkTargetEntity(gLink.table, group.table);
        if (gLink.targetMode === "existing" && targetEntity) {
          ensureBulkCreateEntityOptions(targetEntity);
        }
      });
    }
    if (group.entities) {
      group.entities.forEach((row) => {
        if (!row.links) return;
        row.links.forEach((rLink) => {
          const targetEntity = getGroupLinkTargetEntity(rLink.table, group.table);
          if (rLink.targetMode === "existing" && targetEntity) {
            ensureBulkCreateEntityOptions(targetEntity);
          }
        });
      });
    }
  });
}

function renderBulkCreateLinks() {
  const container = document.getElementById("bulk-create-links");
  if (!container) return;

  if (bulkCreateLinks.length === 0) {
    container.innerHTML = "<p>Aucun lien préparé. Ajoutez un lien si besoin.</p>";
    return;
  }

  const tableOptions = getBulkCreateLinkTables()
    .map((table) => `<option value="${escapeHtml(table)}">${escapeHtml(LINK_TABLE_LABELS[table] || table)}</option>`)
    .join("");

  container.innerHTML = bulkCreateLinks.map((link) => {
    const config = bulkCreateLinkTableConfig[link.table];
    const sourceEntity = config ? getEntityFromFkColumn(config.fkSrc) : null;
    const targetEntity = config ? getEntityFromFkColumn(config.fkDest) : null;
    normalizeBulkCreateLinkRefModes(link);

    const sourceModeOptions = sourceEntity === "Image"
      ? '<option value="existing" selected>Existant</option>'
      : `<option value="draft" ${link.sourceMode === "draft" ? "selected" : ""}>Draft</option><option value="existing" ${link.sourceMode === "existing" ? "selected" : ""}>Existant</option>`;

    const targetModeOptions = targetEntity === "Image"
      ? '<option value="existing" selected>Existant</option>'
      : `<option value="draft" ${link.targetMode === "draft" ? "selected" : ""}>Draft</option><option value="existing" ${link.targetMode === "existing" ? "selected" : ""}>Existant</option>`;

    const sourceOptions = link.sourceMode === "draft"
      ? getDraftReferenceOptions(sourceEntity)
      : getExistingReferenceOptions(sourceEntity);
    const targetOptions = link.targetMode === "draft"
      ? getDraftReferenceOptions(targetEntity)
      : getExistingReferenceOptions(targetEntity);

    const sourceValue = link.sourceMode === "draft" ? link.sourceDraftRef : link.sourceExistingId;
    const targetValue = link.targetMode === "draft" ? link.targetDraftRef : link.targetExistingId;
    const linkFields = getLinkFieldConfig(link.table)
      .map((field) => renderBulkFieldControl(
        field,
        link.fields?.[field.name] || "",
        `updateBulkCreateLinkField(${link.id}, '${field.name}', this.value)`,
        "",
        `data-link="${link.id}" data-field="${field.name}"`
      ))
      .join("");

    return `<div class="bulk-create-link-row" data-link-id="${link.id}">
      <div class="bulk-create-link-head">
        <label>Table de lien</label>
        <select class="bulk-create-link-table" data-link="${link.id}" data-field="table" onchange="updateBulkCreateLinkTable(${link.id}, this.value)">
          ${tableOptions.replace(`value="${escapeHtml(link.table)}"`, `value="${escapeHtml(link.table)}" selected`)}
        </select>
        <button type="button" onclick="removeBulkCreateLinkDraft(${link.id})">Retirer</button>
      </div>
      <div class="bulk-create-link-ref-grid">
        <div>
          <label>Source (${escapeHtml(sourceEntity || "?")})</label>
          <select class="bulk-create-ref-mode" data-link="${link.id}" data-field="sourceMode" oninput="updateBulkCreateLinkMode(${link.id}, 'source', this.value)">${sourceModeOptions}</select>
          ${renderReferenceSelect(sourceOptions, sourceValue, `updateBulkCreateLinkRef(${link.id}, 'source', this.value)`, `data-link="${link.id}" data-field="sourceRef"`)}
        </div>
        <div>
          <label>Cible (${escapeHtml(targetEntity || "?")})</label>
          <select class="bulk-create-ref-mode" data-link="${link.id}" data-field="targetMode" oninput="updateBulkCreateLinkMode(${link.id}, 'target', this.value)">${targetModeOptions}</select>
          ${renderReferenceSelect(targetOptions, targetValue, `updateBulkCreateLinkRef(${link.id}, 'target', this.value)`, `data-link="${link.id}" data-field="targetRef"`)}
        </div>
      </div>
      <div class="bulk-create-grid-fields">
        ${linkFields}
      </div>
    </div>`;
  }).join("");

  ensureBulkCreateOptionLoadsForLinks();
}

function validateDatePrecisionPair(data, dateField, precisionField, contextLabel, targetSelector = "") {
  const errors = [];
  const dateValue = String(data?.[dateField] || "").trim();
  const precisionValue = String(data?.[precisionField] || "").trim();
  if (!dateValue && precisionValue && precisionValue !== "Jour") {
    errors.push({ msg: `${contextLabel}: ${precisionField} renseigné sans ${dateField}.`, selector: targetSelector });
  }
  return errors;
}

function validateDateOrder(data, startField, endField, contextLabel, targetSelector = "") {
  const startValue = String(data?.[startField] || "").trim();
  const endValue = String(data?.[endField] || "").trim();
  if (!startValue || !endValue) return [];
  const start = parseDateOrNull(startValue);
  const end = parseDateOrNull(endValue);
  if (!start || !end) return [];
  if (start > end) {
    return [{ msg: `${contextLabel}: ${startField} doit être antérieure à ${endField}.`, selector: targetSelector }];
  }
  return [];
}

function validateBulkCreateState() {
  const errors = [];
  const refSeen = new Set();
  const allRefs = new Set();

  if (bulkCreateGroups.length === 0) {
    errors.push({ msg: "Ajoute au moins un groupe d'entités.", selector: "" });
  }

  // Pre-collect all refs
  bulkCreateGroups.forEach((group) => {
    group.entities.forEach((row) => {
      const ref = String(row.ref || "").trim();
      if (ref && !refSeen.has(ref)) {
        refSeen.add(ref);
        allRefs.add(ref);
      }
    });
  });

  const refSeenCheck = new Set();

  bulkCreateGroups.forEach((group) => {
    if (group.links) {
      group.links.forEach((gLink) => {
        const targetRef = String(gLink.targetRef || "").trim();
        const targetSel = `[data-group="${group.id}"][data-glink="${gLink.id}"][data-field="targetRef"]`;

        if (!targetRef) {
          errors.push({ msg: `Lien de groupe ${group.id}: cible manquante.`, selector: targetSel });
        } else if (gLink.targetMode === "draft" && !allRefs.has(targetRef)) {
          errors.push({ msg: `Lien de groupe ${group.id}: référence cible inconnue (${targetRef}).`, selector: targetSel });
        }

        if (tablesWithDates.has(gLink.table)) {
          const fields = { ...(gLink.fields || {}) };
          const dDebutSel = `[data-group="${group.id}"][data-glink="${gLink.id}"][data-field="Date_Debut"]`;
          const dFinSel = `[data-group="${group.id}"][data-glink="${gLink.id}"][data-field="Date_Fin"]`;

          errors.push(...validateDatePrecisionPair(fields, "Date_Debut", "precision_Debut", `Lien de groupe ${group.id}`, dDebutSel));
          errors.push(...validateDatePrecisionPair(fields, "Date_Fin", "precision_Fin", `Lien de groupe ${group.id}`, dFinSel));
          errors.push(...validateDateOrder(fields, "Date_Debut", "Date_Fin", `Lien de groupe ${group.id}`, dDebutSel));
        }
      });
    }

    if (group.table === "Image") {
      errors.push({ msg: `Groupe ${group.id}: la création d'images en masse n'est pas supportée.`, selector: `[data-group="${group.id}"]` });
    }

    if (group.entities.length === 0) {
      errors.push({ msg: `Groupe ${group.id}: aucune entité à créer.`, selector: `[data-group="${group.id}"]` });
    }

    group.entities.forEach((row) => {
      const context = `Entité ${row.ref || `g${group.id}-r${row.id}`}`;
      const ref = String(row.ref || "").trim();
      const refSelector = `[data-group="${group.id}"][data-row="${row.id}"][data-field="ref"]`;
      if (!ref) {
        errors.push({ msg: `Groupe ${group.id}: référence draft manquante.`, selector: refSelector });
      } else if (refSeenCheck.has(ref)) {
        errors.push({ msg: `Référence draft dupliquée: ${ref}.`, selector: refSelector });
      } else {
        refSeenCheck.add(ref);
      }

      const merged = { ...group.commonData, ...row.overrides };
      const required = bulkCreateRequiredFields[group.table] || [];
      required.forEach((fieldName) => {
        const value = String(merged[fieldName] || "").trim();
        if (!value) {
          // Try to highlight either the override or the common field
          const fieldSel = row.overrides[fieldName] === undefined && group.commonData[fieldName] === undefined 
            ? `[data-group="${group.id}"][data-field="${fieldName}"]` 
            : (row.overrides[fieldName] ? `[data-group="${group.id}"][data-row="${row.id}"][data-field="${fieldName}"]` : `[data-group="${group.id}"][data-field="${fieldName}"]`);
          
          errors.push({ msg: `${context}: champ requis ${fieldName} manquant.`, selector: fieldSel });
        }
      });

      const dateDebutSel = `[data-group="${group.id}"][data-row="${row.id}"][data-field="Date_Debut"], [data-group="${group.id}"][data-field="Date_Debut"]`;
      const dateFinSel = `[data-group="${group.id}"][data-row="${row.id}"][data-field="Date_Fin"], [data-group="${group.id}"][data-field="Date_Fin"]`;
      const dateNaissSel = `[data-group="${group.id}"][data-row="${row.id}"][data-field="Date_Naissance"], [data-group="${group.id}"][data-field="Date_Naissance"]`;
      const dateMortSel = `[data-group="${group.id}"][data-row="${row.id}"][data-field="Date_Mort"], [data-group="${group.id}"][data-field="Date_Mort"]`;

      errors.push(...validateDatePrecisionPair(merged, "Date_Debut", "precision_Debut", context, dateDebutSel));
      errors.push(...validateDatePrecisionPair(merged, "Date_Fin", "precision_Fin", context, dateFinSel));
      errors.push(...validateDatePrecisionPair(merged, "Date_Naissance", "precision_Naissance", context, dateNaissSel));
      errors.push(...validateDatePrecisionPair(merged, "Date_Mort", "precision_Mort", context, dateMortSel));
      errors.push(...validateDateOrder(merged, "Date_Debut", "Date_Fin", context, dateDebutSel));
      errors.push(...validateDateOrder(merged, "Date_Naissance", "Date_Mort", context, dateNaissSel));

      if (row.links) {
        row.links.forEach((rLink) => {
          const targetRef = String(rLink.targetRef || "").trim();
          const targetSel = `[data-group="${group.id}"][data-row="${row.id}"][data-rlink="${rLink.id}"][data-field="targetRef"]`;

          if (!targetRef) {
            errors.push({ msg: `Lien individuel (Entité ${ref}): cible manquante.`, selector: targetSel });
          } else if (rLink.targetMode === "draft" && !allRefs.has(targetRef)) {
            errors.push({ msg: `Lien individuel (Entité ${ref}): référence cible inconnue (${targetRef}).`, selector: targetSel });
          }

          if (tablesWithDates.has(rLink.table)) {
            const fields = { ...(rLink.fields || {}) };
            const rDebutSel = `[data-group="${group.id}"][data-row="${row.id}"][data-rlink="${rLink.id}"][data-field="Date_Debut"]`;
            const rFinSel = `[data-group="${group.id}"][data-row="${row.id}"][data-rlink="${rLink.id}"][data-field="Date_Fin"]`;

            errors.push(...validateDatePrecisionPair(fields, "Date_Debut", "precision_Debut", `Lien individuel (Entité ${ref})`, rDebutSel));
            errors.push(...validateDatePrecisionPair(fields, "Date_Fin", "precision_Fin", `Lien individuel (Entité ${ref})`, rFinSel));
            errors.push(...validateDateOrder(fields, "Date_Debut", "Date_Fin", `Lien individuel (Entité ${ref})`, rDebutSel));
          }
        });
      }
    });
  });

  return errors;
}

function renderBulkCreateStatus() {
  bulkCreateValidationErrors = validateBulkCreateState();

  const summary = document.getElementById("bulk-create-summary");
  const errorsContainer = document.getElementById("bulk-create-errors");
  const submitBtn = document.getElementById("bulk-create-submit");

  // Remove existing hit-error markers
  document.querySelectorAll(".hit-error").forEach((el) => el.classList.remove("hit-error"));

  // Apply hit-error to targeted elements
  bulkCreateValidationErrors.forEach((err) => {
    if (!err.selector) return;
    try {
      const els = document.querySelectorAll(err.selector);
      els.forEach((el) => {
        el.classList.add("hit-error");
        // For match groups, apply to the parent select2 if present
        if (el.classList.contains("select2-hidden-accessible")) {
          const s2Container = el.nextElementSibling;
          if (s2Container && s2Container.classList.contains("select2-container")) {
            s2Container.querySelector('.select2-selection').classList.add("hit-error");
          }
        }
      });
    } catch(e) {}
  });

  const entityCount = bulkCreateGroups.reduce((sum, g) => sum + g.entities.length, 0);
  const linkCount = bulkCreateGroups.reduce((acc, g) => acc + (g.links?.length || 0) * (g.entities?.length || 0) + g.entities.reduce((sum, r) => sum + (r.links?.length || 0), 0), 0);
  if (summary) {
    summary.textContent = `${entityCount} entité(s) préparée(s), ${linkCount} lien(s) généré(s).`;
  }

  if (errorsContainer) {
    if (bulkCreateValidationErrors.length === 0) {
      errorsContainer.innerHTML = '<p class="bulk-create-ok">Validation OK.</p>';
    } else {
      errorsContainer.innerHTML = `<ul>${bulkCreateValidationErrors.map((err) => `<li>${escapeHtml(err.msg)}</li>`).join("")}</ul>`;
    }
  }

  if (submitBtn) submitBtn.disabled = bulkCreateValidationErrors.length > 0;
}

function renderBulkCreate() {
  renderBulkCreateGroups();
  renderBulkCreateStatus();
  initSelect2Admin(document.getElementById("bulk-create-container"));
}

function closeBulkPanels() {
  const createContainer = document.getElementById("bulk-create-container");
  const editorContainer = document.getElementById("bulk-editor-container");
  if (createContainer) createContainer.style.display = "none";
  if (editorContainer) editorContainer.style.display = "none";
}

function toggleBulkCreate(show) {
  const container = document.getElementById("bulk-create-container");
  if (!container) return;

  if (!show) {
    container.style.display = "none";
    if (currentEntity) {
      document.getElementById("data-table-container").style.display = "block";
    }
    return;
  }

  closeBulkPanels();
  document.getElementById("form-container").style.display = "none";
  if (currentEntity) {
    document.getElementById("data-table-container").style.display = "block";
  }

  if (bulkCreateGroups.length === 0) {
    resetBulkCreateState();
    addBulkCreateGroup();
  }

  container.style.display = "block";
  renderBulkCreate();
}

function collectBulkCreatePayload() {
  const createEntities = [];
  const createLinks = [];

  bulkCreateGroups.forEach((group) => {
    if (!group.table) {
      throw new Error(`Le groupe ${group.id} n'a pas de type.`);
    }

    const commonData = sanitizeDataPayload(group.commonData);
    if (group.entities.length === 0) {
      throw new Error(`Le groupe ${group.id} ne contient aucune entité.`);
    }

    group.entities.forEach((row) => {
      const ref = String(row.ref || "").trim();
      if (!ref) {
        throw new Error(`Une entité du groupe ${group.id} n'a pas de référence.`);
      }

      const overrides = sanitizeDataPayload(row.overrides);
      createEntities.push({
        table: group.table,
        ref,
        data: sanitizeDataPayload({ ...commonData, ...overrides }),
      });

      if (group.links) {
        group.links.forEach((gLink) => {
          const config = bulkCreateLinkTableConfig[gLink.table];
          if (!config) return;

          const srcE = getEntityFromFkColumn(config.fkSrc);
          const destE = getEntityFromFkColumn(config.fkDest);
          
          let fkGroup, fkTarget;
          if (srcE === group.table && destE === group.table) {
              fkGroup = config.fkSrc;
              fkTarget = config.fkDest;
          } else if (srcE === group.table) {
              fkGroup = config.fkSrc;
              fkTarget = config.fkDest;
          } else {
              fkGroup = config.fkDest;
              fkTarget = config.fkSrc;
          }

          const targetVal = gLink.targetMode === "draft"
            ? String(gLink.targetRef || "").trim()
            : Number(gLink.targetRef || 0);

          createLinks.push({
            table: gLink.table,
            payload: sanitizeDataPayload({
              [fkGroup]: ref,
              [fkTarget]: targetVal,
              ...gLink.fields,
            }),
          });
        });
      }

      if (row.links) {
        row.links.forEach((rLink) => {
          const config = bulkCreateLinkTableConfig[rLink.table];
          if (!config) return;

          const srcE = getEntityFromFkColumn(config.fkSrc);
          const destE = getEntityFromFkColumn(config.fkDest);
          
          let fkGroup, fkTarget;
          if (srcE === group.table && destE === group.table) {
              fkGroup = config.fkSrc;
              fkTarget = config.fkDest;
          } else if (srcE === group.table) {
              fkGroup = config.fkSrc;
              fkTarget = config.fkDest;
          } else {
              fkGroup = config.fkDest;
              fkTarget = config.fkSrc;
          }

          const targetVal = rLink.targetMode === "draft"
            ? String(rLink.targetRef || "").trim()
            : Number(rLink.targetRef || 0);

          createLinks.push({
            table: rLink.table,
            payload: sanitizeDataPayload({
              [fkGroup]: ref,
              [fkTarget]: targetVal,
              ...rLink.fields,
            }),
          });
        });
      }
    });
  });

  return { createEntities, createLinks };
}

async function submitBulkCreate() {
  try {
    renderBulkCreateStatus();
    if (bulkCreateValidationErrors.length > 0) {
      throw new Error("Le formulaire contient des erreurs. Corrige les champs en rouge avant d'envoyer.");
    }

    const payload = collectBulkCreatePayload();
    if (payload.createEntities.length === 0) {
      alert("Ajoutez au moins une entité à créer.");
      return;
    }

    const res = await fetch(`${API}/bulk-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atomic: true, ...payload }),
    });
    const responsePayload = await readApiResponse(res);
    if (!res.ok) {
      throw new Error(responsePayload.error || "Ajout de masse impossible");
    }

    alert(`Ajout de masse terminé: ${responsePayload.successCount || 0} opération(s) réalisée(s).`);
    toggleBulkCreate(false);
    resetBulkCreateState();
    if (currentEntity) {
      await loadEntity(currentEntity);
    }
  } catch (err) {
    alert(`Erreur ajout de masse: ${err.message}`);
  }
}

window.toggleBulkEditor = toggleBulkEditor;
window.onBulkActionChanged = onBulkActionChanged;
window.loadBulkTargetOptions = loadBulkTargetOptions;
window.submitBulkLinks = submitBulkLinks;
window.toggleBulkCreate = toggleBulkCreate;
window.addBulkCreateGroup = addBulkCreateGroup;
window.addBulkCreateEntityRow = addBulkCreateEntityRow;
window.removeBulkCreateGroup = removeBulkCreateGroup;
window.removeBulkCreateEntityRow = removeBulkCreateEntityRow;
window.updateBulkCreateGroupTable = updateBulkCreateGroupTable;
window.updateBulkCreateGroupField = updateBulkCreateGroupField;
window.updateBulkCreateEntityRef = updateBulkCreateEntityRef;
window.updateBulkCreateEntityField = updateBulkCreateEntityField;
window.submitBulkCreate = submitBulkCreate;

window.addBulkCreateGroupLink = addBulkCreateGroupLink;
window.removeBulkCreateGroupLink = removeBulkCreateGroupLink;
window.updateBulkCreateGroupLinkTable = updateBulkCreateGroupLinkTable;
window.updateBulkCreateGroupLinkMode = updateBulkCreateGroupLinkMode;
window.updateBulkCreateGroupLinkRef = updateBulkCreateGroupLinkRef;
window.updateBulkCreateGroupLinkField = updateBulkCreateGroupLinkField;

window.addBulkCreateEntityLink = addBulkCreateEntityLink;
window.removeBulkCreateEntityLink = removeBulkCreateEntityLink;
window.updateBulkCreateEntityLinkTable = updateBulkCreateEntityLinkTable;
window.updateBulkCreateEntityLinkMode = updateBulkCreateEntityLinkMode;
window.updateBulkCreateEntityLinkRef = updateBulkCreateEntityLinkRef;
window.updateBulkCreateEntityLinkField = updateBulkCreateEntityLinkField;

function setImportStatus(message, isError = false) {
  const statusEl = document.getElementById("import-backup-status");
  if (!statusEl) return;
  statusEl.style.color = isError ? "#b00020" : "#0b6b1f";
  statusEl.textContent = message;
}

async function handleBackupImport(event) {
  event.preventDefault();

  const fileInput = document.getElementById("import-backup-file");
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    setImportStatus("Veuillez sélectionner un fichier ZIP.", true);
    return;
  }

  const confirmed = confirm(
    "Importer un backup remplacera la base courante et potentiellement les images. Continuer ?",
  );
  if (!confirmed) return;

  setImportStatus("Import en cours...");

  const fd = new FormData();
  fd.append("backupZip", fileInput.files[0]);

  try {
    const res = await fetch(`${API}/import`, {
      method: "POST",
      body: fd,
    });

    const payload = await res.json();
    if (!res.ok || payload.error) {
      throw new Error(payload.error || "Import impossible");
    }

    const migrationApplied = payload?.migration?.applied?.length > 0;
    if (migrationApplied) {
      const from = payload.migration.fromVersion;
      const to = payload.migration.toVersion;
      setImportStatus(`Import terminé. Données restaurées et schéma migré (${from} -> ${to}).`);
    } else {
      setImportStatus("Import terminé. Les données ont été restaurées.");
    }
    if (currentEntity) {
      await loadEntity(currentEntity);
    }
    fileInput.value = "";
  } catch (err) {
    setImportStatus(`Échec de l'import : ${err.message}`, true);
  }
}

function setMobileEntityNavOpen(open) {
  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.getElementById("entity-nav-toggle");
  if (!sidebar || !toggleBtn) return;

  isMobileEntityNavOpen = Boolean(open);
  sidebar.classList.toggle("is-mobile-nav-open", isMobileEntityNavOpen);
  toggleBtn.setAttribute("aria-expanded", isMobileEntityNavOpen ? "true" : "false");
}

function syncMobileEntityNavMode() {
  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.getElementById("entity-nav-toggle");
  if (!sidebar || !toggleBtn) return;

  if (mobileEntityNavMedia.matches) {
    setMobileEntityNavOpen(isMobileEntityNavOpen);
  } else {
    sidebar.classList.remove("is-mobile-nav-open");
    toggleBtn.setAttribute("aria-expanded", "false");
  }
}

function initMobileEntityNavToggle() {
  const toggleBtn = document.getElementById("entity-nav-toggle");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    if (!mobileEntityNavMedia.matches) return;
    setMobileEntityNavOpen(!isMobileEntityNavOpen);
  });

  if (typeof mobileEntityNavMedia.addEventListener === "function") {
    mobileEntityNavMedia.addEventListener("change", syncMobileEntityNavMode);
  } else if (typeof mobileEntityNavMedia.addListener === "function") {
    mobileEntityNavMedia.addListener(syncMobileEntityNavMode);
  }

  syncMobileEntityNavMode();
}

document.addEventListener("DOMContentLoaded", async () => {
  const isAuthorized = await ensureAdminSession();
  if (!isAuthorized) return;

  initMobileEntityNavToggle();
  initSelect2Admin();

  const importForm = document.getElementById("import-backup-form");
  if (importForm) {
    importForm.addEventListener("submit", handleBackupImport);
  }

  const storedState = readAdminViewState();
  if (storedState.lastEntity && storedState.entities?.[storedState.lastEntity]) {
    await loadEntity(storedState.lastEntity);
  }
});

async function addLink() {
  const targetType = document.getElementById("link-target-type").value;
  const targetId = document.getElementById("link-target-id").value;
  const desc = document.getElementById("link-description").value;

  if (!targetType || !targetId) return alert("Veuillez sélectionner qui lier.");

  const currentRelations = relationMapClient[currentEntity] || [];
  const rel = currentRelations.find(
    (r) => r.target === targetType,
  );
  if (!rel) return;

  if (rel.table === "Lien_evenement_evenement" && String(editingId) === String(targetId)) {
    return alert("Un évènement ne peut pas être lié à lui-même.");
  }
  if (rel.table === "Lien_entite_politique_entite_politique" && String(editingId) === String(targetId)) {
    return alert("Une entité politique ne peut pas être liée à elle-même.");
  }
  const payload = {};
  payload[rel.fkDest] = targetId;
  if (desc) payload.description = desc;

  if (tablesWithDates.has(rel.table)) {
    refreshLinkDateSuggestion();
    const dDebut = document.getElementById("link-date-debut")?.value;
    const pDebut = document.getElementById("link-precision-debut")?.value;
    const dFin = document.getElementById("link-date-fin")?.value;
    const pFin = document.getElementById("link-precision-fin")?.value;

    if (dDebut) payload.Date_Debut = dDebut;
    if (pDebut) payload.precision_Debut = pDebut;
    if (dFin) payload.Date_Fin = dFin;
    if (pFin) payload.precision_Fin = pFin;
  }

  if (!editingId) {
    const targetText = document.getElementById("link-target-id")?.selectedOptions?.[0]?.textContent || `ID ${targetId}`;
    pendingLinks.push({
      table: rel.table,
      fkSrc: rel.fkSrc,
      fkDest: rel.fkDest,
      targetType,
      targetLabel: targetText,
      targetMode: document.getElementById("link-target-mode")?.value || "existing",
      targetRef: targetId,
      payload,
    });
    renderPendingLinks();
    clearLinkTransientFields();
    return;
  }

  payload[rel.fkSrc] = editingId;

  try {
    const res = await fetch(`${API}/links/${rel.table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let backendMessage = "Impossible d'enregistrer ce lien.";
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await res.json();
      if (body?.error) backendMessage = body.error;
    } else {
      const text = await res.text();
      if (text) backendMessage = text;
    }

    if (!res.ok) {
      throw new Error(backendMessage);
    }

    await loadExistingLinks();
    clearLinkTransientFields();
  } catch (err) {
    alert(`Erreur lors de l'enregistrement du lien : ${err.message}`);
  }
}

function renderPendingLinks() {
  const list = document.getElementById("pending-links-list");
  if (!list) return;
  if (pendingLinks.length === 0) {
    list.innerHTML = "<li>Aucun lien en attente.</li>";
    return;
  }

  list.innerHTML = pendingLinks
    .map((link, index) => {
      const dates = link.payload.Date_Debut || link.payload.Date_Fin
        ? ` - ${escapeHtml(link.payload.Date_Debut || "?")} à ${escapeHtml(link.payload.Date_Fin || "?")}`
        : "";
      const desc = link.payload.description ? ` (${escapeHtml(link.payload.description)})` : "";
      return `<li><b>[${escapeHtml(link.targetType)}]</b> ${escapeHtml(link.targetLabel)}${dates}${desc}
        <button type="button" onclick="removePendingLink(${index})">Retirer</button></li>`;
    })
    .join("");
}

function removePendingLink(index) {
  pendingLinks.splice(index, 1);
  renderPendingLinks();
}

window.removePendingLink = removePendingLink;

async function createPendingLinks(newEntityId) {
  const failed = [];
  let okCount = 0;

  for (const pending of pendingLinks) {
    const payload = { ...pending.payload, [pending.fkSrc]: newEntityId };
    try {
      const res = await fetch(`${API}/links/${pending.table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Insertion refusée");
      }
      okCount += 1;
    } catch (e) {
      failed.push(`${pending.table}: ${e.message}`);
    }
  }

  pendingLinks = [];
  renderPendingLinks();

  if (failed.length > 0) {
    alert(`Entité créée. ${okCount} lien(s) ajouté(s), ${failed.length} échec(s).\n${failed.join("\n")}`);
  }
}

async function loadExistingLinks() {
  const list = document.getElementById("existing-links-list");
  list.innerHTML = "<li>Chargement...</li>";

  const relations = relationMapClient[currentEntity] || [];
  let html = "";

  for (let rel of relations) {
    // Fetch full table for that relation
    const res = await fetch(`${API}/links/${rel.table}`);
    const links = await res.json();

    // Fetch targets to display their names!
    const resTargets = await fetch(`${API}/entities/${rel.target}`);
    const targetData = await resTargets.json();
    const displayF = getDisplayField(rel.target);

    // For directional tables, only keep links where current item is source.
    // For symmetric tables, keep both sides.
    const isSymmetric = symmetricLinkTablesClient.has(rel.table);
    const activeLinks = links.filter((l) =>
      isSymmetric
        ? l[rel.fkSrc] == editingId || l[rel.fkDest] == editingId
        : l[rel.fkSrc] == editingId,
    );

    if (activeLinks.length > 0) {
      for (let link of activeLinks) {
        const targetID = isSymmetric
          ? (link[rel.fkSrc] == editingId ? link[rel.fkDest] : link[rel.fkSrc])
          : link[rel.fkDest];

        const targetEntity = targetData.find((t) => t.ID == targetID);
        const targetName = targetEntity
          ? targetEntity[displayF]
          : `(ID inconnu: ${targetID})`;

        const datePart = tablesWithDates.has(rel.table)
          ? ` ${link.Date_Debut || ""}${(link.Date_Debut || link.Date_Fin) ? " -> " : ""}${link.Date_Fin || ""}`
          : "";
        const deleteParams = datedTablesWithRowIdDelete.has(rel.table) && link.ID
          ? `'${rel.table}', '', '', 0, 0, ${Number(link.ID)}`
          : `'${rel.table}', '${rel.fkSrc}', '${rel.fkDest}', ${Number(link[rel.fkSrc])}, ${Number(link[rel.fkDest])}, 0`;

        html += `<li><b>[${rel.target}]</b>: ${escapeHtml(targetName)}${datePart ? ` <small>${escapeHtml(datePart)}</small>` : ""} <i>${link.description ? " (" + escapeHtml(link.description) + ")" : ""}</i>
                    <button type="button" onclick="deleteLink(${deleteParams})">Délier</button>
                    </li>`;
      }
    }
  }
  list.innerHTML = html || "<li>Aucun lien enregistré.</li>";
}

async function deleteLink(tableName, fkSrc, fkDest, srcId, destId, rowId = 0) {
  if (!confirm("Retirer ce lien ?")) return;
  const query = rowId
    ? `ID=${rowId}`
    : `${fkSrc}=${srcId}&${fkDest}=${destId}`;
  await fetch(
    `${API}/links/${tableName}?${query}`,
    {
      method: "DELETE",
    },
  );
  loadExistingLinks(); // Refresh list
}

window.deleteLink = deleteLink;

function cancelForm() {
  loadEntity(currentEntity);
}

document.getElementById("entity-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {};
  schemas[currentEntity].forEach((f) => {
    data[f.name] = document.getElementById(`input_${f.name}`).value;
  });

  const method = editingId ? "PUT" : "POST";
  const url = editingId
    ? `${API}/entities/${currentEntity}/${editingId}`
    : `${API}/entities/${currentEntity}`;

  let responsePayload = null;

  if (currentEntity === "Image" && !editingId) {
    const imageInput = document.getElementById("input_imageFile");
    if (!imageInput?.files?.length) {
      alert("Veuillez sélectionner une image à uploader.");
      return;
    }

    const fd = new FormData();
    fd.append("imageFile", imageInput.files[0]);
    fd.append("Titre", data.Titre || "");
    fd.append("description", data.description || "");

    const res = await fetch(`${API}/entities/Image/upload`, {
      method: "POST",
      body: fd,
    });
    responsePayload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(responsePayload.error || "Upload image impossible.");
      return;
    }
  } else {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    responsePayload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(responsePayload.error || "Sauvegarde impossible.");
      return;
    }
  }

  if (!editingId && pendingLinks.length > 0) {
    const createdId = Number(responsePayload?.id);
    if (Number.isInteger(createdId) && createdId > 0) {
      await createPendingLinks(createdId);
    }
  }

  loadEntity(currentEntity);
});

async function deleteRow(id) {
  if (
    !confirm(
      "Attention, supprimer cette entité supprimera également tous ses liens en cascade. Continuer ?",
    )
  )
    return;
  await fetch(`${API}/entities/${currentEntity}/${id}`, { method: "DELETE" });
  loadEntity(currentEntity);
}

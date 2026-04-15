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

const datedTablesWithRowIdDelete = new Set([
  "Lien_personnage_fonctions",
  "Lien_personnage_lieux",
  "Lien_lieu_entite_politique",
  "Lien_fonctions_entite_politique",
  "Lien_entite_politique_entite_politique",
]);

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
    "#link-target-type, #link-target-id, .admin-filter-kind, .admin-filter-target-type, .admin-filter-target-values, #bulk-link-target-type, #bulk-link-target-ids",
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
  currentEntity = entity;
  sortState = { field: null, dir: "asc" };
  pendingLinks = [];
  selectedRowIds.clear();
  adminFilters = [];
  nextAdminFilterId = 1;
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
  document.getElementById("admin-filters-panel").style.display = "block";
  document.getElementById("admin-search-input").value = ""; // reset search
  document.getElementById("form-container").style.display = "none";
  document.getElementById("data-table-container").style.display = "block";
  document.getElementById("bulk-editor-container").style.display = "none";

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
  const selectId = document.getElementById("link-target-id");
  const dateFields = document.getElementById("link-date-fields");
  selectId.innerHTML = '<option value="">Chargement...</option>';

  if (!targetType) {
    if (dateFields) dateFields.style.display = "none";
    return;
  }

  const currentRelations = relationMapClient[currentEntity] || [];
  const rel = currentRelations.find(
    (r) => r.target === targetType,
  );

  if (!rel) {
    if (dateFields) dateFields.style.display = "none";
    return;
  }

  if (tablesWithDates.has(rel.table) && dateFields) {
    dateFields.style.display = "block";
  } else if (dateFields) {
    dateFields.style.display = "none";
  }

  const res = await fetch(`${API}/entities/${targetType}`);
  let data = await res.json();

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

  initSelect2Admin();
}

function handleLinkTargetSelectionChange() {
  clearLinkTransientFields();
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

window.toggleBulkEditor = toggleBulkEditor;
window.onBulkActionChanged = onBulkActionChanged;
window.loadBulkTargetOptions = loadBulkTargetOptions;
window.submitBulkLinks = submitBulkLinks;

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

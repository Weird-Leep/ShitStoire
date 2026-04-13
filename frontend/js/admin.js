const API = "/api";
let currentEntity = null;
let currentRows = [];
let cachedLinkData = {};
let editingId = null;
let pendingLinks = [];
let sortState = { field: null, dir: "asc" };

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
    '#link-target-type, #link-target-id',
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
  document.getElementById("current-entity-title").innerText =
    "Gestion - " + entity;

  const headersTr = document.getElementById("table-headers");
  const tbody = document.getElementById("table-body");
  headersTr.innerHTML = "<th>Chargement...</th>";
  tbody.innerHTML = "";

  document.getElementById("btn-add-new").style.display = "inline-block";
  document.getElementById("admin-search-input").style.display = "inline-block";
  document.getElementById("admin-search-input").value = ""; // reset search
  document.getElementById("form-container").style.display = "none";
  document.getElementById("data-table-container").style.display = "block";

  const res = await fetch(`${API}/entities/${entity}`);
  currentRows = await res.json();

  // Attempt to load associated links for preview in table
  const relationships = relationMapClient[entity] || [];
  const linkData = {};
  for (let r of relationships) {
    linkData[r.target] = [];
    try {
      const tableRes = await fetch(`${API}/links/${r.table}`);
      const tableLinks = await tableRes.json();

      const targetRes = await fetch(`${API}/entities/${r.target}`);
      const targets = await targetRes.json();

      const displayF = getDisplayField(r.target);

      tableLinks.forEach((l) => {
        const isSrcMe =
          l[r.fkSrc] !== undefined &&
          l[r.fkSrc] !== null &&
          l[r.fkDest] !== undefined;
        if (isSrcMe) {
          const myId = l[r.fkSrc];
          const theirId = l[r.fkDest];
          const targetEntity = targets.find((t) => t.ID == theirId);
          if (targetEntity) {
            if (!linkData[r.target][myId]) linkData[r.target][myId] = [];
            linkData[r.target][myId].push(targetEntity[displayF]);
          }
        }
      });
    } catch (e) {}
  }
  
  cachedLinkData = linkData;
  renderAdminTable(currentRows);
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
  filterAdminTable();
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

  headersTr.innerHTML =
    fieldHeaders +
    extraHeaders +
    `<th>Actions</th>`;

  tbody.innerHTML = "";

  if (!Array.isArray(rowsToRender) || rowsToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${schemas[currentEntity].length + relationships.length + 1}">Aucune donnée trouvée.</td></tr>`;
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
      baseCols +
      extraCols +
      `<td><button onclick="editRow(${row.ID})">Éditer/Lier</button> <button onclick="deleteRow(${row.ID})">Supprimer</button></td>`;
    tbody.appendChild(tr);
  });
}

function filterAdminTable() {
  const q = document.getElementById("admin-search-input").value.toLowerCase();
  if (!q) return renderAdminTable(currentRows);

  const relationships = relationMapClient[currentEntity] || [];

  const filtered = currentRows.filter((row) => {
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

  renderAdminTable(filtered);
}

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

document.addEventListener("DOMContentLoaded", async () => {
  const isAuthorized = await ensureAdminSession();
  if (!isAuthorized) return;

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

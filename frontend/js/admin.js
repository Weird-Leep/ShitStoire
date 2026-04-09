const API = "/api";
let currentEntity = null;
let currentRows = [];
let cachedLinkData = {}; // Cache the link data for filtering
let editingId = null;

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
      label: "Coordonnées (GPS format Libre)",
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
};

async function loadEntity(entity) {
  currentEntity = entity;
  document.getElementById("current-entity-title").innerText =
    "Gestion - " + entity;

  const headersTr = document.getElementById("table-headers");
  const tbody = document.getElementById("table-body");
  headersTr.innerHTML = "<th>Chargement...</th>";
  tbody.innerHTML = "";

  if (!schemas[entity]) {
    document.getElementById("btn-add-new").style.display = "none";
    document.getElementById("admin-search-input").style.display = "none";
    document.getElementById("form-container").style.display = "none";
    document.getElementById("data-table-container").style.display = "block";
    headersTr.innerHTML = "<th>Information</th>";
    tbody.innerHTML =
      "<tr><td>Gestion (ajout, modification) non configurée pour cette entité (Ex: Images).</td></tr>";
    return;
  }

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

function renderAdminTable(rowsToRender) {
  const headersTr = document.getElementById("table-headers");
  const tbody = document.getElementById("table-body");
  
  if (!schemas[currentEntity]) return;
  const relationships = relationMapClient[currentEntity] || [];

  // RENDER Table
  let extraHeaders = relationships
    .map((r) => `<th>Liens: ${r.target}</th>`)
    .join("");
  headersTr.innerHTML =
    schemas[currentEntity].map((f) => `<th>${f.label}</th>`).join("") +
    extraHeaders +
    `<th>Actions</th>`;

  tbody.innerHTML = "";

  if (!Array.isArray(rowsToRender) || rowsToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${schemas[currentEntity].length + relationships.length + 1}">Aucune donnée trouvée.</td></tr>`;
    return;
  }

  rowsToRender.forEach((row) => {
    const tr = document.createElement("tr");

    let extraCols = relationships
      .map((r) => {
        const links = cachedLinkData[r.target] && cachedLinkData[r.target][row.ID] ? cachedLinkData[r.target][row.ID] : [];
        return `<td><small>${links.join(", ")}</small></td>`;
      })
      .join("");

    tr.innerHTML =
      schemas[currentEntity].map((f) => `<td>${row[f.name] || ""}</td>`).join("") +
      extraCols +
      `<td><button onclick="editRow(${row.ID})">Éditer/Lier</button> <button onclick="deleteRow(${row.ID})">Supprimer</button></td>`;
    tbody.appendChild(tr);
  });
}

function filterAdminTable() {
  const q = document.getElementById("admin-search-input").value.toLowerCase();
  if (!q) {
    renderAdminTable(currentRows);
    return;
  }

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

  document.getElementById("form-title").innerText = rowData
    ? `Modifier ${currentEntity}`
    : `Créer ${currentEntity}`;
  document.getElementById("links-manager-container").style.display = rowData
    ? "block"
    : "none"; // Only link after creation

  initSelect2Admin();
}

async function editRow(id) {
  const row = currentRows.find((r) => r.ID === id);
  showAddForm(row);

  // Links Manager
  document.getElementById("links-manager-container").style.display = "block";
  populateLinkTargetTypes();
  loadExistingLinks();
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
  ],
  Fonctions: [
    {
      target: "Entite_politique",
      table: "Lien_fonctions_entite_politique",
      fkSrc: "ID_fonctions",
      fkDest: "ID_entite_politique",
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
      target: "Tags",
      table: "Lien_entite_politique_tags",
      fkSrc: "ID_entite_politique",
      fkDest: "ID_tags",
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
};

function populateLinkTargetTypes() {
  const select = document.getElementById("link-target-type");
  const relations = relationMapClient[currentEntity] || [];
  select.innerHTML =
    '<option value="">-- Sélectionnez un type à lier --</option>';
  relations.forEach((rel) => {
    select.innerHTML += `<option value="${rel.target}">${rel.target}</option>`;
  });
  document.getElementById("link-target-id").innerHTML = ""; // reset options
  initSelect2Admin();
}

async function loadLinkTargets() {
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

  // Check if relation table supports dates
  const tablesWithDates = [
    "Lien_personnage_fonctions",
    "Lien_personnage_lieux",
    "Lien_lieu_entite_politique",
    "Lien_fonctions_entite_politique",
  ];
  if (tablesWithDates.includes(rel.table) && dateFields) {
    dateFields.style.display = "block";
  } else if (dateFields) {
    dateFields.style.display = "none";
  }

  const res = await fetch(`${API}/entities/${targetType}`);
  let data = await res.json();

  if (rel.table === "Lien_evenement_evenement" && editingId) {
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

document.addEventListener("DOMContentLoaded", () => {
  initSelect2Admin();
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
  const tablesWithDates = [
    "Lien_personnage_fonctions",
    "Lien_personnage_lieux",
    "Lien_lieu_entite_politique",
    "Lien_fonctions_entite_politique",
  ];

  const payload = {};
  payload[rel.fkSrc] = editingId;
  payload[rel.fkDest] = targetId;
  if (desc) payload.description = desc;

  if (tablesWithDates.includes(rel.table)) {
    const dDebut = document.getElementById("link-date-debut")?.value;
    const pDebut = document.getElementById("link-precision-debut")?.value;
    const dFin = document.getElementById("link-date-fin")?.value;
    const pFin = document.getElementById("link-precision-fin")?.value;

    if (dDebut) payload.Date_Debut = dDebut;
    if (pDebut) payload.precision_Debut = pDebut;
    if (dFin) payload.Date_Fin = dFin;
    if (pFin) payload.precision_Fin = pFin;
  }

  await fetch(`${API}/links/${rel.table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await loadExistingLinks();
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

    // Filter the ones that affect the CURRENT entity's ID
    const activeLinks = links.filter(
      (l) => l[rel.fkSrc] == editingId || l[rel.fkDest] == editingId,
    );

    if (activeLinks.length > 0) {
      for (let link of activeLinks) {
        const isSrcMe = link[rel.fkSrc] == editingId;
        const targetID = isSrcMe ? link[rel.fkDest] : link[rel.fkSrc];

        const targetEntity = targetData.find((t) => t.ID == targetID);
        const targetName = targetEntity
          ? targetEntity[displayF]
          : `(ID inconnu: ${targetID})`;

        html += `<li><b>[${rel.target}]</b>: ${targetName} <i>${link.description ? " (" + link.description + ")" : ""}</i> 
                    <button type="button" onclick="deleteLink('${rel.table}', '${rel.fkSrc}', '${rel.fkDest}', ${link[rel.fkSrc]}, ${link[rel.fkDest]})">Délier</button>
                    </li>`;
      }
    }
  }
  list.innerHTML = html || "<li>Aucun lien enregistré.</li>";
}

async function deleteLink(tableName, fkSrc, fkDest, srcId, destId) {
  if (!confirm("Retirer ce lien ?")) return;
  await fetch(
    `${API}/links/${tableName}?${fkSrc}=${srcId}&${fkDest}=${destId}`,
    {
      method: "DELETE",
    },
  );
  loadExistingLinks(); // Refresh list
}

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

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
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

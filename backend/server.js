const express = require('express');
const cors = require('cors');
const path = require('path');
const dbModule = require('./db');
const { adminRouter, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/admin', adminRouter);

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Static files for Frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); // For uploaded images

// Routes
const entitiesRoutes = require('./routes/entities');
const linksRoutes = require('./routes/links');
const multer = require('multer');
const AdmZip = require('adm-zip');

const archiver = require('archiver');
const fs = require('fs');

const allowedEntityTables = new Set(['Evenement', 'Personnages', 'Image', 'Fonctions', 'Tags', 'Lieu', 'Entite_politique', 'Source']);
const allowedBulkLinkTables = new Set([
    'Lien_image_evenement', 'Lien_image_personnage', 'Lien_image_fonctions',
    'Lien_image_tags', 'Lien_image_lieu', 'Lien_image_entite_politique', 'Lien_image_source',
    'Lien_evenement_personnage', 'Lien_evenement_lieux', 'Lien_evenement_tags', 'Lien_evenement_sources',
    'Lien_evenement_entite_politique',
    'Lien_personnage_fonctions', 'Lien_personnage_lieux', 'Lien_personnage_sources', 'Lien_personnage_personnage',
    'Lien_lieu_entite_politique', 'Lien_lieu_sources',
    'Lien_personnage_entite_politique', 'Lien_evenement_evenement',
    'Lien_fonctions_entite_politique', 'Lien_fonctions_sources',
    'Lien_personnage_tags', 'Lien_entite_politique_tags',
    'Lien_entite_politique_sources', 'Lien_entite_politique_entite_politique'
]);

const symmetricBulkLinkTables = {
    Lien_personnage_personnage: ['ID_personnage_A', 'ID_personnage_B'],
    Lien_evenement_evenement: ['ID_evenement_A', 'ID_evenement_B'],
    Lien_entite_politique_entite_politique: ['ID_entite_politique_A', 'ID_entite_politique_B'],
};

function getTableColumns(table) {
    const cols = dbModule.pragma(`table_info(${table})`) || [];
    return cols.map((col) => col.name);
}

function sanitizeInsertPayload(table, payload) {
    const columns = new Set(getTableColumns(table));
    const safe = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (!columns.has(key) || key === 'ID') return;
        safe[key] = value;
    });
    return safe;
}

function resolveBulkReferenceValue(value, refMap) {
    if (typeof value === 'string' && value in refMap) {
        return refMap[value];
    }

    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.ref === 'string') {
        if (!(value.ref in refMap)) {
            throw new Error(`Unknown draft reference: ${value.ref}`);
        }
        return refMap[value.ref];
    }
    return value;
}

function resolveBulkPayloadReferences(payload, refMap) {
    const resolved = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
        resolved[key] = resolveBulkReferenceValue(value, refMap);
    });
    return resolved;
}

function getForeignKeyRules(table) {
    const fkRows = dbModule.pragma(`foreign_key_list(${table})`) || [];
    const seen = new Set();
    return fkRows.filter((row) => {
        if (!row.from || !row.table || !row.to) return false;
        if (seen.has(row.from)) return false;
        seen.add(row.from);
        return true;
    });
}

function validateForeignKeyReferences(table, payload) {
    const fkRules = getForeignKeyRules(table);

    for (const fk of fkRules) {
        const rawValue = payload[fk.from];
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
            throw new Error(`Missing required identifier: ${fk.from}`);
        }

        const parsedId = Number(rawValue);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            throw new Error(`Invalid identifier for ${fk.from}`);
        }

        payload[fk.from] = parsedId;

        const exists = dbModule.prepare(`SELECT 1 FROM ${fk.table} WHERE ${fk.to} = ? LIMIT 1`).get(parsedId);
        if (!exists) {
            throw new Error(`Referenced ${fk.table}(${fk.to}) does not exist: ${parsedId}`);
        }
    }
}

function normalizeBulkSymmetricPayload(table, payload) {
    const rule = symmetricBulkLinkTables[table];
    if (!rule) return;

    const [fieldA, fieldB] = rule;
    const a = Number(payload[fieldA]);
    const b = Number(payload[fieldB]);
    if (a === b) {
        throw new Error('Self links are not allowed');
    }
    if (a > b) {
        payload[fieldA] = b;
        payload[fieldB] = a;
    }
}

function validateBulkEntityTable(table) {
    return allowedEntityTables.has(table);
}

function validateBulkLinkTable(table) {
    return allowedBulkLinkTables.has(table);
}

app.use('/api/entities', (req, res, next) => {
    if (req.method === 'GET') return next();
    return requireAdmin(req, res, next);
}, entitiesRoutes);

app.use('/api/links', (req, res, next) => {
    if (req.method === 'GET') return next();
    return requireAdmin(req, res, next);
}, linksRoutes);

app.post('/api/bulk-transaction', requireAdmin, (req, res) => {
    if (req.body?.atomic !== true) {
        return res.status(400).json({ error: 'atomic must be true' });
    }

    const createEntities = Array.isArray(req.body?.createEntities) ? req.body.createEntities : [];
    const createLinks = Array.isArray(req.body?.createLinks) ? req.body.createLinks : [];

    const result = {
        successCount: 0,
        failureCount: 0,
        failures: [],
        entities: [],
        links: [],
    };

    try {
        const runBulk = dbModule.getDb().transaction(() => {
            const refMap = {};

            createEntities.forEach((entry, index) => {
                const table = entry?.table || entry?.entity;
                const ref = entry?.ref || `${table || 'entity'}:${index}`;
                const data = entry?.data || entry?.payload || {};

                if (!table || !validateBulkEntityTable(table)) {
                    throw new Error(`Invalid entity table at index ${index}`);
                }
                if (!ref || typeof ref !== 'string') {
                    throw new Error(`Invalid entity reference at index ${index}`);
                }
                if (refMap[ref] !== undefined) {
                    throw new Error(`Duplicate entity reference: ${ref}`);
                }

                const payload = sanitizeInsertPayload(table, data);
                if (Object.keys(payload).length === 0) {
                    throw new Error(`Empty payload for entity ${table} at index ${index}`);
                }

                const fields = Object.keys(payload);
                const values = Object.values(payload);
                const qs = fields.map(() => '?').join(', ');
                const info = dbModule.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${qs})`).run(values);

                refMap[ref] = Number(info.lastInsertRowid);
                refMap[`${table}:${index}`] = Number(info.lastInsertRowid);
                result.entities.push({ ref, table, id: Number(info.lastInsertRowid) });
                result.successCount += 1;
            });

            createLinks.forEach((entry, index) => {
                const table = entry?.table;
                if (!table || !validateBulkLinkTable(table)) {
                    throw new Error(`Invalid link table at index ${index}`);
                }

                const rawPayload = entry?.payload || entry?.data || {};
                const resolvedPayload = resolveBulkPayloadReferences(rawPayload, refMap);
                const payload = sanitizeInsertPayload(table, resolvedPayload);

                normalizeBulkSymmetricPayload(table, payload);
                validateForeignKeyReferences(table, payload);

                const fields = Object.keys(payload);
                if (fields.length === 0) {
                    throw new Error(`Empty payload for link ${table} at index ${index}`);
                }

                const values = Object.values(payload);
                const qs = fields.map(() => '?').join(', ');
                dbModule.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${qs})`).run(values);

                result.links.push({ table, index });
                result.successCount += 1;
            });
        });

        runBulk();
        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            error: err.message,
            successCount: 0,
            failureCount: createEntities.length + createLinks.length,
            failures: [{ error: err.message }],
        });
    }
});

// --- FEATURE EXPORT: Permet l'export des données et des images (Bonus de fin) ---
app.get('/api/export', requireAdmin, (req, res) => {
    // Crée une archive ZIP à la volée contenant la DB locale et les images stockées
    const archive = archiver('zip', { zlib: { level: 9 } });
    const exportDate = new Date().toISOString().slice(0, 10);

    res.attachment(`shitstoire_export_${exportDate}.zip`); // Indique au navigateur un téléchargement forcé
    archive.pipe(res);

    // Ajout de la base de données SQL
    const dbFile = path.join(__dirname, '../shitstoire_db.sqlite');
    if (fs.existsSync(dbFile)) {
        archive.file(dbFile, { name: 'shitstoire_db.sqlite' });
    }

    // Ajout du dossier complet contenant les images uploadées (S'il existe)
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'images_uploadées');
    }

    archive.finalize();
});

const importUploadDir = path.join(__dirname, '../tmp/import_uploads');
fs.mkdirSync(importUploadDir, { recursive: true });

const importUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, importUploadDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
});

function findFirstFileRecursive(dirPath, predicate) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const found = findFirstFileRecursive(fullPath, predicate);
            if (found) return found;
        } else if (predicate(fullPath, entry.name)) {
            return fullPath;
        }
    }

    return null;
}

function findFirstDirectoryRecursive(dirPath, predicate) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (!entry.isDirectory()) continue;

        if (predicate(fullPath, entry.name)) {
            return fullPath;
        }

        const found = findFirstDirectoryRecursive(fullPath, predicate);
        if (found) return found;
    }

    return null;
}

function safeRemove(pathToDelete) {
    fs.rmSync(pathToDelete, { recursive: true, force: true });
}

// --- FEATURE IMPORT: Restaure explicitement la DB et, optionnellement, les images depuis un export ZIP ---
app.post('/api/import', requireAdmin, importUpload.single('backupZip'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier ZIP fourni.' });
    }

    const dbFile = dbModule.dbPath;
    const uploadsDir = path.join(__dirname, '../uploads');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, `../backups/pre-import-${stamp}`);
    const runtimeDir = path.join(__dirname, `../tmp/import_runtime-${stamp}`);
    const extractDir = path.join(runtimeDir, 'extracted');

    let dbClosed = false;
    let restoreError = null;

    try {
        fs.mkdirSync(backupDir, { recursive: true });
        fs.mkdirSync(extractDir, { recursive: true });

        if (fs.existsSync(dbFile)) {
            fs.copyFileSync(dbFile, path.join(backupDir, 'shitstoire_db.sqlite'));
        }

        if (fs.existsSync(uploadsDir)) {
            fs.cpSync(uploadsDir, path.join(backupDir, 'uploads'), { recursive: true });
        }

        const zip = new AdmZip(req.file.path);
        zip.extractAllTo(extractDir, true);

        const importedDbPath = findFirstFileRecursive(
            extractDir,
            (fullPath, fileName) => fileName.toLowerCase().endsWith('.sqlite') || fullPath.toLowerCase().endsWith('.sqlite')
        );

        if (!importedDbPath) {
            throw new Error('Le ZIP ne contient aucun fichier .sqlite.');
        }

        const importedUploadsPath = findFirstDirectoryRecursive(
            extractDir,
            (fullPath, dirName) => dirName.toLowerCase().startsWith('images_upload') || fullPath.toLowerCase().includes('images_upload')
        );

        dbModule.closeDb();
        dbClosed = true;

        fs.copyFileSync(importedDbPath, dbFile);

        if (importedUploadsPath) {
            safeRemove(uploadsDir);
            fs.cpSync(importedUploadsPath, uploadsDir, { recursive: true });
        }

        dbModule.reopenDb();
        dbClosed = false;

        const migrationReport = dbModule.getLastMigrationReport
            ? dbModule.getLastMigrationReport()
            : { fromVersion: 0, toVersion: 0, applied: [] };

        res.json({
            success: true,
            message: 'Import effectué avec succès.',
            backupDir,
            importedUploads: Boolean(importedUploadsPath),
            migration: migrationReport,
        });
    } catch (err) {
        try {
            const backupDbPath = path.join(backupDir, 'shitstoire_db.sqlite');
            const backupUploadsPath = path.join(backupDir, 'uploads');

            if (dbClosed) {
                if (fs.existsSync(backupDbPath)) {
                    fs.copyFileSync(backupDbPath, dbFile);
                }

                if (fs.existsSync(backupUploadsPath)) {
                    safeRemove(uploadsDir);
                    fs.cpSync(backupUploadsPath, uploadsDir, { recursive: true });
                }

                dbModule.reopenDb();
                dbClosed = false;
            }
        } catch (rollbackErr) {
            restoreError = rollbackErr.message;
        }

        res.status(500).json({
            error: err.message,
            rollbackError: restoreError,
        });
    } finally {
        if (dbClosed) {
            try {
                dbModule.reopenDb();
            } catch (reopenErr) {
                console.error('Impossible de rouvrir la base après import:', reopenErr);
            }
        }

        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        safeRemove(runtimeDir);
    }
});

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found.' });
});

// Fallback to index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
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

app.use('/api/entities', (req, res, next) => {
    if (req.method === 'GET') return next();
    return requireAdmin(req, res, next);
}, entitiesRoutes);

app.use('/api/links', (req, res, next) => {
    if (req.method === 'GET') return next();
    return requireAdmin(req, res, next);
}, linksRoutes);

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

// Fallback to index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
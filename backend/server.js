const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for Frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); // For uploaded images

// Routes
const entitiesRoutes = require('./routes/entities');
const linksRoutes = require('./routes/links');

const archiver = require('archiver');
const fs = require('fs');

app.use('/api/entities', entitiesRoutes);
app.use('/api/links', linksRoutes);

// --- FEATURE EXPORT: Permet l'export des données et des images (Bonus de fin) ---
app.get('/api/export', (req, res) => {
    // Crée une archive ZIP à la volée contenant la DB locale et les images stockées
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment('shitstoire_export.zip'); // Indique au navigateur un téléchargement forcé
    archive.pipe(res);

    // Ajout de la base de données SQL
    const dbFile = path.join(__dirname, '../database_export.sqlite');
    if (fs.existsSync(dbFile)) {
        archive.file(dbFile, { name: 'database_export.sqlite' });
    }

    // Ajout du dossier complet contenant les images uploadées (S'il existe)
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'images_uploadées');
    }

    archive.finalize();
});

// Fallback to index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
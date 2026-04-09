const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// Image Upload Config
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
        filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
    })
});

const allowedTables = ['Evenement', 'Personnages', 'Image', 'Fonctions', 'Tags', 'Lieu', 'Entite_politique', 'Source'];

// Generic Validations
function isValid(entity) {
    return allowedTables.includes(entity);
}

// Map tables to automatically clean their link tables (pseudo CASCADE DELETE)
const relationMap = {
    'Evenement': ['Lien_image_evenement', 'Lien_evenement_personnage', 'Lien_evenement_lieux', 'Lien_evenement_tags', 'Lien_evenement_sources', 'Lien_evenement_evenement'],
    'Personnages': ['Lien_image_personnage', 'Lien_evenement_personnage', 'Lien_personnage_fonctions', 'Lien_personnage_lieux', 'Lien_personnage_sources', 'Lien_personnage_personnage', 'Lien_personnage_entite_politique', 'Lien_personnage_tags'],
    'Lieu': ['Lien_image_lieu', 'Lien_evenement_lieux', 'Lien_personnage_lieux', 'Lien_lieu_entite_politique'],
    'Entite_politique': ['Lien_image_entite_politique', 'Lien_lieu_entite_politique', 'Lien_personnage_entite_politique', 'Lien_fonctions_entite_politique', 'Lien_entite_politique_tags'],
    'Fonctions': ['Lien_image_fonctions', 'Lien_personnage_fonctions', 'Lien_fonctions_entite_politique'],
    'Tags': ['Lien_image_tags', 'Lien_evenement_tags', 'Lien_personnage_tags', 'Lien_entite_politique_tags'],
    'Source': ['Lien_image_source', 'Lien_evenement_sources', 'Lien_personnage_sources'],
    'Image': ['Lien_image_evenement', 'Lien_image_personnage', 'Lien_image_fonctions', 'Lien_image_tags', 'Lien_image_lieu', 'Lien_image_entite_politique', 'Lien_image_source']
};

const symmetricLinkTables = {
    'Lien_personnage_personnage': ['ID_personnage_A', 'ID_personnage_B'],
    'Lien_evenement_evenement': ['ID_evenement_A', 'ID_evenement_B']
};

function cleanupRelations(entity, id) {
    if (!relationMap[entity]) return;
    relationMap[entity].forEach(relTable => {
        try {
            if (symmetricLinkTables[relTable]) {
                const [colA, colB] = symmetricLinkTables[relTable];
                db.prepare(`DELETE FROM ${relTable} WHERE ${colA} = ? OR ${colB} = ?`).run(id, id);
            } else {
                const cols = db.pragma(`table_info(${relTable})`);
                const idCols = cols.filter(c => c.name.toLowerCase().includes(entity.toLowerCase()) && c.name.startsWith('ID_'));
                idCols.forEach(col => db.prepare(`DELETE FROM ${relTable} WHERE ${col.name} = ?`).run(id));
            }
        } catch(e) {
            console.error(`Error cascaded delete in ${relTable}:`, e);
        }
    });
}

// -- ROUTES --

// Upload
router.post('/Image/upload', upload.single('imageFile'), (req, res) => {
    if(!req.file) return res.status(400).json({error: 'No file uploaded'});
    const { Titre, description } = req.body;
    const chemin_fichier = '/uploads/' + req.file.filename;
    
    try {
        const info = db.prepare('INSERT INTO Image (Titre, description, chemin_fichier) VALUES (?, ?, ?)')
            .run(Titre || '', description || '', chemin_fichier);
        res.json({ id: info.lastInsertRowid, chemin_fichier });
    } catch(err) { res.status(500).json({error: err.message}); }
});

// GET all
router.get('/:entity', (req, res) => {
    if(!isValid(req.params.entity)) return res.status(400).send('Invalid entity');
    try { res.json(db.prepare(`SELECT * FROM ${req.params.entity}`).all()); } 
    catch(err) { res.status(500).json({error: err.message}); }
});

// GET one
router.get('/:entity/:id', (req, res) => {
    if(!isValid(req.params.entity)) return res.status(400).send();
    try { 
        const row = db.prepare(`SELECT * FROM ${req.params.entity} WHERE ID = ?`).get(req.params.id);
        res.json(row || {error: 'Not found'});
    } catch(err) { res.status(500).json({error: err.message}); }
});

// CREATE (POST)
router.post('/:entity', (req, res) => {
    if(!isValid(req.params.entity)) return res.status(400).send();
    try {
        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        const qs = fields.map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT INTO ${req.params.entity} (${fields.join(',')}) VALUES (${qs})`);
        const info = stmt.run(values);
        res.json({id: info.lastInsertRowid});
    } catch(err) { res.status(500).json({error: err.message}); }
});

// UPDATE (PUT)
router.put('/:entity/:id', (req, res) => {
    if(!isValid(req.params.entity)) return res.status(400).send();
    try {
        const fields = Object.keys(req.body).map(f => `${f} = ?`).join(', ');
        const values = Object.values(req.body);
        const stmt = db.prepare(`UPDATE ${req.params.entity} SET ${fields} WHERE ID = ?`);
        stmt.run(...values, req.params.id);
        res.json({success: true});
    } catch(err) { res.status(500).json({error: err.message}); }
});

// DELETE
router.delete('/:entity/:id', (req, res) => {
    if(!isValid(req.params.entity)) return res.status(400).send();
    try {
        cleanupRelations(req.params.entity, req.params.id);
        db.prepare(`DELETE FROM ${req.params.entity} WHERE ID = ?`).run(req.params.id);
        res.json({success: true});
    } catch(err) { res.status(500).json({error: err.message}); }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');

// List of allowed link tables (to prevent injection)
const linkTables = [
    'Lien_image_evenement', 'Lien_image_personnage', 'Lien_image_fonctions', 
    'Lien_image_tags', 'Lien_image_lieu', 'Lien_image_entite_politique', 'Lien_image_source',
    'Lien_evenement_personnage', 'Lien_evenement_lieux', 'Lien_evenement_tags', 'Lien_evenement_sources',
    'Lien_personnage_fonctions', 'Lien_personnage_lieux', 'Lien_personnage_sources', 'Lien_personnage_personnage',
    'Lien_lieu_entite_politique', 'Lien_personnage_entite_politique'
];

function isLinkValid(table) { return linkTables.includes(table); }

// Generic fetch by link table name
router.get('/:table', (req, res) => {
    if(!isLinkValid(req.params.table)) return res.status(400).send('Invalid link table');
    try {
        res.json(db.prepare(`SELECT * FROM ${req.params.table}`).all());
    } catch(err) { res.status(500).json({error: err.message}); }
});

// Generic add link
router.post('/:table', (req, res) => {
    if(!isLinkValid(req.params.table)) return res.status(400).send();
    try {
        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        const qs = fields.map(() => '?').join(', ');
        db.prepare(`INSERT INTO ${req.params.table} (${fields.join(',')}) VALUES (${qs})`).run(values);
        res.json({success: true});
    } catch(err) { res.status(500).json({error: err.message}); }
});

// Generic delete link (requires keys in query)
router.delete('/:table', (req, res) => {
    if(!isLinkValid(req.params.table)) return res.status(400).send();
    try {
        const fields = Object.keys(req.query);
        const whereClause = fields.map(f => `${f} = ?`).join(' AND ');
        const values = Object.values(req.query);
        if(!whereClause) return res.status(400).json({error: 'Identifiers missing'});
        
        db.prepare(`DELETE FROM ${req.params.table} WHERE ${whereClause}`).run(...values);
        res.json({success: true});
    } catch(err) { res.status(500).json({error: err.message}); }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');

// List of allowed link tables (to prevent injection)
const linkTables = [
    'Lien_image_evenement', 'Lien_image_personnage', 'Lien_image_fonctions', 
    'Lien_image_tags', 'Lien_image_lieu', 'Lien_image_entite_politique', 'Lien_image_source',
    'Lien_evenement_personnage', 'Lien_evenement_lieux', 'Lien_evenement_tags', 'Lien_evenement_sources',
    'Lien_personnage_fonctions', 'Lien_personnage_lieux', 'Lien_personnage_sources', 'Lien_personnage_personnage',
    'Lien_lieu_entite_politique', 'Lien_personnage_entite_politique', 'Lien_evenement_evenement', 'Lien_fonctions_entite_politique', 'Lien_personnage_tags', 'Lien_entite_politique_tags'
];

function isLinkValid(table) { return linkTables.includes(table); }

function getForeignKeyRules(table) {
    const fkRows = db.pragma(`foreign_key_list(${table})`);
    const seen = new Set();
    return fkRows.filter((row) => {
        if (!row.from || !row.table || !row.to) return false;
        if (seen.has(row.from)) return false;
        seen.add(row.from);
        return true;
    });
}

function validateReferencedIds(table, payload) {
    const fkRules = getForeignKeyRules(table);

    for (const fk of fkRules) {
        const rawValue = payload[fk.from];
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
            return { ok: false, error: `Missing required identifier: ${fk.from}` };
        }

        const parsedId = Number(rawValue);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            return { ok: false, error: `Invalid identifier for ${fk.from}` };
        }

        payload[fk.from] = parsedId;

        const exists = db.prepare(`SELECT 1 FROM ${fk.table} WHERE ${fk.to} = ? LIMIT 1`).get(parsedId);
        if (!exists) {
            return { ok: false, error: `Referenced ${fk.table}(${fk.to}) does not exist: ${parsedId}` };
        }
    }

    return { ok: true };
}

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
        const refValidation = validateReferencedIds(req.params.table, req.body || {});
        if (!refValidation.ok) {
            return res.status(400).json({ error: refValidation.error });
        }

        if (req.params.table === 'Lien_personnage_personnage') {
            const firstId = Number(req.body.ID_personnage_A);
            const secondId = Number(req.body.ID_personnage_B);
            if (firstId === secondId) {
                return res.status(400).json({error: 'Self links are not allowed'});
            }

            if (firstId > secondId) {
                req.body.ID_personnage_A = secondId;
                req.body.ID_personnage_B = firstId;
            }
        }

        if (req.params.table === 'Lien_evenement_evenement') {
            const firstId = Number(req.body.ID_evenement_A);
            const secondId = Number(req.body.ID_evenement_B);
            if (firstId === secondId) {
                return res.status(400).json({error: 'Self links are not allowed'});
            }

            if (firstId > secondId) {
                req.body.ID_evenement_A = secondId;
                req.body.ID_evenement_B = firstId;
            }
        }

        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        const qs = fields.map(() => '?').join(', ');
        db.prepare(`INSERT INTO ${req.params.table} (${fields.join(',')}) VALUES (${qs})`).run(values);
        res.json({success: true});
    } catch(err) {
        if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ error: 'Link rejected by database constraints (duplicate or invalid reference).' });
        }
        res.status(500).json({error: err.message});
    }
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
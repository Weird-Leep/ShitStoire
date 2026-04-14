const express = require('express');
const router = express.Router();
const db = require('../db');

// List of allowed link tables (to prevent injection)
const linkTables = [
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

function getTableColumns(table) {
    const cols = db.pragma(`table_info(${table})`) || [];
    return cols.map((c) => c.name);
}

function hasColumn(table, column) {
    return getTableColumns(table).includes(column);
}

function normalizeSymmetricPayload(table, payload) {
    if (table === 'Lien_personnage_personnage') {
        const a = Number(payload.ID_personnage_A);
        const b = Number(payload.ID_personnage_B);
        if (a === b) throw new Error('Self links are not allowed');
        if (a > b) {
            payload.ID_personnage_A = b;
            payload.ID_personnage_B = a;
        }
    }

    if (table === 'Lien_evenement_evenement') {
        const a = Number(payload.ID_evenement_A);
        const b = Number(payload.ID_evenement_B);
        if (a === b) throw new Error('Self links are not allowed');
        if (a > b) {
            payload.ID_evenement_A = b;
            payload.ID_evenement_B = a;
        }
    }

    if (table === 'Lien_entite_politique_entite_politique') {
        const a = Number(payload.ID_entite_politique_A);
        const b = Number(payload.ID_entite_politique_B);
        if (a === b) throw new Error('Self links are not allowed');
        if (a > b) {
            payload.ID_entite_politique_A = b;
            payload.ID_entite_politique_B = a;
        }
    }
}

function normalizeSymmetricKeys(table, keys) {
    if (!keys || typeof keys !== 'object') return keys;

    if (table === 'Lien_personnage_personnage') {
        const hasA = keys.ID_personnage_A !== undefined;
        const hasB = keys.ID_personnage_B !== undefined;
        if (hasA && hasB) {
            const a = Number(keys.ID_personnage_A);
            const b = Number(keys.ID_personnage_B);
            if (a === b) throw new Error('Self links are not allowed');
            if (a > b) {
                keys.ID_personnage_A = b;
                keys.ID_personnage_B = a;
            }
        }
    }

    if (table === 'Lien_evenement_evenement') {
        const hasA = keys.ID_evenement_A !== undefined;
        const hasB = keys.ID_evenement_B !== undefined;
        if (hasA && hasB) {
            const a = Number(keys.ID_evenement_A);
            const b = Number(keys.ID_evenement_B);
            if (a === b) throw new Error('Self links are not allowed');
            if (a > b) {
                keys.ID_evenement_A = b;
                keys.ID_evenement_B = a;
            }
        }
    }

    if (table === 'Lien_entite_politique_entite_politique') {
        const hasA = keys.ID_entite_politique_A !== undefined;
        const hasB = keys.ID_entite_politique_B !== undefined;
        if (hasA && hasB) {
            const a = Number(keys.ID_entite_politique_A);
            const b = Number(keys.ID_entite_politique_B);
            if (a === b) throw new Error('Self links are not allowed');
            if (a > b) {
                keys.ID_entite_politique_A = b;
                keys.ID_entite_politique_B = a;
            }
        }
    }

    return keys;
}

function filterPayloadToTableColumns(table, payload) {
    const columns = new Set(getTableColumns(table));
    const filtered = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (columns.has(key)) filtered[key] = value;
    });
    return filtered;
}

function buildWhereFromKeys(table, keys) {
    normalizeSymmetricKeys(table, keys);
    const fields = Object.keys(keys || {});
    if (fields.length === 0) throw new Error('Identifiers missing');
    const whereClause = fields.map((f) => `${f} = ?`).join(' AND ');
    const values = fields.map((f) => keys[f]);
    return { whereClause, values };
}

function sanitizeUpdatePayload(table, updates) {
    const allowed = ['description', 'Date_Debut', 'precision_Debut', 'Date_Fin', 'precision_Fin'];
    const columns = new Set(getTableColumns(table));
    const safe = {};

    for (const [field, value] of Object.entries(updates || {})) {
        if (!allowed.includes(field)) continue;
        if (!columns.has(field)) continue;
        safe[field] = value;
    }

    return safe;
}

function runAtomicOrPartial(atomic, operation) {
    if (!atomic) {
        operation();
        return;
    }
    const txn = db.getDb().transaction(() => operation());
    txn();
}

// Generic fetch by link table name
router.get('/:table', (req, res) => {
    if(!isLinkValid(req.params.table)) return res.status(400).send('Invalid link table');
    try {
        const filters = { ...req.query };
        const whereParts = [];
        const values = [];
        const columns = new Set(getTableColumns(req.params.table));

        const dateFrom = filters.dateFrom;
        const dateTo = filters.dateTo;
        delete filters.dateFrom;
        delete filters.dateTo;

        Object.entries(filters).forEach(([key, value]) => {
            if (!columns.has(key)) return;
            whereParts.push(`${key} = ?`);
            values.push(value);
        });

        if (dateFrom && columns.has('Date_Debut')) {
            whereParts.push('Date_Debut >= ?');
            values.push(dateFrom);
        }
        if (dateTo && columns.has('Date_Fin')) {
            whereParts.push('(Date_Fin IS NULL OR Date_Fin <= ?)');
            values.push(dateTo);
        }

        const whereClause = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
        res.json(db.prepare(`SELECT * FROM ${req.params.table}${whereClause}`).all(...values));
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

        normalizeSymmetricPayload(req.params.table, req.body);

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

router.post('/:table/batch-create', (req, res) => {
    if (!isLinkValid(req.params.table)) return res.status(400).send();

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const atomic = Boolean(req.body?.atomic);

    if (rows.length === 0) {
        return res.status(400).json({ error: 'rows is required' });
    }

    const results = { successCount: 0, failureCount: 0, failures: [] };

    try {
        runAtomicOrPartial(atomic, () => {
            rows.forEach((row, idx) => {
                try {
                    const payload = filterPayloadToTableColumns(req.params.table, { ...(row || {}) });
                    normalizeSymmetricPayload(req.params.table, payload);

                    const refValidation = validateReferencedIds(req.params.table, payload);
                    if (!refValidation.ok) throw new Error(refValidation.error);

                    const fields = Object.keys(payload);
                    if (fields.length === 0) throw new Error('Empty payload');
                    const values = Object.values(payload);
                    const qs = fields.map(() => '?').join(', ');
                    db.prepare(`INSERT INTO ${req.params.table} (${fields.join(',')}) VALUES (${qs})`).run(values);
                    results.successCount += 1;
                } catch (err) {
                    if (atomic) throw err;
                    results.failureCount += 1;
                    results.failures.push({ index: idx, error: err.message });
                }
            });
        });

        return res.json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message, successCount: 0, failureCount: rows.length });
    }
});

router.patch('/:table/batch-update', (req, res) => {
    if (!isLinkValid(req.params.table)) return res.status(400).send();

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const atomic = Boolean(req.body?.atomic);

    if (rows.length === 0) {
        return res.status(400).json({ error: 'rows is required' });
    }

    const results = { successCount: 0, failureCount: 0, failures: [] };

    try {
        runAtomicOrPartial(atomic, () => {
            rows.forEach((row, idx) => {
                try {
                    const updates = sanitizeUpdatePayload(req.params.table, row?.updates || {});
                    if (Object.keys(updates).length === 0) throw new Error('No updatable fields provided');

                    let whereClause = '';
                    let whereValues = [];

                    if (row?.id !== undefined && row?.id !== null && hasColumn(req.params.table, 'ID')) {
                        whereClause = 'ID = ?';
                        whereValues = [Number(row.id)];
                    } else {
                        const where = buildWhereFromKeys(req.params.table, row?.keys || {});
                        whereClause = where.whereClause;
                        whereValues = where.values;
                    }

                    const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(', ');
                    const setValues = Object.values(updates);
                    const result = db.prepare(`UPDATE ${req.params.table} SET ${setClause} WHERE ${whereClause}`).run(...setValues, ...whereValues);

                    if (result.changes === 0) throw new Error('No matching link to update');
                    results.successCount += 1;
                } catch (err) {
                    if (atomic) throw err;
                    results.failureCount += 1;
                    results.failures.push({ index: idx, error: err.message });
                }
            });
        });

        return res.json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message, successCount: 0, failureCount: rows.length });
    }
});

router.delete('/:table/batch-delete', (req, res) => {
    if (!isLinkValid(req.params.table)) return res.status(400).send();

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const atomic = Boolean(req.body?.atomic);

    if (rows.length === 0) {
        return res.status(400).json({ error: 'rows is required' });
    }

    const results = { successCount: 0, failureCount: 0, failures: [] };

    try {
        runAtomicOrPartial(atomic, () => {
            rows.forEach((row, idx) => {
                try {
                    let whereClause = '';
                    let whereValues = [];

                    if (row?.id !== undefined && row?.id !== null && hasColumn(req.params.table, 'ID')) {
                        whereClause = 'ID = ?';
                        whereValues = [Number(row.id)];
                    } else {
                        const where = buildWhereFromKeys(req.params.table, row?.keys || {});
                        whereClause = where.whereClause;
                        whereValues = where.values;
                    }

                    const result = db.prepare(`DELETE FROM ${req.params.table} WHERE ${whereClause}`).run(...whereValues);
                    if (result.changes === 0) throw new Error('No matching link to delete');
                    results.successCount += 1;
                } catch (err) {
                    if (atomic) throw err;
                    results.failureCount += 1;
                    results.failures.push({ index: idx, error: err.message });
                }
            });
        });

        return res.json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message, successCount: 0, failureCount: rows.length });
    }
});

router.put('/:table/:id', (req, res) => {
    if (!isLinkValid(req.params.table)) return res.status(400).send();
    if (!hasColumn(req.params.table, 'ID')) return res.status(400).json({ error: 'This link table has no ID column' });

    try {
        const updates = sanitizeUpdatePayload(req.params.table, req.body || {});
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(', ');
        const values = Object.values(updates);
        const id = Number(req.params.id);
        const result = db.prepare(`UPDATE ${req.params.table} SET ${setClause} WHERE ID = ?`).run(...values, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Link not found' });
        }

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.put('/:table', (req, res) => {
    if (!isLinkValid(req.params.table)) return res.status(400).send();

    try {
        const keys = req.body?.keys || {};
        const updates = sanitizeUpdatePayload(req.params.table, req.body?.updates || {});
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        const where = buildWhereFromKeys(req.params.table, keys);
        const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(', ');
        const values = Object.values(updates);
        const result = db.prepare(`UPDATE ${req.params.table} SET ${setClause} WHERE ${where.whereClause}`).run(...values, ...where.values);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Link not found' });
        }

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Generic delete link (requires keys in query)
router.delete('/:table', (req, res) => {
    if(!isLinkValid(req.params.table)) return res.status(400).send();
    try {
        if (req.query.ID !== undefined) {
            const rowId = Number(req.query.ID);
            if (!Number.isInteger(rowId) || rowId <= 0) {
                return res.status(400).json({ error: 'Invalid ID' });
            }

            db.prepare(`DELETE FROM ${req.params.table} WHERE ID = ?`).run(rowId);
            return res.json({success: true});
        }

        const fields = Object.keys(req.query);
        const whereClause = fields.map(f => `${f} = ?`).join(' AND ');
        const values = Object.values(req.query);
        if(!whereClause) return res.status(400).json({error: 'Identifiers missing'});
        
        db.prepare(`DELETE FROM ${req.params.table} WHERE ${whereClause}`).run(...values);
        res.json({success: true});
    } catch(err) { res.status(500).json({error: err.message}); }
});

module.exports = router;
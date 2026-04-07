const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('./shitstoire_db.sqlite', { readonly: true });
const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
const sql = tables.map(t => t.sql + ';').join('\n\n');
fs.writeFileSync('./backend/schema.sql', sql);
console.log('schema.sql generated successfully.');

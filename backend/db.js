const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to the SQLite Database
const dbPath = path.resolve(__dirname, '../shitstoire_db.sqlite');
const dbExists = fs.existsSync(dbPath);

const db = new Database(dbPath, { verbose: console.log });

// Initialiser le schéma si la base de données vient d'être créée ou est vide
const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get();

if (!dbExists || tableCheck.count === 0) {
    console.log("Initialisation de la base de données en cours...");
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
        const schemaString = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schemaString);
        console.log("Le schéma de la base de données a été initialisé avec succès !");
    } else {
        console.log("Attention : Fichier schema.sql introuvable. La base de données reste vide.");
    }
}

// In SQLite, foreign keys are disabled by default. Let's enable them.
db.pragma('foreign_keys = ON');

module.exports = db;
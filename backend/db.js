const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to the SQLite Database
const dbPath = path.resolve(__dirname, '../shitstoire_db.sqlite');
const dbExists = fs.existsSync(dbPath);

const db = new Database(dbPath, { verbose: console.log });

// Initialiser ou compléter le schéma à chaque démarrage, sans écraser les données existantes
const schemaPath = path.resolve(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
    const schemaString = fs.readFileSync(schemaPath, 'utf8').replace(/CREATE TABLE\s+/g, 'CREATE TABLE IF NOT EXISTS ');
    db.exec(schemaString);
    console.log(dbExists
        ? "Le schéma de la base de données a été vérifié et complété avec succès !"
        : "Le schéma de la base de données a été initialisé avec succès !");
} else {
    console.log("Attention : Fichier schema.sql introuvable. La base de données reste vide.");
}

// In SQLite, foreign keys are disabled by default. Let's enable them.
db.pragma('foreign_keys = ON');

module.exports = db;
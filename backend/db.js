const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../shitstoire_db.sqlite');
const schemaPath = path.resolve(__dirname, 'schema.sql');

let db = null;

function applySchema(connection, dbExistedBeforeOpen) {
    if (fs.existsSync(schemaPath)) {
        const schemaString = fs
            .readFileSync(schemaPath, 'utf8')
            .replace(/CREATE TABLE\s+/g, 'CREATE TABLE IF NOT EXISTS ');
        connection.exec(schemaString);
        console.log(dbExistedBeforeOpen
            ? "Le schéma de la base de données a été vérifié et complété avec succès !"
            : "Le schéma de la base de données a été initialisé avec succès !");
    } else {
        console.log("Attention : Fichier schema.sql introuvable. La base de données reste vide.");
    }
}

function openDb() {
    const dbExistedBeforeOpen = fs.existsSync(dbPath);
    db = new Database(dbPath, { verbose: console.log });
    applySchema(db, dbExistedBeforeOpen);

    // In SQLite, foreign keys are disabled by default. Let's enable them.
    db.pragma('foreign_keys = ON');
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

function reopenDb() {
    closeDb();
    openDb();
}

function getDb() {
    if (!db) {
        openDb();
    }
    return db;
}

openDb();

module.exports = {
    getDb,
    closeDb,
    reopenDb,
    dbPath,
    prepare: (...args) => getDb().prepare(...args),
    exec: (...args) => getDb().exec(...args),
    pragma: (...args) => getDb().pragma(...args),
};
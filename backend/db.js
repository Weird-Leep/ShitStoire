const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { migrations, latestVersion } = require('./migrations');

const dbPath = path.resolve(__dirname, '../shitstoire_db.sqlite');
const schemaPath = path.resolve(__dirname, 'schema.sql');

let db = null;
let lastMigrationReport = {
    fromVersion: 0,
    toVersion: 0,
    applied: [],
};

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

function getUserVersion(connection) {
    return connection.pragma('user_version', { simple: true }) || 0;
}

function setUserVersion(connection, version) {
    connection.pragma(`user_version = ${version}`);
}

function runMigrations(connection) {
    let currentVersion = getUserVersion(connection);
    const fromVersion = currentVersion;
    const applied = [];

    for (const migration of migrations) {
        if (migration.version <= currentVersion) continue;

        const applyOne = connection.transaction(() => {
            migration.up(connection);
            setUserVersion(connection, migration.version);
        });

        applyOne();
        currentVersion = migration.version;
        applied.push({ version: migration.version, name: migration.name });
    }

    lastMigrationReport = {
        fromVersion,
        toVersion: currentVersion,
        applied,
    };

    if (applied.length > 0) {
        console.log(`Migrations appliquées: ${applied.map((m) => `${m.version}:${m.name}`).join(', ')}`);
    }
    console.log(`Version schéma SQLite: ${currentVersion}/${latestVersion}`);
}

function openDb() {
    const dbExistedBeforeOpen = fs.existsSync(dbPath);
    db = new Database(dbPath, { verbose: console.log });

    // In SQLite, foreign keys are disabled by default. Let's enable them.
    db.pragma('foreign_keys = ON');

    applySchema(db, dbExistedBeforeOpen);
    runMigrations(db);
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
    getLastMigrationReport: () => ({ ...lastMigrationReport, applied: [...lastMigrationReport.applied] }),
    dbPath,
    prepare: (...args) => getDb().prepare(...args),
    exec: (...args) => getDb().exec(...args),
    pragma: (...args) => getDb().pragma(...args),
};
const Database = require('better-sqlite3');
const path = require('path');

// Connect to the SQLite Database
const dbPath = path.resolve(__dirname, '../database_export.sqlite');
const db = new Database(dbPath, { verbose: console.log });

// In SQLite, foreign keys are disabled by default. Let's enable them.
db.pragma('foreign_keys = ON');

module.exports = db;
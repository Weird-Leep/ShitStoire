module.exports = {
    version: 3,
    name: 'make entite politique self link dated',
    up(connection) {
        connection.exec(`
            ALTER TABLE Lien_entite_politique_entite_politique RENAME TO _old_Lien_entite_politique_entite_politique;

            CREATE TABLE Lien_entite_politique_entite_politique (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                ID_entite_politique_A INTEGER,
                ID_entite_politique_B INTEGER,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT,
                FOREIGN KEY(ID_entite_politique_A) REFERENCES Entite_politique(ID),
                FOREIGN KEY(ID_entite_politique_B) REFERENCES Entite_politique(ID)
            );

            INSERT INTO Lien_entite_politique_entite_politique (
                ID_entite_politique_A,
                ID_entite_politique_B,
                description
            )
            SELECT
                ID_entite_politique_A,
                ID_entite_politique_B,
                description
            FROM _old_Lien_entite_politique_entite_politique;

            DROP TABLE _old_Lien_entite_politique_entite_politique;

            CREATE INDEX IF NOT EXISTS idx_lepep_ids
            ON Lien_entite_politique_entite_politique (ID_entite_politique_A, ID_entite_politique_B);
        `);
    },
};

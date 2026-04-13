module.exports = {
    version: 2,
    name: 'allow multiple dated links',
    up(connection) {
        connection.exec(`
            ALTER TABLE Lien_personnage_fonctions RENAME TO _old_Lien_personnage_fonctions;
            CREATE TABLE Lien_personnage_fonctions (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                ID_personnage INTEGER,
                ID_fonctions INTEGER,
                description TEXT,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_fonctions) REFERENCES Fonctions(ID)
            );
            INSERT INTO Lien_personnage_fonctions (ID_personnage, ID_fonctions, description, Date_Debut, precision_Debut, Date_Fin, precision_Fin)
            SELECT ID_personnage, ID_fonctions, description, Date_Debut, precision_Debut, Date_Fin, precision_Fin
            FROM _old_Lien_personnage_fonctions;
            DROP TABLE _old_Lien_personnage_fonctions;
            CREATE INDEX IF NOT EXISTS idx_lpf_ids ON Lien_personnage_fonctions (ID_personnage, ID_fonctions);

            ALTER TABLE Lien_personnage_lieux RENAME TO _old_Lien_personnage_lieux;
            CREATE TABLE Lien_personnage_lieux (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                ID_personnage INTEGER,
                ID_lieux INTEGER,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT,
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_lieux) REFERENCES Lieu(ID)
            );
            INSERT INTO Lien_personnage_lieux (ID_personnage, ID_lieux, Date_Debut, precision_Debut, Date_Fin, precision_Fin, description)
            SELECT ID_personnage, ID_lieux, Date_Debut, precision_Debut, Date_Fin, precision_Fin, description
            FROM _old_Lien_personnage_lieux;
            DROP TABLE _old_Lien_personnage_lieux;
            CREATE INDEX IF NOT EXISTS idx_lpl_ids ON Lien_personnage_lieux (ID_personnage, ID_lieux);

            ALTER TABLE Lien_lieu_entite_politique RENAME TO _old_Lien_lieu_entite_politique;
            CREATE TABLE Lien_lieu_entite_politique (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                ID_lieu INTEGER,
                ID_entite_politique INTEGER,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT,
                FOREIGN KEY(ID_lieu) REFERENCES Lieu(ID),
                FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID)
            );
            INSERT INTO Lien_lieu_entite_politique (ID_lieu, ID_entite_politique, Date_Debut, precision_Debut, Date_Fin, precision_Fin, description)
            SELECT ID_lieu, ID_entite_politique, Date_Debut, precision_Debut, Date_Fin, precision_Fin, description
            FROM _old_Lien_lieu_entite_politique;
            DROP TABLE _old_Lien_lieu_entite_politique;
            CREATE INDEX IF NOT EXISTS idx_llep_ids ON Lien_lieu_entite_politique (ID_lieu, ID_entite_politique);

            ALTER TABLE Lien_fonctions_entite_politique RENAME TO _old_Lien_fonctions_entite_politique;
            CREATE TABLE Lien_fonctions_entite_politique (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                ID_fonctions INTEGER,
                ID_entite_politique INTEGER,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT,
                FOREIGN KEY(ID_fonctions) REFERENCES Fonctions(ID),
                FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID)
            );
            INSERT INTO Lien_fonctions_entite_politique (ID_fonctions, ID_entite_politique, Date_Debut, precision_Debut, Date_Fin, precision_Fin, description)
            SELECT ID_fonctions, ID_entite_politique, Date_Debut, precision_Debut, Date_Fin, precision_Fin, description
            FROM _old_Lien_fonctions_entite_politique;
            DROP TABLE _old_Lien_fonctions_entite_politique;
            CREATE INDEX IF NOT EXISTS idx_lfep_ids ON Lien_fonctions_entite_politique (ID_fonctions, ID_entite_politique);
        `);
    },
};

module.exports = {
    version: 1,
    name: 'add requested link tables',
    up(connection) {
        connection.exec(`
            CREATE TABLE IF NOT EXISTS Lien_lieu_sources (
                ID_lieu INTEGER,
                ID_sources INTEGER,
                description TEXT,
                FOREIGN KEY(ID_lieu) REFERENCES Lieu(ID),
                FOREIGN KEY(ID_sources) REFERENCES Source(ID),
                PRIMARY KEY (ID_lieu, ID_sources)
            );

            CREATE TABLE IF NOT EXISTS Lien_entite_politique_sources (
                ID_entite_politique INTEGER,
                ID_sources INTEGER,
                description TEXT,
                FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID),
                FOREIGN KEY(ID_sources) REFERENCES Source(ID),
                PRIMARY KEY (ID_entite_politique, ID_sources)
            );

            CREATE TABLE IF NOT EXISTS Lien_fonctions_sources (
                ID_fonctions INTEGER,
                ID_sources INTEGER,
                description TEXT,
                FOREIGN KEY(ID_fonctions) REFERENCES Fonctions(ID),
                FOREIGN KEY(ID_sources) REFERENCES Source(ID),
                PRIMARY KEY (ID_fonctions, ID_sources)
            );

            CREATE TABLE IF NOT EXISTS Lien_evenement_entite_politique (
                ID_evenement INTEGER,
                ID_entite_politique INTEGER,
                description TEXT,
                FOREIGN KEY(ID_evenement) REFERENCES Evenement(ID),
                FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID),
                PRIMARY KEY (ID_evenement, ID_entite_politique)
            );

            CREATE TABLE IF NOT EXISTS Lien_entite_politique_entite_politique (
                ID_entite_politique_A INTEGER,
                ID_entite_politique_B INTEGER,
                description TEXT,
                FOREIGN KEY(ID_entite_politique_A) REFERENCES Entite_politique(ID),
                FOREIGN KEY(ID_entite_politique_B) REFERENCES Entite_politique(ID),
                PRIMARY KEY (ID_entite_politique_A, ID_entite_politique_B)
            );
        `);
    },
};

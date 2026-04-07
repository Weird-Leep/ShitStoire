CREATE TABLE Evenement (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                titre TEXT NOT NULL,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT
            );

CREATE TABLE Personnages (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Nom TEXT NOT NULL,
                Date_Naissance TEXT,
                precision_Naissance TEXT,
                Date_Mort TEXT,
                precision_Mort TEXT,
                description TEXT
            );

CREATE TABLE Image (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Titre TEXT,
                description TEXT,
                chemin_fichier TEXT NOT NULL
            );

CREATE TABLE Fonctions (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Titre TEXT NOT NULL,
                description TEXT
            );

CREATE TABLE Tags (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Titre TEXT NOT NULL
            );

CREATE TABLE Lieu (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                titre TEXT NOT NULL,
                Coordonne TEXT,
                description TEXT,
                type TEXT
            );

CREATE TABLE Entite_politique (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                titre TEXT NOT NULL,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT
            );

CREATE TABLE Source (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Titre TEXT NOT NULL,
                lien TEXT,
                description TEXT
            );

CREATE TABLE Lien_image_evenement (
                ID_image INTEGER, ID_evenement INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_evenement) REFERENCES Evenement(ID),
                PRIMARY KEY(ID_image, ID_evenement)
            );

CREATE TABLE Lien_image_personnage (
                ID_image INTEGER, ID_personnage INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                PRIMARY KEY(ID_image, ID_personnage)
            );

CREATE TABLE Lien_image_fonctions (
                ID_image INTEGER, ID_fonctions INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_fonctions) REFERENCES Fonctions(ID),
                PRIMARY KEY(ID_image, ID_fonctions)
            );

CREATE TABLE Lien_image_tags (
                ID_image INTEGER, ID_tags INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_tags) REFERENCES Tags(ID),
                PRIMARY KEY(ID_image, ID_tags)
            );

CREATE TABLE Lien_image_lieu (
                ID_image INTEGER, ID_lieu INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_lieu) REFERENCES Lieu(ID),
                PRIMARY KEY(ID_image, ID_lieu)
            );

CREATE TABLE Lien_image_entite_politique (
                ID_image INTEGER, ID_entite_politique INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID),
                PRIMARY KEY(ID_image, ID_entite_politique)
            );

CREATE TABLE Lien_image_source (
                ID_image INTEGER, ID_source INTEGER, description TEXT,
                FOREIGN KEY(ID_image) REFERENCES Image(ID), FOREIGN KEY(ID_source) REFERENCES Source(ID),
                PRIMARY KEY(ID_image, ID_source)
            );

CREATE TABLE Lien_evenement_personnage (
                ID_evenement INTEGER,
                ID_personnage INTEGER,
                description TEXT,
                FOREIGN KEY(ID_evenement) REFERENCES Evenement(ID),
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                PRIMARY KEY (ID_evenement, ID_personnage)
            );

CREATE TABLE Lien_evenement_lieux (
                ID_evenement INTEGER,
                ID_lieux INTEGER,
                description TEXT,
                FOREIGN KEY(ID_evenement) REFERENCES Evenement(ID),
                FOREIGN KEY(ID_lieux) REFERENCES Lieu(ID),
                PRIMARY KEY (ID_evenement, ID_lieux)
            );

CREATE TABLE Lien_evenement_tags (
                ID_evenement INTEGER,
                ID_tags INTEGER,
                description TEXT,
                FOREIGN KEY(ID_evenement) REFERENCES Evenement(ID),
                FOREIGN KEY(ID_tags) REFERENCES Tags(ID),
                PRIMARY KEY (ID_evenement, ID_tags)
            );

CREATE TABLE Lien_evenement_sources (
                ID_evenement INTEGER,
                ID_sources INTEGER,
                description TEXT,
                FOREIGN KEY(ID_evenement) REFERENCES Evenement(ID),
                FOREIGN KEY(ID_sources) REFERENCES Source(ID),
                PRIMARY KEY (ID_evenement, ID_sources)
            );

CREATE TABLE Lien_personnage_fonctions (
                ID_personnage INTEGER,
                ID_fonctions INTEGER,
                description TEXT,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_fonctions) REFERENCES Fonctions(ID),
                PRIMARY KEY (ID_personnage, ID_fonctions)
            );

CREATE TABLE Lien_personnage_lieux (
                ID_personnage INTEGER,
                ID_lieux INTEGER,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT,
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_lieux) REFERENCES Lieu(ID),
                PRIMARY KEY (ID_personnage, ID_lieux)
            );

CREATE TABLE Lien_personnage_sources (
                ID_personnage INTEGER,
                ID_sources INTEGER,
                description TEXT,
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_sources) REFERENCES Source(ID),
                PRIMARY KEY (ID_personnage, ID_sources)
            );

CREATE TABLE Lien_personnage_personnage (
                ID_personnage_A INTEGER,
                ID_personnage_B INTEGER,
                description TEXT,
                FOREIGN KEY(ID_personnage_A) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_personnage_B) REFERENCES Personnages(ID),
                PRIMARY KEY (ID_personnage_A, ID_personnage_B)
            );

CREATE TABLE Lien_lieu_entite_politique (
                ID_lieu INTEGER,
                ID_entite_politique INTEGER,
                Date_Debut TEXT,
                precision_Debut TEXT,
                Date_Fin TEXT,
                precision_Fin TEXT,
                description TEXT,
                FOREIGN KEY(ID_lieu) REFERENCES Lieu(ID),
                FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID),
                PRIMARY KEY (ID_lieu, ID_entite_politique)
            );

CREATE TABLE Lien_personnage_entite_politique (
                ID_personnage INTEGER,
                ID_entite_politique INTEGER,
                description TEXT,
                FOREIGN KEY(ID_personnage) REFERENCES Personnages(ID),
                FOREIGN KEY(ID_entite_politique) REFERENCES Entite_politique(ID),
                PRIMARY KEY (ID_personnage, ID_entite_politique)
            );
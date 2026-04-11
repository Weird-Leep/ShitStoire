# ShitStoire - Exploreur de Base de Données Historique

Une plateforme "Full-stack" complète (Vanilla JS, Node.js, Express, better-sqlite3) qui permet d'afficher en temps réel de riches visualisations sur la structure d'une base de données `sqlite` existante.

## 🚀 Lancement

Pour lancer le serveur de l'application :

1. Ouvrez un terminal dans la racine du dossier principal.
2. Exécutez `npm install`.
3. Lancez le serveur d'API Node avec :
   ```bash
   node backend/server.js
   ```
4. Ouvrez votre navigateur web à l'adresse **`http://localhost:3000`**

---

## 🎨 Fonctionnalités Graphiques Intégrées
Le volet "Visualisations" (`visualisations.html`) fournit des outils externes pour relier intelligemment vos tables :
- **Tabulator (DataTables)** : Tableur dynamique classant les évènements et incluant les mots-clés interactifs (Badges). Le rendu des dates interprète et formatte la *Précision* de la base de données.
- **Vis.js - Timeline (Frise Chronologique)** : Rendu linéaire chronologique avec des pistes distinctes pour vos "Personnages", "Évènements" et "Entités Politiques".
- **Leaflet (Cartographie)** : Affichage du globe mappant les entités de type "Lieu", couplé avec leurs connexions historiques dans une popup visuelle au clic.
- **Vis.js - Network (Graphe de Réseau)** : Affichage d'un graphe spatial auto-structurant permettant d'étudier la cartographie des liaisons relationnelles par catégories.

## 🛠️ Panel d'Administration (CRUD)
Le système propose un affichage simple (`admin.html`) permettant :
- La création, la mise à jour et la suppression des entités dans la base de données.
- L'utilisation de selecteurs pour n'avoir le choix de précision de date qu'entre `Jour`, `Mois` et `Année`.
- **Mécanique en cascade** : Si une entité est supprimée sur l'application, l'API enverra massivement les requêtes pour nettoyer les tables intermédiaires en liant (fini les "Liens Fantômes").
- **Délier & Lier (Relationships)** : Chaque édition d'entité permet, tout en bas de page, de l'associée à une autre entité existante en sélectionnant visuellement le `nom` de l'entité sans devoir connaitre son `ID` SQLite par coeur.

## 🔐 Sécuriser l'accès Admin (recommandé)
La partie administration est maintenant protégée par une connexion serveur. Sans configuration, la connexion admin reste désactivée.

1. Générez un hash de mot de passe (une seule fois) :
   ```bash
   npm run admin:hash -- "VotreMotDePasseTrèsFort"
   ```
2. Définissez les variables d'environnement serveur :
   - `ADMIN_USERNAME` : votre identifiant admin unique
   - `ADMIN_PASSWORD_HASH` : sortie de la commande précédente
   - `ADMIN_AUTH_SECRET` : secret aléatoire long (au moins 32 caractères)
   - `ADMIN_SESSION_TTL_HOURS` (optionnel) : durée de session (par défaut: 168 heures)
3. Redémarrez le serveur.
4. Connectez-vous via `http://localhost:3000/admin-login.html`.

Exemple PowerShell (à adapter) :
```powershell
$env:ADMIN_USERNAME = "votre_login"
$env:ADMIN_PASSWORD_HASH = "salt:hash"
$env:ADMIN_AUTH_SECRET = "remplacez_par_un_secret_long_et_aleatoire"
node backend/server.js
```

Conseils :
- Utilisez HTTPS en production pour protéger la session en transit.
- Ne publiez jamais ces variables dans Git.
- Utilisez un mot de passe long et unique.

## 📦 Export
Sur la page d'administration, se trouve un bouton d'export dans la barre latérale gauche. Celui-ci utilise la bibliothèque Node `archiver` pour compacter à la volée le fichier binaire `.sqlite` ainsi que l'ensemble du dossier des images `/uploads` ajoutées depuis l'interface d'administration.
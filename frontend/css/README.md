# Documentation CSS - ShitStoire

## Vue d'Ensemble

Le système CSS de ShitStoire est basé sur une architecture moderne et minimaliste avec séparation des préoccupations. Tous les styles sont désormais isolés dans des fichiers CSS, sans aucun style inline dans le HTML.

## Structure des Fichiers CSS

### 1. **theme-modern.css** - Thème et Variables
- **Rôle** : Définit les variables CSS et composants de base
- **Contient** :
  - Palette de couleurs minimaliste (variables `--color-*`)
  - Variables typographiques (`--font-*`)
  - Espacements (`--spacing-*`)
  - Ombres et effets (`--shadow-*`)
  - États (hover, focus, active)
  - Composants réutilisables (boutons, inputs, tables, etc.)

**À modifier pour** : Changer le thème global, les couleurs, la police, les espacements

### 2. **style.css** - Mise en Page Principale
- **Rôle** : Styles de mise en page et utilitaires globaux
- **Contient** :
  - Structure générale (header, main, footer)
  - Navigation
  - Grille et flex utilities
  - Espacements et responsive
  - Animations

**À modifier pour** : Changer la mise en page, ajouter des utilitaires

### 3. **admin.css** - Interface d'Administration
- **Rôle** : Styles spécifiques à la page admin
- **Contient** :
  - Layout sidebar + contenu
  - Styles de navigation des entités
  - Formulaires dynamiques
  - Gestionnaire de liens
  - Tables d'administration

**À modifier pour** : Améliorer l'interface admin, ajouter des composants

### 4. **visualisations.css** - Visualisations
- **Rôle** : Styles pour les différentes visualisations
- **Contient** :
  - Navigation des visualisations
  - Filtres et contrôles
  - Frise séquentielle
  - Custom tooltip
  - Intégration Leaflet et Vis.js

**À modifier pour** : Améliorer les visualisations, ajouter des styles pour nouvelles vues

## Palette de Couleurs

```
Neutres:
- Fond primaire : #ffffff (blanc)
- Fond secondaire : #f8f9fa (gris très clair)
- Fond tertiaire : #f0f1f3 (gris clair)

Texte:
- Primaire : #1a1a1a (noir)
- Secondaire : #666666 (gris moyen)
- Tertiaire : #999999 (gris clair)

Accent:
- Principal : #2563eb (bleu)
- Hover : #1d4ed8 (bleu plus foncé)
- Léger : #eff6ff (bleu très clair)

États:
- Succès : #16a34a (vert)
- Attention : #ea580c (orange)
- Erreur : #dc2626 (rouge)
- Info : #0284c7 (cyan)
```

## Espacements

Tous en multiples de 0.25rem (4px de base):
- `--spacing-xs` : 0.25rem
- `--spacing-sm` : 0.5rem
- `--spacing-md` : 1rem (BASE)
- `--spacing-lg` : 1.5rem
- `--spacing-xl` : 2rem
- `--spacing-2xl` : 3rem

## Points de Rupture Responsive

```
Desktop : ≥ 1024px
Tablet : 768px - 1023px
Mobile : 480px - 767px
Mobile S : < 480px
```

## Classes Utilitaires Courantes

### Buttons
```html
<!-- Primaire (bleu) -->
<button class="btn">Clic</button>

<!-- Secondaire (gris) -->
<button class="btn btn-secondary">Clic</button>

<!-- Succès (vert) -->
<button class="btn btn-success">Valider</button>

<!-- Info (cyan) -->
<button class="btn btn-info">Info</button>

<!-- Danger (rouge) -->
<button class="btn btn-danger">Supprimer</button>

<!-- Outline -->
<button class="btn btn-outline">Annuler</button>

<!-- Tailles -->
<button class="btn btn-small">Petit</button>
<button class="btn btn-large">Grand</button>
```

### Spacing
```html
<!-- Margin -->
<div class="m-md">Marge partout</div>
<div class="mt-lg">Marge haut</div>
<div class="mb-md">Marge bas</div>

<!-- Padding -->
<div class="p-lg">Padding 1.5rem</div>
<div class="px-md">Padding horizontal</div>
<div class="py-md">Padding vertical</div>
```

### Typography
```html
<p class="text-center">Centré</p>
<p class="text-sm">Petit texte</p>
<p class="text-muted">Gris clair</p>
<p class="font-semibold">Semi-gras</p>
<p class="line-clamp-1">Une ligne avec ellipsis</p>
```

### Layout
```html
<!-- Flex -->
<div class="flex gap-md">Flex avec espacement</div>
<div class="flex-col">Direction colonne</div>
<div class="flex-between">Espace entre les items</div>

<!-- Grid -->
<div class="grid grid-cols-3">3 colonnes</div>
<div class="grid grid-cols-2">2 colonnes (responsive)</div>
```

### Cards & Containers
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Titre</h3>
  </div>
  <div class="card-body">Contenu</div>
  <div class="card-footer">Pied</div>
</div>
```

### Badges & Alerts
```html
<span class="badge">Normal</span>
<span class="badge badge-success">Succès</span>
<span class="badge badge-error">Erreur</span>

<div class="alert">Message info</div>
<div class="alert alert-success">Succès</div>
<div class="alert alert-error">Erreur</div>
```

## Modification du Thème

### Changer les couleurs principales

Éditer `theme-modern.css`, section `:root`:

```css
:root {
  --color-accent: #2563eb; /* Changez cette valeur */
  --color-accent-hover: #1d4ed8;
  --color-accent-light: #eff6ff;
}
```

### Changer la typographie

```css
--font-family-base: 'Votre Font', sans-serif;
--font-size-base: 1rem;
--font-weight-normal: 400;
```

### Changer les espacements

```css
--spacing-md: 1rem; /* Changez la base */
```

## Conventions de Nommage

- **Variables CSS** : `--category-subcategory` (ex: `--color-bg-primary`)
- **Classes utilitaires** : kebab-case (ex: `text-center`, `flex-between`)
- **Classes BEM pour composants complexes** : `component__element--modifier`

## SCSS vs CSS Pur

⚠️ **Important** : Ces fichiers utilisent du CSS pur avec quelques extensions syntaxiques simulées (comme `&` pour les sélecteurs parents). Pour utiliser SCSS réel, installez un compilateur.

## Responsive Design Mobile-First

Tous les médias queries suivent le pattern mobile-first:

```css
/* Mobile par défaut */
.element { }

/* Tablet et plus */
@media (max-width: 768px) {
  .element { }
}

/* Desktop et plus */
@media (max-width: 1024px) {
  .element { }
}
```

## Accessibilité

- Tous les boutons ont des états `:focus-visible`
- Tous les inputs ont une distinction visuelle au focus
- Ratios de contraste supérieurs à 4.5:1 pour le texte
- Les couleurs ne sont jamais l'unique indicateur
- Les textes ont un `line-height` approprié (≥ 1.5)

## Performance

- Aucun inline style dans le HTML
- CSS modulaire et réutilisable
- Variables CSS pour une maintenance facilitée
- Pas d'animations lourdes (transitions courtes)
- Fichiers CSS séparés pour chaque section (mais combinés en production)

## Bonnes Pratiques

1. **Toujours utiliser les variables CSS** pour les valeurs
2. **Eviter les `!important`** (une exception: utilities override)
3. **Garder l'ordre logique** : structure → composants → utilitaires
4. **Tester le responsive** sur tous les breakpoints
5. **Documenter les changements** dans ce fichier
6. **Réutiliser les classes existantes** avant d'en créer

## Dépannage Courant

**Q: Pourquoi mon style ne s'applique pas?**
A: Vérifiez l'ordre des fichiers CSS et les spécificités des sélecteurs.

**Q: Comment ajouter une nouvelle couleur?**
A: Ajoutez une variable dans `theme-modern.css` `:root` et utilisez-la.

**Q: Les animations commencent à être lentes?**
A: Réduisez le nombre de transitions ou augmentez `--transition-*` values.

**Q: Comment supporter une nouvelle visualisation?**
A: Ajoutez les styles dans `visualisations.css` en suivant la même organisation.

## Contact & Support

Pour tout développement CSS futur, consultez cette documentation et gardez cohérence avec le design system établi.

# 🍳 KitchenDuty

Planning de nettoyage cuisine pour la colocation.

## Features

- ✅ **Rotation automatique** basée sur la semaine ISO
- 🔄 **Échanges** entre colocataires avec swap automatique
- 📅 **Export calendrier** (fichier ICS compatible Google/Apple Calendar)
- 📲 **PWA installable** sur mobile (fonctionne offline)
- 🌙 **Dark mode** automatique
- 💾 **Persistance locale** (localStorage)

## Colocataires

1. Joya
2. Alessandro
3. Filippo
4. Cédric

## Déploiement sur GitHub Pages

```bash
# 1. Créer le repo sur GitHub
gh repo create kitchen-duty --public --source=. --remote=origin

# 2. Push le code
git init
git add .
git commit -m "🍳 Initial commit - KitchenDuty"
git branch -M main
git push -u origin main

# 3. Activer GitHub Pages
# → Settings > Pages > Source: main branch > / (root)
```

L'app sera accessible sur : `https://<username>.github.io/kitchen-duty`

## Personnalisation

Modifier `app.js` pour changer :

```javascript
const CONFIG = {
    members: ['Joya', 'Alessandro', 'Filippo', 'Cédric'],
    startWeek: 48,  // Semaine de départ
    startYear: 2024
};
```

## Tech Stack

- HTML5 / CSS3 / Vanilla JS
- PWA (Service Worker + Web App Manifest)
- Zero dépendances
- Zero backend

## License

MIT - Coloc Crew 🏠

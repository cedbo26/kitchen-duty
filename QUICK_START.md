# Quick Start - Déploiement Firebase Functions

## Commandes essentielles

### 1. Installation (première fois uniquement)

```bash
# Installer Firebase CLI globalement
npm install -g firebase-tools

# Se connecter à Firebase
firebase login

# Installer les dépendances de la fonction
cd functions
npm install
cd ..
```

### 2. Déploiement

```bash
# Déployer uniquement la fonction
firebase deploy --only functions:kitchenDutyCalendar

# Déployer les règles de sécurité (première fois)
firebase deploy --only database

# Déployer tout
firebase deploy
```

### 3. Récupérer l'URL

```bash
# Lister toutes les fonctions déployées
firebase functions:list

# Ou après le déploiement, copier l'URL affichée :
# https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

### 4. Test

```bash
# Dans le navigateur
open https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar

# Avec curl
curl -o calendar.ics https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar

# Voir les logs
firebase functions:log --only kitchenDutyCalendar
```

## Test local (optionnel)

```bash
# Lancer l'émulateur
cd functions
npm run serve

# Tester sur localhost
open http://localhost:5001/kitchen-duty-75864/europe-west1/kitchenDutyCalendar
```

## Mise à jour du code

```bash
# Après avoir modifié functions/index.js
firebase deploy --only functions:kitchenDutyCalendar
```

## Troubleshooting

```bash
# Vérifier la connexion
firebase login --reauth

# Logs détaillés
firebase functions:log --only kitchenDutyCalendar --lines 100

# Déploiement avec debug
firebase deploy --only functions:kitchenDutyCalendar --debug
```

## Documentation complète

- **Résumé complet** : `FIREBASE_FUNCTIONS_SUMMARY.md`
- **Guide détaillé** : `functions/DEPLOYMENT_GUIDE.md`
- **Documentation technique** : `functions/README.md`

---

**URL finale attendue** :
```
https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

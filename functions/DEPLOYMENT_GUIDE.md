# Guide de déploiement Firebase Functions - KitchenDuty ICS

Ce guide explique comment déployer la fonction Cloud qui génère dynamiquement le flux ICS pour KitchenDuty.

## Prérequis

1. **Firebase CLI installé** :
   ```bash
   npm install -g firebase-tools
   ```

2. **Connexion à Firebase** :
   ```bash
   firebase login
   ```

## Configuration initiale

### 1. Initialiser Firebase Functions

Si ce n'est pas déjà fait, exécutez dans le répertoire racine du projet :

```bash
firebase init functions
```

**Réponses recommandées** :
- ✅ Use an existing project → Sélectionnez `kitchen-duty-75864`
- ✅ Language → JavaScript
- ✅ ESLint → Yes (recommandé)
- ⚠️ **ATTENTION** : Overwrite existing files → **NO** (pour ne pas écraser index.js et package.json)
- ✅ Install dependencies with npm → Yes

### 2. Vérifier la configuration

Assurez-vous que le fichier `firebase.json` à la racine contient :

```json
{
  "functions": {
    "source": "functions",
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run lint"
    ],
    "runtime": "nodejs18"
  }
}
```

### 3. Installer les dépendances

```bash
cd functions
npm install
```

## Déploiement

### Déployer uniquement la fonction kitchenDutyCalendar

Depuis le répertoire racine du projet :

```bash
firebase deploy --only functions:kitchenDutyCalendar
```

### Déployer toutes les fonctions

```bash
firebase deploy --only functions
```

### Déploiement avec options

```bash
# Déployer en mode verbose (pour voir plus de détails)
firebase deploy --only functions:kitchenDutyCalendar --debug

# Forcer le redéploiement
firebase deploy --only functions:kitchenDutyCalendar --force
```

## Récupérer l'URL publique

Après le déploiement, Firebase affichera l'URL de votre fonction. Elle devrait ressembler à :

```
https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

### Via la console Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `kitchen-duty-75864`
3. Menu **Functions** dans la barre latérale
4. Vous verrez la fonction `kitchenDutyCalendar` avec son URL

### Via CLI

```bash
firebase functions:list
```

## Utilisation de l'URL

### Tester dans le navigateur

Ouvrez simplement l'URL dans votre navigateur :
```
https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

Le fichier ICS sera téléchargé automatiquement.

### S'abonner au calendrier

#### Sur macOS (Calendrier)
1. Ouvrir l'app Calendrier
2. Fichier → Nouvel abonnement au calendrier
3. Coller l'URL de la fonction
4. OK → le calendrier se synchronisera automatiquement

#### Sur iOS (iPhone/iPad)
1. Réglages → Calendrier → Comptes → Ajouter un compte
2. Autre → Ajouter un abonnement à un calendrier
3. Coller l'URL de la fonction
4. Suivant → Enregistrer

#### Sur Google Calendar
1. Paramètres → Ajouter un calendrier → À partir d'une URL
2. Coller l'URL de la fonction
3. Ajouter un calendrier

#### Sur Outlook
1. Ajouter un calendrier → À partir d'Internet
2. Coller l'URL de la fonction
3. Importer

## Logs et debugging

### Voir les logs en temps réel

```bash
firebase functions:log --only kitchenDutyCalendar
```

### Voir les logs récents

```bash
firebase functions:log --only kitchenDutyCalendar --limit 50
```

### Logs dans la console Firebase

1. [Firebase Console](https://console.firebase.google.com/)
2. Projet `kitchen-duty-75864`
3. Menu **Functions** → Cliquer sur `kitchenDutyCalendar` → Onglet **Logs**

## Émulateur local (développement)

Pour tester localement avant de déployer :

```bash
cd functions
npm run serve
```

La fonction sera accessible sur :
```
http://localhost:5001/kitchen-duty-75864/europe-west1/kitchenDutyCalendar
```

## Mise à jour de la fonction

Après avoir modifié le code dans `functions/index.js` :

```bash
firebase deploy --only functions:kitchenDutyCalendar
```

## Suppression de la fonction

Si vous devez supprimer la fonction :

```bash
firebase functions:delete kitchenDutyCalendar
```

## Permissions Firebase

Assurez-vous que les règles de votre Realtime Database permettent la lecture publique de `/swaps` :

```json
{
  "rules": {
    "swaps": {
      ".read": true,
      ".write": "auth != null"
    },
    "history": {
      ".read": true,
      ".write": "auth != null"
    },
    "weeks": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## Coûts

Firebase Functions gratuit :
- 2 millions d'invocations par mois
- 400 000 Go-secondes par mois
- 200 000 CPU-secondes par mois

Cette fonction est très légère et devrait rester dans les limites gratuites.

## Troubleshooting

### Erreur "CORS"
La fonction inclut déjà les en-têtes CORS. Si problème :
```javascript
res.set('Access-Control-Allow-Origin', '*');
```

### Erreur "Permission denied"
Vérifiez les règles de la Realtime Database (voir section Permissions).

### Fonction ne se déploie pas
```bash
# Vérifier les logs
firebase deploy --only functions:kitchenDutyCalendar --debug

# Vérifier que vous êtes connecté
firebase login --reauth
```

### ICS vide ou incorrect
Vérifiez les logs pour voir les erreurs :
```bash
firebase functions:log --only kitchenDutyCalendar
```

## Support

Pour plus d'informations :
- [Documentation Firebase Functions](https://firebase.google.com/docs/functions)
- [RFC 5545 - iCalendar](https://tools.ietf.org/html/rfc5545)

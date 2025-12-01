# Résumé : Backend Firebase Functions pour KitchenDuty

## Fichiers créés

Tous les fichiers ont été ajoutés sans modifier le front-end existant.

### Structure complète

```
kitchen-duty/
├── functions/                          # NOUVEAU dossier
│   ├── index.js                        # Fonction Cloud principale
│   ├── package.json                    # Dépendances
│   ├── .gitignore                      # Exclusions Git
│   ├── .eslintrc.js                    # Config ESLint
│   ├── DEPLOYMENT_GUIDE.md             # Guide de déploiement détaillé
│   └── README.md                       # Documentation complète
├── firebase.json                       # NOUVEAU - Config Firebase
├── .firebaserc                         # NOUVEAU - Projet Firebase
├── database.rules.json                 # NOUVEAU - Règles de sécurité
├── index.html                          # INCHANGÉ
├── app.js                              # INCHANGÉ
├── style.css                           # INCHANGÉ
└── ... (autres fichiers existants)    # INCHANGÉS
```

## Fonctionnalité implémentée

### Fonction Cloud : `kitchenDutyCalendar`

**Endpoint** : `https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar`

**Fonctionnement** :
1. Lit les swaps depuis Firebase Realtime Database (`/swaps`)
2. Calcule les assignations selon la règle Maria/colocs
3. Génère un fichier ICS pour les 3 prochains mois
4. Un événement par semaine (lundi 20h-21h)
5. Format RFC5545 compatible tous calendriers

### Algorithmes implémentés

```javascript
// Identiques au frontend pour cohérence
✅ getISOWeek(date)
✅ getMondayOfISOWeek(week, year)
✅ getWeekDifference(year1, week1, year2, week2)
✅ getPersonForWeek(week, year, swaps)
✅ toICSDateUTC(date)
✅ generateICSContent()
```

## Guide de déploiement rapide

### 1. Installation

```bash
# Installer Firebase CLI (si pas déjà fait)
npm install -g firebase-tools

# Se connecter
firebase login

# Aller dans le dossier functions
cd functions

# Installer les dépendances
npm install
```

### 2. Initialisation (optionnel si déjà fait)

```bash
# Depuis la racine du projet
firebase init functions
```

**⚠️ IMPORTANT** : Répondre **NO** à "Overwrite existing files" pour ne pas écraser index.js et package.json !

### 3. Déploiement

```bash
# Depuis la racine du projet
firebase deploy --only functions:kitchenDutyCalendar
```

**Temps estimé** : 1-2 minutes

### 4. Récupérer l'URL

Après déploiement, Firebase affichera :
```
✔ functions[kitchenDutyCalendar(europe-west1)] Deployed
Function URL: https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

Ou via CLI :
```bash
firebase functions:list
```

## Utilisation de l'URL

### Test direct
Ouvrir dans le navigateur :
```
https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```
→ Le fichier `kitchen-duty.ics` sera téléchargé

### S'abonner au calendrier

#### Apple Calendar (macOS/iOS)
```
Fichier → Nouvel abonnement au calendrier
URL : https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

#### Google Calendar
```
Paramètres → Ajouter un calendrier → À partir d'une URL
URL : https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

#### Outlook
```
Ajouter un calendrier → À partir d'Internet
URL : https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

### Curl
```bash
curl -o calendar.ics https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

## Règles de sécurité Firebase

Le fichier `database.rules.json` a été créé avec :

```json
{
  "rules": {
    "swaps": {
      ".read": true,      // Lecture publique pour la fonction
      ".write": "auth != null"  // Écriture authentifiée uniquement
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

**Déployer les règles** :
```bash
firebase deploy --only database
```

## Logs et monitoring

### Voir les logs
```bash
# Temps réel
firebase functions:log --only kitchenDutyCalendar

# 50 dernières entrées
firebase functions:log --only kitchenDutyCalendar --limit 50
```

### Console Firebase
1. [Console Firebase](https://console.firebase.google.com/)
2. Projet `kitchen-duty-75864`
3. Menu **Functions**
4. Cliquer sur `kitchenDutyCalendar` → Onglet **Logs**

## Test en local (émulateur)

```bash
cd functions
npm run serve

# La fonction sera accessible sur :
# http://localhost:5001/kitchen-duty-75864/europe-west1/kitchenDutyCalendar
```

## Format ICS généré

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KitchenDuty//Firebase Functions//FR
X-WR-CALNAME:🍳 KitchenDuty
BEGIN:VEVENT
UID:kitchenduty-2025-W48@kitchen-duty-75864.web.app
DTSTART:20251201T190000Z
DTEND:20251201T200000Z
SUMMARY:🍳 Cuisine: Maria
DESCRIPTION:Semaine de Maria (femme de ménage)
END:VEVENT
BEGIN:VEVENT
UID:kitchenduty-2025-W49@kitchen-duty-75864.web.app
DTSTART:20251208T190000Z
DTEND:20251208T200000Z
SUMMARY:🍳 Cuisine: Joya
DESCRIPTION:C'est le tour de Joya pour nettoyer la cuisine cette semaine !
END:VEVENT
...
END:VCALENDAR
```

## Règles métier (identiques au frontend)

- **Référence** : Semaine ISO 48 de 2025 = Maria
- **Maria** : Si `diff % 2 === 0` (semaines paires)
- **Colocs** : Si `diff % 2 === 1` (semaines impaires)
  - Rotation : Joya → Alessandro → Filippo → Cédric
- **Swaps** : Prioritaires, stockés dans `/swaps` Firebase

## Caractéristiques techniques

- ✅ **Région** : europe-west1 (proche de la DB)
- ✅ **Runtime** : Node.js 18
- ✅ **Cache** : 1 heure (3600 secondes)
- ✅ **CORS** : Activé pour tous les domaines
- ✅ **Format** : ICS RFC5545
- ✅ **Période** : Aujourd'hui + 3 mois
- ✅ **Fréquence** : Un événement par semaine (lundi 20h-21h)

## Coûts

**Firebase Functions - Plan gratuit** :
- 2 millions d'invocations/mois
- 400 000 Go-secondes/mois
- 200 000 CPU-secondes/mois

→ Cette fonction reste largement dans les limites gratuites

## Dépendances

```json
{
  "firebase-admin": "^12.0.0",
  "firebase-functions": "^4.5.0"
}
```

## Troubleshooting rapide

### Erreur de déploiement
```bash
firebase deploy --only functions:kitchenDutyCalendar --debug
firebase login --reauth
```

### ICS vide
```bash
firebase functions:log --only kitchenDutyCalendar
```

### Permission denied
Vérifier les règles de sécurité Firebase :
```bash
firebase deploy --only database
```

## Documentation complète

- **Guide de déploiement** : `functions/DEPLOYMENT_GUIDE.md`
- **Documentation technique** : `functions/README.md`
- **Code source** : `functions/index.js`

## Prochaines étapes

1. **Déployer la fonction** :
   ```bash
   cd functions && npm install
   cd .. && firebase deploy --only functions:kitchenDutyCalendar
   ```

2. **Déployer les règles de sécurité** :
   ```bash
   firebase deploy --only database
   ```

3. **Récupérer l'URL** et tester dans le navigateur

4. **S'abonner au calendrier** sur vos appareils

5. **(Optionnel)** Intégrer l'URL dans l'app frontend pour partager facilement

## Notes importantes

- ✅ Le frontend n'a PAS été modifié
- ✅ Tous les fichiers existants sont intacts
- ✅ La fonction est autonome et fonctionne indépendamment
- ✅ La logique de rotation est identique frontend/backend
- ✅ Les swaps Firebase sont synchronisés automatiquement

---

**Prêt à déployer !** 🚀

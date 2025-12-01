# KitchenDuty Firebase Functions

Backend Firebase pour générer dynamiquement un flux ICS (calendrier) pour l'application KitchenDuty.

## Fonctionnalité

La fonction `kitchenDutyCalendar` génère un flux ICS dynamique qui :

- ✅ Calcule automatiquement les assignations de ménage selon la règle : Maria toutes les 2 semaines, colocs en rotation
- ✅ Prend en compte les swaps (échanges) stockés dans Firebase Realtime Database
- ✅ Génère un calendrier pour les 3 prochains mois
- ✅ Crée un événement par semaine (lundi 20h-21h)
- ✅ Format ICS conforme RFC5545
- ✅ Compatible avec tous les clients calendrier (Google Calendar, Apple Calendar, Outlook, etc.)

## Architecture

```
functions/
├── index.js              # Code principal de la fonction Cloud
├── package.json          # Dépendances et scripts
├── .gitignore           # Fichiers ignorés par Git
├── .eslintrc.js         # Configuration ESLint
├── DEPLOYMENT_GUIDE.md  # Guide de déploiement détaillé
└── README.md            # Ce fichier
```

## Règles métier

### Rotation de base
- **Référence** : Semaine ISO 48 de 2025 = Maria
- **Logique** :
  - `diff % 2 === 0` → Maria (semaines paires : 48, 50, 52, etc.)
  - `diff % 2 === 1` → Rotation des colocs (semaines impaires : 49, 51, 53, etc.)

### Ordre de rotation des colocs
1. Joya
2. Alessandro
3. Filippo
4. Cédric

### Swaps (échanges)
Les échanges stockés dans `/swaps` de Firebase Realtime Database surchargent la rotation automatique.

Format dans Firebase :
```json
{
  "swaps": {
    "2024-W49": "Alessandro",
    "2025-W02": "Joya"
  }
}
```

## Algorithmes implémentés

### `getISOWeek(date)`
Calcule le numéro de semaine ISO et l'année ISO d'une date donnée.

### `getMondayOfISOWeek(week, year)`
Retourne le lundi d'une semaine ISO spécifique.

### `getWeekDifference(year1, week1, year2, week2)`
Calcule la différence en semaines ISO entre deux dates (année + semaine).
Utilise les dates réelles pour un calcul précis.

### `getPersonForWeek(week, year, swaps)`
Détermine qui est responsable d'une semaine donnée :
1. Vérifie s'il y a un swap
2. Sinon, applique la règle Maria/colocs

### `toICSDateUTC(date)`
Formate une date JavaScript en format ICS : `YYYYMMDDTHHMMSSZ`

### `generateICSContent()`
Génère le contenu ICS complet :
1. Récupère les swaps depuis Firebase
2. Calcule la période (aujourd'hui + 3 mois)
3. Crée un événement par semaine
4. Retourne le fichier ICS formaté

## Format ICS généré

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KitchenDuty//Firebase Functions//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:🍳 KitchenDuty
X-WR-TIMEZONE:Europe/Zurich
BEGIN:VEVENT
UID:kitchenduty-2024-W49@kitchen-duty-75864.web.app
DTSTAMP:20241201T120000Z
DTSTART:20241202T190000Z
DTEND:20241202T200000Z
SUMMARY:🍳 Cuisine: Joya
DESCRIPTION:C'est le tour de Joya pour nettoyer la cuisine cette semaine !
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
...
END:VCALENDAR
```

## Dépendances

- **firebase-admin** : ^12.0.0 - SDK Admin Firebase pour accéder à Realtime Database
- **firebase-functions** : ^4.5.0 - Framework pour créer des Cloud Functions

## Configuration

### Région
La fonction est déployée dans la région `europe-west1` pour être proche de votre Realtime Database.

### Runtime
Node.js 18

### Cache
Le calendrier ICS est mis en cache pendant 1 heure (`Cache-Control: public, max-age=3600`).

### CORS
CORS activé pour permettre l'accès depuis n'importe quel domaine.

## Déploiement rapide

```bash
# 1. Installer les dépendances
cd functions
npm install

# 2. Déployer
firebase deploy --only functions:kitchenDutyCalendar

# 3. Récupérer l'URL
firebase functions:list
```

URL de déploiement attendue :
```
https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

## Développement local

```bash
# Lancer l'émulateur
cd functions
npm run serve

# La fonction sera accessible sur :
# http://localhost:5001/kitchen-duty-75864/europe-west1/kitchenDutyCalendar
```

## Tests manuels

### Avec curl
```bash
curl -i https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

### Avec wget
```bash
wget -O calendar.ics https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

### Dans le navigateur
Ouvrez simplement l'URL, le fichier ICS sera téléchargé.

## Logs et monitoring

```bash
# Logs en temps réel
firebase functions:log --only kitchenDutyCalendar

# 50 dernières entrées
firebase functions:log --only kitchenDutyCalendar --limit 50

# Avec filtre
firebase functions:log --only kitchenDutyCalendar --lines 100
```

## Permissions Firebase

Assurez-vous que votre Realtime Database permet la lecture publique de `/swaps` :

```json
{
  "rules": {
    "swaps": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## Exemples d'utilisation

### S'abonner au calendrier

#### macOS Calendar
```
Fichier → Nouvel abonnement
URL : https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

#### Google Calendar
```
Paramètres → Ajouter un calendrier → À partir d'une URL
URL : https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

#### iOS
```
Réglages → Calendrier → Comptes → Autre → Abonnement
URL : https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
```

## Roadmap

Fonctionnalités futures possibles :
- [ ] Personnalisation de la période (query params : `start`, `end`)
- [ ] Filtre par personne (query param : `person=Joya`)
- [ ] Support de l'authentification pour les swaps
- [ ] Webhook pour notifier les changements
- [ ] Génération de statistiques

## Licence

Ce code fait partie du projet KitchenDuty.

## Support

Voir le [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) pour plus de détails sur le déploiement et le troubleshooting.

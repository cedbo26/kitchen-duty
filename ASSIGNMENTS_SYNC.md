# Changelog - Synchronisation des Assignments via Firebase

## Résumé

**Objectif** : Faire de Firebase la source de vérité unique pour les assignments hebdomadaires. Le frontend écrit systématiquement dans `/assignments/{weekKey}` et le backend ICS lit depuis cette source en priorité.

**Impact** : Garantit l'alignement strict entre l'affichage web et le calendrier ICS généré.

---

## Modifications apportées

### 1. Frontend - StorageModule (`app.js`)

#### A. Nouveau cache pour les assignments

**Ligne** : 20

**Ajout** :
```javascript
assignments: null
```

**Raison** : Cache local pour éviter les lectures répétées depuis Firebase/localStorage.

---

#### B. Fonction `loadAssignments()`

**Lignes** : 265-288

**Code** :
```javascript
loadAssignments() {
    // Retourner le cache si déjà chargé
    if (this._cache.assignments !== null) {
        return this._cache.assignments;
    }

    // Essayer de charger depuis Firebase
    if (window.kdDb) {
        window.kdDb.ref('assignments').once('value')
            .then((snapshot) => {
                const data = snapshot.val() || {};
                this._cache.assignments = data;
                localStorage.setItem('kitchenDuty_assignments', JSON.stringify(data));
            })
            .catch((error) => {
                console.warn('Erreur lors de la lecture Firebase assignments', error);
            });
    }

    // Fallback: charger depuis localStorage
    const data = JSON.parse(localStorage.getItem('kitchenDuty_assignments') || '{}');
    this._cache.assignments = data;
    return data;
}
```

**Raison** : Charge les assignments depuis Firebase avec fallback localStorage.

---

#### C. Fonction `saveAssignment(isoYear, isoWeek, person)`

**Lignes** : 290-314

**Code** :
```javascript
saveAssignment(isoYear, isoWeek, person) {
    const weekKey = `${isoYear}-W${isoWeek}`;

    // Mise à jour du cache
    if (!this._cache.assignments) {
        this._cache.assignments = {};
    }
    this._cache.assignments[weekKey] = person;

    // Mise à jour localStorage
    const allAssignments = JSON.parse(localStorage.getItem('kitchenDuty_assignments') || '{}');
    allAssignments[weekKey] = person;
    localStorage.setItem('kitchenDuty_assignments', JSON.stringify(allAssignments));

    // Mise à jour Firebase
    if (window.kdDb) {
        window.kdDb.ref(`assignments/${weekKey}`).set(person)
            .then(() => {
                console.log(`Assignment ${weekKey} = ${person} saved to Firebase`);
            })
            .catch((error) => {
                console.warn('Erreur lors de la sauvegarde Firebase assignment', error);
            });
    }
}
```

**Raison** : Sauvegarde un assignment dans Firebase, localStorage et cache.

**Format du weekKey** : `2024-W49`, `2025-W01`, etc.

---

### 2. Frontend - Fonction `render()` (`app.js`)

#### A. Sauvegarde de la semaine courante

**Ligne** : 483

**Ajout** :
```javascript
// Sauvegarder l'assignment de la semaine courante dans Firebase
StorageModule.saveAssignment(currentYear, currentWeek, currentPerson);
```

**Raison** : Chaque fois que la page se rafraîchit, l'assignment de la semaine courante est écrit dans Firebase.

---

#### B. Sauvegarde des 4 prochaines semaines (schedule loop)

**Lignes** : 546-570

**Ajout dans la boucle** (ligne 560) :
```javascript
// Sauvegarder l'assignment pour cette semaine dans Firebase
StorageModule.saveAssignment(year, week, person);
```

**Contexte** :
```javascript
for (let i = 0; i < 4; i++) {
    let week = currentWeek + i;
    let year = currentYear;
    if (week > 52) {
        week = week - 52;
        year++;
    }

    const dateRange = getWeekDateRange(week, year);
    const person = getPersonForWeek(week, year);
    const weekKey = getWeekKey(week, year);
    const isDone = history.some(h => h.week === weekKey);

    // Sauvegarder l'assignment pour cette semaine dans Firebase
    StorageModule.saveAssignment(year, week, person);

    // ... affichage dans la liste
}
```

**Raison** : Les 4 prochaines semaines affichées sont également sauvegardées dans Firebase pour être disponibles au backend ICS.

---

### 3. Frontend - Fonction `performSwap()` (`app.js`)

#### Sauvegarde après échange

**Lignes** : 652-653

**Ajout** :
```javascript
// Sauvegarder les assignments après l'échange dans Firebase
StorageModule.saveAssignment(year, week, newPerson);
StorageModule.saveAssignment(searchYear, searchWeek, currentPerson);
```

**Contexte complet** :
```javascript
function performSwap(week, year, newPerson) {
    const weekKey = getWeekKey(week, year);
    const currentPerson = getPersonForWeek(week, year);

    // Trouver la prochaine semaine où newPerson est planifié
    let searchWeek = week + 1;
    let searchYear = year;

    for (let i = 0; i < 8; i++) {
        if (searchWeek > 52) {
            searchWeek = 1;
            searchYear++;
        }

        const scheduledPerson = getPersonForWeek(searchWeek, searchYear);
        if (scheduledPerson === newPerson) {
            // Effectuer l'échange
            swaps[weekKey] = newPerson;
            swaps[getWeekKey(searchWeek, searchYear)] = currentPerson;
            StorageModule.saveSwaps(swaps);

            // Sauvegarder les assignments après l'échange dans Firebase
            StorageModule.saveAssignment(year, week, newPerson);
            StorageModule.saveAssignment(searchYear, searchWeek, currentPerson);

            alert(`✅ Échange confirmé !\n\n${currentPerson} ↔ ${newPerson}\n\nS${week}: ${newPerson}\nS${searchWeek}: ${currentPerson}`);

            document.getElementById('swapModal').classList.remove('active');
            render();
            return;
        }
        searchWeek++;
    }

    alert('Impossible de trouver une semaine pour l\'échange');
}
```

**Raison** : Après un swap manuel, les deux semaines concernées sont immédiatement écrites dans `/assignments`, garantissant que le backend ICS reflète l'échange.

---

### 4. Backend - Firebase Function (`functions/index.js`)

#### A. Chargement des assignments depuis Firebase

**Lignes** : 156-157

**Ajout** :
```javascript
const assignmentsSnapshot = await db.ref('assignments').once('value');
const assignments = assignmentsSnapshot.val() || {};
```

**Contexte complet** :
```javascript
async function generateICSContent() {
    // Récupérer les assignments et swaps depuis Firebase
    const db = admin.database();
    const assignmentsSnapshot = await db.ref('assignments').once('value');
    const assignments = assignmentsSnapshot.val() || {};
    const swapsSnapshot = await db.ref('swaps').once('value');
    const swaps = swapsSnapshot.val() || {};

    // Date actuelle
    const now = new Date();
    const currentISOWeek = getISOWeek(now);
    // ...
}
```

**Raison** : Le backend charge maintenant les assignments en plus des swaps.

---

#### B. Utilisation des assignments en priorité

**Lignes** : 208-218

**Modification** :

**Avant** :
```javascript
const person = getPersonForWeek(currentWeek, currentYear, swaps);
const isMaria = person === 'Maria';
const weekKey = `${currentYear}-W${currentWeek}`;
```

**Après** :
```javascript
const weekKey = `${currentYear}-W${currentWeek}`;

// Priority: assignments from Firebase, then fallback to rotation algorithm
let person;
if (assignments[weekKey]) {
    person = assignments[weekKey];
} else {
    person = getPersonForWeek(currentWeek, currentYear, swaps);
}

const isMaria = person === 'Maria';
```

**Raison** : Le backend vérifie d'abord si un assignment existe dans Firebase pour la semaine donnée. Si oui, il l'utilise. Sinon, il calcule la personne via l'algorithme de rotation.

**Impact** : Le calendrier ICS reflète exactement ce qui est affiché sur le site web, sans recalcul.

---

### 5. Database Rules (`database.rules.json`)

#### Ajout du chemin `assignments`

**Lignes** : 3-6

**Ajout** :
```json
"assignments": {
  ".read": true,
  ".write": "auth != null"
}
```

**Contexte complet** :
```json
{
  "rules": {
    "assignments": {
      ".read": true,
      ".write": "auth != null"
    },
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

**Raison** : Autoriser la lecture publique des assignments (pour le backend ICS) et l'écriture pour les utilisateurs authentifiés (frontend webapp).

---

## Architecture de synchronisation

### Structure Firebase

```
/assignments
    /2024-W49: "Joya"
    /2024-W50: "Maria"
    /2024-W51: "Alessandro"
    /2024-W52: "Maria"
    /2025-W01: "Filippo"
    ...
```

### Flux de données

1. **Frontend → Firebase**
   - `render()` : Sauvegarde semaine courante + 4 prochaines semaines
   - `performSwap()` : Sauvegarde les 2 semaines échangées
   - Stockage dans `/assignments/{weekKey}`

2. **Firebase → Backend ICS**
   - `generateICSContent()` : Lit `/assignments`
   - Priorité : assignments > rotation algorithm
   - Génération ICS alignée sur la webapp

3. **Fallback**
   - Si aucun assignment trouvé dans Firebase pour une semaine
   - Backend calcule via `getPersonForWeek(week, year, swaps)`
   - Garantit une continuité même sans données Firebase

---

## Bénéfices

### 1. Source de vérité unique

**Avant** :
- Frontend : calcul via rotation + swaps
- Backend : recalcul via rotation + swaps
- Risque de désynchronisation

**Après** :
- Frontend : calcul + écriture dans `/assignments`
- Backend : lecture depuis `/assignments`
- Alignement strict garanti

---

### 2. Gestion des swaps simplifiée

**Avant** :
- `/swaps` : stockage des échanges
- Backend doit interpréter les swaps pour recalculer

**Après** :
- `/swaps` : historique des échanges (conservé)
- `/assignments` : résultat final déjà calculé
- Backend lit directement le résultat

---

### 3. Performance

- Moins de calculs côté backend
- Lecture directe depuis Firebase
- Cache frontend pour éviter lectures répétées

---

### 4. Maintenance

- Logique de rotation centralisée (frontend uniquement)
- Backend simple : lecture + génération ICS
- Moins de risques de bugs de calcul

---

## Déploiement

### 1. Déployer les règles de sécurité

```bash
firebase deploy --only database
```

### 2. Déployer la fonction Cloud

```bash
firebase deploy --only functions:kitchenDutyCalendar
```

### 3. Déployer le frontend

```bash
# Commitez les changements dans app.js
git add app.js database.rules.json
git commit -m "✨ Sync assignments to Firebase for ICS alignment"
git push origin main

# Si déploiement via GitHub Pages
# Les changements seront automatiquement déployés
```

---

## Vérification post-déploiement

### 1. Tester la sauvegarde des assignments

1. Ouvrir la webapp : `https://cedbo26.github.io/kitchen-duty/`
2. Ouvrir la console développeur (F12)
3. Vérifier les logs :
   ```
   Assignment 2024-W49 = Joya saved to Firebase
   Assignment 2024-W50 = Maria saved to Firebase
   Assignment 2024-W51 = Alessandro saved to Firebase
   Assignment 2024-W52 = Maria saved to Firebase
   ```

### 2. Vérifier Firebase Console

1. Aller sur Firebase Console : `https://console.firebase.google.com/`
2. Sélectionner le projet `kitchen-duty-75864`
3. Aller dans **Realtime Database**
4. Vérifier la présence du nœud `/assignments` :
   ```json
   {
     "assignments": {
       "2024-W49": "Joya",
       "2024-W50": "Maria",
       "2024-W51": "Alessandro",
       "2024-W52": "Maria",
       "2025-W01": "Filippo"
     }
   }
   ```

### 3. Tester le swap

1. Sur la webapp, cliquer sur **Échanger**
2. Sélectionner une personne
3. Confirmer l'échange
4. Vérifier la console :
   ```
   Assignment 2024-W49 = Alessandro saved to Firebase
   Assignment 2024-W51 = Joya saved to Firebase
   ```
5. Vérifier que les assignments sont mis à jour dans Firebase Console

### 4. Tester l'ICS généré

1. Télécharger le fichier ICS :
   ```bash
   curl -o kitchen-duty.ics https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
   ```

2. Ouvrir `kitchen-duty.ics` et vérifier les SUMMARY :
   ```ics
   BEGIN:VEVENT
   UID:kitchenduty-2024-W49@kitchen-duty-75864.web.app
   DTSTART;VALUE=DATE:20241204
   DTEND;VALUE=DATE:20241208
   SUMMARY:Kitchen : Joya
   ...
   END:VEVENT

   BEGIN:VEVENT
   UID:kitchenduty-2024-W50@kitchen-duty-75864.web.app
   DTSTART;VALUE=DATE:20241211
   DTEND;VALUE=DATE:20241215
   SUMMARY:Kitchen : Maria
   ...
   END:VEVENT
   ```

3. Vérifier que les personnes correspondent exactement à ce qui est affiché sur la webapp

### 5. Vérifier les logs backend

```bash
firebase functions:log --only kitchenDutyCalendar --lines 50
```

Chercher les lignes indiquant la lecture des assignments :
```
Function execution started
Reading assignments from Firebase: {"2024-W49":"Joya","2024-W50":"Maria",...}
=== Génération ICS - Exemples de semaines ===
2024-W49 | Joya | Maria=false | DTSTART=20241204 | DTEND=20241208 | VALARM=true
2024-W50 | Maria | Maria=true | DTSTART=20241211 | DTEND=20241215 | VALARM=false
...
```

---

## Troubleshooting

### Problème : Assignments non sauvegardés

**Symptôme** : Console logs montrent des erreurs de sauvegarde

**Solutions** :
1. Vérifier que l'utilisateur est authentifié (règle `.write: "auth != null"`)
2. Vérifier la connexion Firebase dans `index.html`
3. Vérifier les règles de sécurité sont déployées :
   ```bash
   firebase deploy --only database
   ```

### Problème : ICS ne reflète pas les swaps

**Symptôme** : Swap effectué sur webapp mais ICS reste inchangé

**Solutions** :
1. Vérifier que `saveAssignment()` est bien appelé dans `performSwap()`
2. Vérifier Firebase Console que les assignments sont bien mis à jour
3. Forcer un refresh du calendrier (peut prendre 1h à cause du cache)
4. Vérifier les logs backend :
   ```bash
   firebase functions:log --only kitchenDutyCalendar
   ```

### Problème : Assignments manquants dans Firebase

**Symptôme** : Backend utilise l'algorithme de rotation au lieu des assignments

**Solutions** :
1. Ouvrir la webapp et laisser `render()` s'exécuter
2. Vérifier que les 5 prochaines semaines sont sauvegardées
3. Si besoin, déclencher manuellement un swap pour forcer la sauvegarde

---

## Compatibilité

✅ **Frontend** : Compatible avec localStorage (mode offline)
✅ **Backend** : Fallback sur rotation algorithm si assignments absents
✅ **Firebase** : Règles de sécurité compatibles avec anonymous read
✅ **Calendriers** : Google Calendar, Apple Calendar, Outlook, Thunderbird

---

## Prochaines étapes possibles (optionnel)

### 1. Authentification Firebase

Actuellement, les règles nécessitent `auth != null` pour l'écriture. Options :
- Implémenter Firebase Auth (Google Sign-In)
- Ou passer les règles en `.write: true` (risque de spam)

### 2. Real-time listeners pour assignments

Actuellement, seuls `swaps` et `history` ont des listeners. Ajouter :
```javascript
window.kdDb.ref('assignments').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    StorageModule._cache.assignments = data;
    localStorage.setItem('kitchenDuty_assignments', JSON.stringify(data));
    render();
});
```

### 3. Nettoyage des assignments anciens

Les assignments s'accumulent dans Firebase. Ajouter une fonction Cloud pour supprimer les assignments > 3 mois :
```javascript
exports.cleanOldAssignments = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    const db = admin.database();
    const assignmentsRef = db.ref('assignments');
    const snapshot = await assignmentsRef.once('value');
    const assignments = snapshot.val() || {};

    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const toDelete = [];
    for (const weekKey in assignments) {
        const [year, week] = weekKey.split('-W');
        const weekDate = getMondayOfISOWeek(parseInt(week), parseInt(year));
        if (weekDate < threeMonthsAgo) {
            toDelete.push(weekKey);
        }
    }

    for (const weekKey of toDelete) {
        await assignmentsRef.child(weekKey).remove();
    }

    console.log(`Cleaned ${toDelete.length} old assignments`);
});
```

---

**Version** : 1.0
**Date** : Décembre 2024
**Auteur** : KitchenDuty - Assignments Sync Feature

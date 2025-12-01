// Configuration
const CONFIG = {
    members: ['Joya', 'Alessandro', 'Filippo', 'Cédric'],
    mariaReferenceWeek: 48,
    mariaReferenceYear: 2025
};

// ==========================================
// MODULE D'ABSTRACTION POUR LE STOCKAGE
// ==========================================
// Ce module centralise tous les accès au stockage (Firebase + localStorage fallback)

const StorageModule = {
    // Cache mémoire pour éviter les lectures redondantes
    _cache: {
        weekStates: {},
        history: null,
        swaps: null,
        checklist: null
    },

    // Flag pour éviter les boucles infinies lors des listeners
    _isUpdatingFromFirebase: false,

    // Callback appelé quand les données changent (pour rafraîchir l'UI)
    _onDataChange: null,

    // Initialiser les listeners Firebase
    init(onDataChangeCallback) {
        this._onDataChange = onDataChangeCallback;

        if (!window.kdDb) {
            console.log('Firebase non disponible, utilisation de localStorage uniquement');
            return;
        }

        // Listener sur l'historique
        window.kdDb.ref('history').on('value', (snapshot) => {
            if (this._isUpdatingFromFirebase) return;

            const data = snapshot.val() || [];
            this._cache.history = data;

            // Sync avec localStorage
            localStorage.setItem('kitchenDuty_history', JSON.stringify(data));

            if (this._onDataChange) {
                this._onDataChange('history');
            }
        });

        // Listener sur les swaps
        window.kdDb.ref('swaps').on('value', (snapshot) => {
            if (this._isUpdatingFromFirebase) return;

            const data = snapshot.val() || {};
            this._cache.swaps = data;

            // Sync avec localStorage
            localStorage.setItem('kitchenDuty_swaps', JSON.stringify(data));

            if (this._onDataChange) {
                this._onDataChange('swaps');
            }
        });

        // Listener sur la semaine courante (sera mis à jour dynamiquement)
        this._setupCurrentWeekListener();
    },

    _setupCurrentWeekListener() {
        const currentWeek = getWeekNumber();
        const currentYear = getCurrentYear();
        const key = `${currentYear}-W${currentWeek}`;

        if (!window.kdDb) return;

        window.kdDb.ref(`weeks/${key}`).on('value', (snapshot) => {
            if (this._isUpdatingFromFirebase) return;

            const data = snapshot.val() || { checklist: {}, isDone: false };
            this._cache.weekStates[key] = data;

            // Sync avec localStorage
            const allStates = JSON.parse(localStorage.getItem('kitchenDuty_weekStates') || '{}');
            allStates[key] = data;
            localStorage.setItem('kitchenDuty_weekStates', JSON.stringify(allStates));

            if (this._onDataChange) {
                this._onDataChange('currentWeek');
            }
        });
    },

    // États des semaines (checklist, statut)
    loadWeekState(isoYear, isoWeek) {
        const key = `${isoYear}-W${isoWeek}`;

        // Vérifier le cache mémoire d'abord
        if (this._cache.weekStates[key]) {
            return this._cache.weekStates[key];
        }

        // Essayer Firebase si disponible
        if (window.kdDb) {
            // Lecture depuis Firebase (opération asynchrone mais on retourne immédiatement le cache localStorage)
            window.kdDb.ref(`weeks/${key}`).once('value')
                .then((snapshot) => {
                    const data = snapshot.val() || { checklist: {}, isDone: false };
                    this._cache.weekStates[key] = data;

                    // Sync avec localStorage
                    const allStates = JSON.parse(localStorage.getItem('kitchenDuty_weekStates') || '{}');
                    allStates[key] = data;
                    localStorage.setItem('kitchenDuty_weekStates', JSON.stringify(allStates));
                })
                .catch((error) => {
                    console.warn('Erreur lors de la lecture Firebase, utilisation de localStorage', error);
                });
        }

        // Retourner immédiatement depuis localStorage
        const allStates = JSON.parse(localStorage.getItem('kitchenDuty_weekStates') || '{}');
        const state = allStates[key] || { checklist: {}, isDone: false };
        this._cache.weekStates[key] = state;
        return state;
    },

    saveWeekState(isoYear, isoWeek, data) {
        const key = `${isoYear}-W${isoWeek}`;

        // Mettre à jour le cache
        this._cache.weekStates[key] = data;

        // Sauvegarder dans localStorage
        const allStates = JSON.parse(localStorage.getItem('kitchenDuty_weekStates') || '{}');
        allStates[key] = data;
        localStorage.setItem('kitchenDuty_weekStates', JSON.stringify(allStates));

        // Sauvegarder dans Firebase si disponible
        if (window.kdDb) {
            this._isUpdatingFromFirebase = true;
            window.kdDb.ref(`weeks/${key}`).set(data)
                .then(() => {
                    console.log(`Week state ${key} saved to Firebase`);
                })
                .catch((error) => {
                    console.warn('Erreur lors de la sauvegarde Firebase, données conservées en local', error);
                })
                .finally(() => {
                    this._isUpdatingFromFirebase = false;
                });
        }
    },

    // Historique des tâches complétées
    loadHistory() {
        // Vérifier le cache mémoire d'abord
        if (this._cache.history !== null) {
            return this._cache.history;
        }

        // Essayer Firebase si disponible
        if (window.kdDb) {
            window.kdDb.ref('history').once('value')
                .then((snapshot) => {
                    const data = snapshot.val() || [];
                    this._cache.history = data;
                    localStorage.setItem('kitchenDuty_history', JSON.stringify(data));
                })
                .catch((error) => {
                    console.warn('Erreur lors de la lecture Firebase history', error);
                });
        }

        // Retourner immédiatement depuis localStorage
        const data = JSON.parse(localStorage.getItem('kitchenDuty_history') || '[]');
        this._cache.history = data;
        return data;
    },

    saveHistory(data) {
        // Mettre à jour le cache
        this._cache.history = data;

        // Sauvegarder dans localStorage
        localStorage.setItem('kitchenDuty_history', JSON.stringify(data));

        // Sauvegarder dans Firebase si disponible
        if (window.kdDb) {
            this._isUpdatingFromFirebase = true;
            window.kdDb.ref('history').set(data)
                .then(() => {
                    console.log('History saved to Firebase');
                })
                .catch((error) => {
                    console.warn('Erreur lors de la sauvegarde Firebase history', error);
                })
                .finally(() => {
                    this._isUpdatingFromFirebase = false;
                });
        }
    },

    // Échanges de semaines
    loadSwaps() {
        // Vérifier le cache mémoire d'abord
        if (this._cache.swaps !== null) {
            return this._cache.swaps;
        }

        // Essayer Firebase si disponible
        if (window.kdDb) {
            window.kdDb.ref('swaps').once('value')
                .then((snapshot) => {
                    const data = snapshot.val() || {};
                    this._cache.swaps = data;
                    localStorage.setItem('kitchenDuty_swaps', JSON.stringify(data));
                })
                .catch((error) => {
                    console.warn('Erreur lors de la lecture Firebase swaps', error);
                });
        }

        // Retourner immédiatement depuis localStorage
        const data = JSON.parse(localStorage.getItem('kitchenDuty_swaps') || '{}');
        this._cache.swaps = data;
        return data;
    },

    saveSwaps(data) {
        // Mettre à jour le cache
        this._cache.swaps = data;

        // Sauvegarder dans localStorage
        localStorage.setItem('kitchenDuty_swaps', JSON.stringify(data));

        // Sauvegarder dans Firebase si disponible
        if (window.kdDb) {
            this._isUpdatingFromFirebase = true;
            window.kdDb.ref('swaps').set(data)
                .then(() => {
                    console.log('Swaps saved to Firebase');
                })
                .catch((error) => {
                    console.warn('Erreur lors de la sauvegarde Firebase swaps', error);
                })
                .finally(() => {
                    this._isUpdatingFromFirebase = false;
                });
        }
    },

    // Checklist (migration de l'ancien format - conservé pour compatibilité)
    loadChecklist() {
        return JSON.parse(localStorage.getItem('kitchenDuty_checklist') || '{}');
    },

    saveChecklist(data) {
        localStorage.setItem('kitchenDuty_checklist', JSON.stringify(data));
    }
};

// State
let swaps = StorageModule.loadSwaps();
let history = StorageModule.loadHistory();
let checklist = StorageModule.loadChecklist();

// Utils
function getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getCurrentYear() {
    return new Date().getFullYear();
}

function getWeekKey(week, year) {
    return `${year}-W${week}`;
}

/**
 * Calcule la différence en semaines ISO entre deux semaines (année + numéro de semaine)
 * Utilise les dates réelles pour un calcul précis
 */
function getWeekDifference(year1, week1, year2, week2) {
    // Obtenir le lundi de chaque semaine ISO
    const monday1 = getMondayOfWeek(week1, year1);
    const monday2 = getMondayOfWeek(week2, year2);

    // Calculer la différence en jours, puis convertir en semaines
    const diffTime = monday2.getTime() - monday1.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const diffWeeks = Math.round(diffDays / 7);

    return diffWeeks;
}

/**
 * Détermine qui est responsable de la semaine donnée
 * Règle métier :
 * - Semaine ISO 48 de 2025 = Maria (référence)
 * - Si diff % 2 === 0 : Maria (toutes les 2 semaines)
 * - Si diff % 2 === 1 : rotation des colocs
 */
function getPersonForWeek(week, year) {
    const weekKey = getWeekKey(week, year);

    // Vérifier s'il y a un échange
    if (swaps[weekKey]) {
        return swaps[weekKey];
    }

    // Calculer la différence avec la semaine de référence de Maria
    const diff = getWeekDifference(
        CONFIG.mariaReferenceYear,
        CONFIG.mariaReferenceWeek,
        year,
        week
    );

    // Si diff est pair (0, 2, 4, ...) → c'est Maria
    if (diff % 2 === 0) {
        return 'Maria';
    }

    // Si diff est impair (1, 3, 5, ...) → rotation des colocs
    // On divise par 2 pour obtenir l'index de rotation parmi les semaines de colocs
    const colocRotationIndex = Math.floor(diff / 2);
    const colocIndex = colocRotationIndex % CONFIG.members.length;
    const adjustedIndex = (colocIndex + CONFIG.members.length) % CONFIG.members.length;
    return CONFIG.members[adjustedIndex];
}

function getMondayOfWeek(week, year) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const monday = simple;
    if (dow <= 4) {
        monday.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        monday.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return monday;
}

function formatDate(date) {
    return date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
}

/**
 * Obtient la plage de dates (lundi-dimanche) d'une semaine ISO
 * et la formate sous forme de chaîne lisible
 */
function getWeekDateRange(week, year) {
    const monday = getMondayOfWeek(week, year);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    // Formater les dates
    const startDay = monday.getDate();
    const endDay = sunday.getDate();

    // Gérer le cas où la semaine chevauche deux mois
    const startMonth = monday.toLocaleDateString('fr-CH', { month: 'short' });
    const endMonth = sunday.toLocaleDateString('fr-CH', { month: 'short' });

    if (startMonth === endMonth) {
        // Même mois : "1–7 déc."
        return `${startDay}–${endDay} ${startMonth}`;
    } else {
        // Mois différents : "30 déc.–5 janv."
        return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
    }
}

function getWeekChecklistKey(week, year) {
    return `${year}-W${week}`;
}

function loadChecklist() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();
    const key = getWeekChecklistKey(currentWeek, currentYear);
    const savedChecklist = checklist[key] || {};

    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
        const task = cb.getAttribute('data-task');
        cb.checked = savedChecklist[task] || false;
    });

    updateChecklistCount();
}

function saveChecklist() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();
    const key = getWeekChecklistKey(currentWeek, currentYear);

    const tasks = {};
    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
        const task = cb.getAttribute('data-task');
        tasks[task] = cb.checked;
    });

    checklist[key] = tasks;
    StorageModule.saveChecklist(checklist);
    updateChecklistCount();
}

function updateChecklistCount() {
    const total = document.querySelectorAll('.checklist input[type="checkbox"]').length;
    const checked = document.querySelectorAll('.checklist input[type="checkbox"]:checked').length;
    document.getElementById('checklistCount').textContent = checked;
}

// Render functions
function render() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();
    const currentPerson = getPersonForWeek(currentWeek, currentYear);
    const weekKey = getWeekKey(currentWeek, currentYear);
    const isMaria = currentPerson === 'Maria';

    // Week number
    document.getElementById('weekNumber').textContent = currentWeek;

    // Current person
    document.getElementById('currentPerson').textContent = currentPerson;

    // Adapter l'interface selon si c'est Maria ou un coloc
    const currentDutySection = document.querySelector('.current-duty');
    const checklistSection = document.querySelector('.checklist');
    const btnDone = document.getElementById('btnDone');
    const btnUndo = document.getElementById('btnUndo');
    const labelElement = currentDutySection.querySelector('.label');

    if (isMaria) {
        // Affichage spécial pour Maria
        labelElement.textContent = 'Semaine de';
        currentDutySection.querySelector('.current-person').textContent = 'Maria (femme de ménage)';

        // Masquer la checklist et les boutons "Fait"/"Annuler"
        checklistSection.style.display = 'none';
        btnDone.style.display = 'none';
        btnUndo.style.display = 'none';
    } else {
        // Affichage normal pour les colocs
        labelElement.textContent = "C'est le tour de";

        // Restaurer la checklist et les boutons
        checklistSection.style.display = 'block';
        btnDone.style.display = 'inline-block';

        // Done button state
        const isDone = history.some(h => h.week === weekKey);
        if (isDone) {
            btnDone.innerHTML = '✓ Fait !';
            btnDone.classList.add('completed');
            btnUndo.style.display = 'inline-block';
        } else {
            btnDone.innerHTML = '✓ Marquer comme fait';
            btnDone.classList.remove('completed');
            btnUndo.style.display = 'none';
        }
    }

    // Swap options (exclure Maria et la personne actuelle)
    const swapOptions = document.getElementById('swapOptions');
    swapOptions.innerHTML = '';

    const availableForSwap = isMaria
        ? CONFIG.members
        : CONFIG.members.filter(m => m !== currentPerson);

    availableForSwap.forEach(member => {
        const btn = document.createElement('button');
        btn.textContent = member;
        btn.onclick = () => performSwap(currentWeek, currentYear, member);
        swapOptions.appendChild(btn);
    });

    // Schedule (next 4 weeks)
    const scheduleList = document.getElementById('scheduleList');
    scheduleList.innerHTML = '';
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

        const li = document.createElement('li');
        if (i === 0) li.classList.add('current');

        li.innerHTML = `
            <span class="week-label">S${week} · ${dateRange}</span>
            <span class="person-name">${person} ${isDone ? '<span class="status-done">✓</span>' : ''}</span>
        `;
        scheduleList.appendChild(li);
    }

    // History (last 4 entries)
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    const recentHistory = history.slice(-4).reverse();

    if (recentHistory.length === 0) {
        historyList.innerHTML = '<li style="color: var(--kd-text-muted); text-align: center;">Aucun historique</li>';
    } else {
        recentHistory.forEach(entry => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="week-label">${entry.week}</span>
                <span class="person-name">${entry.person} <span class="status-done">✓</span></span>
            `;
            historyList.appendChild(li);
        });
    }
}

// Actions
function markAsDone() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();
    const weekKey = getWeekKey(currentWeek, currentYear);
    const person = getPersonForWeek(currentWeek, currentYear);

    // Ne pas marquer Maria comme "fait"
    if (person === 'Maria') {
        return;
    }

    // Check if already done
    if (history.some(h => h.week === weekKey)) {
        return;
    }

    history.push({
        week: weekKey,
        person: person,
        date: new Date().toISOString()
    });

    StorageModule.saveHistory(history);
    render();
}

function undoMarkAsDone() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();
    const weekKey = getWeekKey(currentWeek, currentYear);

    // Remove from history
    history = history.filter(h => h.week !== weekKey);

    StorageModule.saveHistory(history);
    render();
}

function performSwap(week, year, newPerson) {
    const weekKey = getWeekKey(week, year);
    const currentPerson = getPersonForWeek(week, year);

    // Find next week where newPerson is scheduled
    let searchWeek = week + 1;
    let searchYear = year;

    for (let i = 0; i < 8; i++) { // Search max 8 weeks
        if (searchWeek > 52) {
            searchWeek = 1;
            searchYear++;
        }

        const scheduledPerson = getPersonForWeek(searchWeek, searchYear);
        if (scheduledPerson === newPerson) {
            // Perform the swap
            swaps[weekKey] = newPerson;
            swaps[getWeekKey(searchWeek, searchYear)] = currentPerson;
            StorageModule.saveSwaps(swaps);

            alert(`✅ Échange confirmé !\n\n${currentPerson} ↔ ${newPerson}\n\nS${week}: ${newPerson}\nS${searchWeek}: ${currentPerson}`);

            document.getElementById('swapModal').classList.remove('active');
            render();
            return;
        }
        searchWeek++;
    }

    alert('Impossible de trouver une semaine pour l\'échange');
}

function generateICS() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KitchenDuty//Coloc//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:🍳 KitchenDuty
`;

    // Generate events for next 26 weeks (6 months)
    for (let i = 0; i < 26; i++) {
        let week = currentWeek + i;
        let year = currentYear;
        if (week > 52) {
            week = week - 52;
            year++;
        }

        const person = getPersonForWeek(week, year);
        const monday = getMondayOfWeek(week, year);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const formatICSDate = (d) => {
            return d.toISOString().split('T')[0].replace(/-/g, '');
        };

        const description = person === 'Maria'
            ? 'Semaine de Maria (femme de ménage)'
            : `C'est le tour de ${person} pour nettoyer la cuisine cette semaine !`;

        icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${formatICSDate(monday)}
DTEND;VALUE=DATE:${formatICSDate(sunday)}
SUMMARY:🍳 Cuisine: ${person}
DESCRIPTION:${description}
UID:kitchenduty-${year}-${week}@coloc
END:VEVENT
`;
    }

    icsContent += 'END:VCALENDAR';

    // Download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'kitchen-duty.ics';
    link.click();
}

// Event listeners
document.getElementById('btnDone').addEventListener('click', markAsDone);

document.getElementById('btnUndo').addEventListener('click', undoMarkAsDone);

document.getElementById('btnSwapToggle').addEventListener('click', () => {
    document.getElementById('swapModal').classList.toggle('active');
});

document.getElementById('btnCancelSwap').addEventListener('click', () => {
    document.getElementById('swapModal').classList.remove('active');
});

document.getElementById('btnExport').addEventListener('click', generateICS);

// Checklist
document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', saveChecklist);
});

// PWA Install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btnInstall').style.display = 'inline-block';
});

document.getElementById('btnInstall').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('btnInstall').style.display = 'none';
    }
});

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.log('SW registration failed:', err));
}

// Callback pour la synchronisation temps réel Firebase
function onFirebaseDataChange(dataType) {
    console.log(`Firebase data changed: ${dataType}`);

    // Recharger les données depuis le cache/localStorage
    if (dataType === 'history') {
        history = StorageModule.loadHistory();
    } else if (dataType === 'swaps') {
        swaps = StorageModule.loadSwaps();
    } else if (dataType === 'currentWeek') {
        // Recharger la checklist de la semaine courante
        loadChecklist();
    }

    // Rafraîchir l'UI
    render();
}

// Initialiser Firebase listeners
StorageModule.init(onFirebaseDataChange);

// Initial render
render();
loadChecklist();

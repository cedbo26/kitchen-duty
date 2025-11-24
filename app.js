// Configuration
const CONFIG = {
    members: ['Joya', 'Alessandro', 'Filippo', 'Cédric'],
    startWeek: 48, // Semaine de départ (actuelle)
    startYear: 2024
};

// Translations
const i18n = {
    fr: {
        week: 'Semaine',
        currentTurn: "C'est le tour de",
        markDone: 'Marquer comme fait',
        done: 'Fait !',
        undo: 'Annuler',
        checklistTitle: 'Checklist',
        task_poubelle: 'Poubelle (cartons et compartiments)',
        task_plaques: 'Nettoyer les plaques',
        task_table: 'Table',
        task_evier: 'Évier',
        task_machine: 'Vider la machine',
        task_sol: 'Faire le sol',
        task_sacs: 'Check des sacs poubelle',
        task_four: 'Four',
        completed: 'complété',
        nextWeeks: 'Prochaines semaines',
        history: 'Historique',
        addCalendar: 'Ajouter à mon calendrier',
        swap: 'Proposer un échange',
        swapWith: 'Échanger avec :',
        cancel: 'Annuler',
        noHistory: 'Aucun historique'
    },
    it: {
        week: 'Settimana',
        currentTurn: 'È il turno di',
        markDone: 'Segna come fatto',
        done: 'Fatto!',
        undo: 'Annulla',
        checklistTitle: 'Checklist',
        task_poubelle: 'Spazzatura (cartoni e scomparti)',
        task_plaques: 'Pulire i fornelli',
        task_table: 'Tavolo',
        task_evier: 'Lavandino',
        task_machine: 'Svuotare la lavastoviglie',
        task_sol: 'Lavare il pavimento',
        task_sacs: 'Controllare i sacchi',
        task_four: 'Forno',
        completed: 'completato',
        nextWeeks: 'Prossime settimane',
        history: 'Storico',
        addCalendar: 'Aggiungi al calendario',
        swap: 'Proponi uno scambio',
        swapWith: 'Scambia con:',
        cancel: 'Annulla',
        noHistory: 'Nessuno storico'
    }
};

let currentLang = localStorage.getItem('kitchenDuty_lang') || 'fr';

// State
let swaps = JSON.parse(localStorage.getItem('kitchenDuty_swaps') || '{}');
let history = JSON.parse(localStorage.getItem('kitchenDuty_history') || '[]');
let checklist = JSON.parse(localStorage.getItem('kitchenDuty_checklist') || '{}');

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

function getPersonForWeek(week, year) {
    const weekKey = getWeekKey(week, year);
    
    // Check for swaps
    if (swaps[weekKey]) {
        return swaps[weekKey];
    }
    
    // Calculate based on rotation
    const totalWeeks = (year - CONFIG.startYear) * 52 + week - CONFIG.startWeek;
    const index = ((totalWeeks % CONFIG.members.length) + CONFIG.members.length) % CONFIG.members.length;
    return CONFIG.members[index];
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

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) {
            el.textContent = i18n[currentLang][key];
        }
    });
    
    // Update language buttons
    document.getElementById('langFr').classList.toggle('active', currentLang === 'fr');
    document.getElementById('langIt').classList.toggle('active', currentLang === 'it');
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('kitchenDuty_lang', lang);
    applyTranslations();
    render();
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
    localStorage.setItem('kitchenDuty_checklist', JSON.stringify(checklist));
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
    
    // Week number
    document.getElementById('weekNumber').textContent = currentWeek;
    
    // Current person
    document.getElementById('currentPerson').textContent = currentPerson;
    
    // Done button state
    const btnDone = document.getElementById('btnDone');
    const btnUndo = document.getElementById('btnUndo');
    const isDone = history.some(h => h.week === weekKey);
    if (isDone) {
        btnDone.innerHTML = `✓ ${i18n[currentLang].done}`;
        btnDone.classList.add('completed');
        btnUndo.style.display = 'inline-block';
    } else {
        btnDone.innerHTML = `✓ <span data-i18n="markDone">${i18n[currentLang].markDone}</span>`;
        btnDone.classList.remove('completed');
        btnUndo.style.display = 'none';
    }
    
    // Swap options (exclude current person)
    const swapOptions = document.getElementById('swapOptions');
    swapOptions.innerHTML = '';
    CONFIG.members.filter(m => m !== currentPerson).forEach(member => {
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
        
        const monday = getMondayOfWeek(week, year);
        const person = getPersonForWeek(week, year);
        const weekKey = getWeekKey(week, year);
        const isDone = history.some(h => h.week === weekKey);
        
        const li = document.createElement('li');
        if (i === 0) li.classList.add('current');
        
        li.innerHTML = `
            <span class="week-label">S${week} · ${formatDate(monday)}</span>
            <span class="person-name">${person} ${isDone ? '<span class="status-done">✓</span>' : ''}</span>
        `;
        scheduleList.appendChild(li);
    }
    
    // History (last 4 entries)
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    const recentHistory = history.slice(-4).reverse();
    
    if (recentHistory.length === 0) {
        historyList.innerHTML = `<li style="color: var(--text-muted); text-align: center;">${i18n[currentLang].noHistory}</li>`;
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
    
    // Check if already done
    if (history.some(h => h.week === weekKey)) {
        return;
    }
    
    history.push({
        week: weekKey,
        person: person,
        date: new Date().toISOString()
    });
    
    localStorage.setItem('kitchenDuty_history', JSON.stringify(history));
    render();
}

function undoMarkAsDone() {
    const currentWeek = getWeekNumber();
    const currentYear = getCurrentYear();
    const weekKey = getWeekKey(currentWeek, currentYear);
    
    // Remove from history
    history = history.filter(h => h.week !== weekKey);
    
    localStorage.setItem('kitchenDuty_history', JSON.stringify(history));
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
            localStorage.setItem('kitchenDuty_swaps', JSON.stringify(swaps));
            
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
        
        icsContent += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${formatICSDate(monday)}
DTEND;VALUE=DATE:${formatICSDate(sunday)}
SUMMARY:🍳 Cuisine: ${person}
DESCRIPTION:C'est le tour de ${person} pour nettoyer la cuisine cette semaine !
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

// Language switch
document.getElementById('langFr').addEventListener('click', () => setLanguage('fr'));
document.getElementById('langIt').addEventListener('click', () => setLanguage('it'));

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

// Initial render
applyTranslations();
render();
loadChecklist();

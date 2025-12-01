const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialiser Firebase Admin
admin.initializeApp();

// Configuration
const CONFIG = {
    members: ['Joya', 'Alessandro', 'Filippo', 'Cédric'],
    // Nouvelle référence : semaine 47 de 2025 = Maria (décalage d'une semaine en arrière)
    mariaReferenceWeek: 47,
    mariaReferenceYear: 2025,
    webappURL: 'https://cedbo26.github.io/kitchen-duty/'
};

/**
 * Obtient le numéro de semaine ISO d'une date
 */
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { week: weekNum, year: d.getUTCFullYear() };
}

/**
 * Obtient le lundi d'une semaine ISO donnée
 */
function getMondayOfISOWeek(week, year) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const monday = new Date(simple);
    if (dow <= 4) {
        monday.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        monday.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return monday;
}

/**
 * Obtient le mercredi d'une semaine ISO donnée
 */
function getWednesdayOfISOWeek(week, year) {
    const monday = getMondayOfISOWeek(week, year);
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2); // Lundi + 2 jours = Mercredi
    return wednesday;
}

/**
 * Obtient le mardi d'une semaine ISO donnée
 */
function getTuesdayOfISOWeek(week, year) {
    const monday = getMondayOfISOWeek(week, year);
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1); // Lundi + 1 jour = Mardi
    return tuesday;
}

/**
 * Calcule la différence en semaines ISO entre deux semaines
 */
function getWeekDifference(year1, week1, year2, week2) {
    const monday1 = getMondayOfISOWeek(week1, year1);
    const monday2 = getMondayOfISOWeek(week2, year2);
    const diffTime = monday2.getTime() - monday1.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const diffWeeks = Math.round(diffDays / 7);
    return diffWeeks;
}

/**
 * Détermine qui est responsable d'une semaine donnée
 * Nouvelle logique : Maria référencée sur semaine 47/2025 (décalage d'une semaine)
 */
function getPersonForWeek(week, year, swaps = {}) {
    const weekKey = `${year}-W${week}`;

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

    // Si diff est pair → Maria (47, 49, 51, 1, 3, etc.)
    if (diff % 2 === 0) {
        return 'Maria';
    }

    // Si diff est impair → rotation des colocs
    const colocRotationIndex = Math.floor(diff / 2);
    const colocIndex = colocRotationIndex % CONFIG.members.length;
    const adjustedIndex = (colocIndex + CONFIG.members.length) % CONFIG.members.length;
    return CONFIG.members[adjustedIndex];
}

/**
 * Formate une date en format ICS all-day (YYYYMMDD)
 */
function toICSDateAllDay(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Formate une date en format ICS avec heure locale (YYYYMMDDTHHMMSS)
 */
function toICSDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Formate une date en format ICS (YYYYMMDDTHHMMSSZ)
 */
function toICSDateUTC(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Génère un UID unique pour un événement
 */
function generateUID(year, week) {
    return `kitchenduty-${year}-W${week}@kitchen-duty-75864.web.app`;
}

/**
 * Génère le contenu ICS complet
 */
async function generateICSContent() {
    // Récupérer les swaps depuis Firebase
    const db = admin.database();
    const swapsSnapshot = await db.ref('swaps').once('value');
    const swaps = swapsSnapshot.val() || {};

    // Date actuelle
    const now = new Date();
    const currentISOWeek = getISOWeek(now);

    // Période : aujourd'hui + 3 mois (environ 13 semaines)
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 3);

    // En-tête ICS avec timezone Europe/Zurich
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KitchenDuty//Firebase Functions//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:🍳 KitchenDuty
X-WR-TIMEZONE:Europe/Zurich
X-WR-CALDESC:Planning de nettoyage cuisine - Colocation
BEGIN:VTIMEZONE
TZID:Europe/Zurich
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
`;

    // Générer les événements pour les prochaines semaines
    let currentWeek = currentISOWeek.week;
    let currentYear = currentISOWeek.year;
    const endISOWeek = getISOWeek(endDate);

    // Logs pour vérification
    console.log('=== Génération ICS - Exemples de semaines ===');

    while (currentYear < endISOWeek.year ||
           (currentYear === endISOWeek.year && currentWeek <= endISOWeek.week)) {

        const person = getPersonForWeek(currentWeek, currentYear, swaps);
        const isMaria = person === 'Maria';
        const weekKey = `${currentYear}-W${currentWeek}`;

        // Événement all-day de mercredi à samedi inclus
        const wednesday = getWednesdayOfISOWeek(currentWeek, currentYear);
        const sunday = new Date(wednesday);
        sunday.setDate(wednesday.getDate() + 4); // Mercredi + 4 jours = Dimanche (exclusif)

        const dtstart = toICSDateAllDay(wednesday);
        const dtend = toICSDateAllDay(sunday);

        // Mardi 20h pour le VALARM (uniquement pour les colocs)
        const tuesday = getTuesdayOfISOWeek(currentWeek, currentYear);
        tuesday.setHours(20, 0, 0, 0);
        const tuesdayTrigger = toICSDateTimeLocal(tuesday);

        // Description avec URL
        const description = isMaria
            ? `Semaine de Maria (femme de ménage)\\n\\nWebapp: ${CONFIG.webappURL}`
            : `C'est le tour de ${person} pour nettoyer la cuisine cette semaine !\\n\\nWebapp: ${CONFIG.webappURL}`;

        const summary = `Kitchen : ${person}`;

        // Logs pour les 4 premières semaines
        if (currentWeek <= currentISOWeek.week + 3) {
            console.log(`${weekKey} | ${person} | Maria=${isMaria} | DTSTART=${dtstart} | DTEND=${dtend} | VALARM=${!isMaria}`);
        }

        // Ajouter l'événement au format ICS
        icsContent += `BEGIN:VEVENT
UID:${generateUID(currentYear, currentWeek)}
DTSTAMP:${toICSDateUTC(now)}
DTSTART;VALUE=DATE:${dtstart}
DTEND;VALUE=DATE:${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
URL:${CONFIG.webappURL}
STATUS:CONFIRMED
SEQUENCE:0
TRANSP:TRANSPARENT
`;

        // Ajouter VALARM uniquement pour les colocs (pas pour Maria)
        if (!isMaria) {
            icsContent += `BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Rappel KitchenDuty - C'est ton tour cette semaine !
TRIGGER;TZID=Europe/Zurich:${tuesdayTrigger}
END:VALARM
`;
        }

        icsContent += `END:VEVENT
`;

        // Passer à la semaine suivante
        currentWeek++;
        if (currentWeek > 52) {
            // Vérifier si l'année a réellement 53 semaines
            const lastDayOfYear = new Date(currentYear, 11, 31);
            const lastWeekInfo = getISOWeek(lastDayOfYear);

            if (lastWeekInfo.week === 53 && currentWeek <= 53) {
                // L'année a 53 semaines, continuer
                currentWeek++;
            }

            if (currentWeek > 53 || (currentWeek > 52 && lastWeekInfo.week !== 53)) {
                currentWeek = 1;
                currentYear++;
            }
        }
    }

    // Fermeture du calendrier
    icsContent += 'END:VCALENDAR';

    return icsContent;
}

/**
 * Fonction Cloud déployée publiquement
 * URL: https://europe-west1-kitchen-duty-75864.cloudfunctions.net/kitchenDutyCalendar
 */
exports.kitchenDutyCalendar = functions
    .region('europe-west1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onRequest(async (req, res) => {
        try {
            // Générer le contenu ICS
            const icsContent = await generateICSContent();

            // Définir les en-têtes de réponse
            res.set('Content-Type', 'text/calendar; charset=utf-8');
            res.set('Content-Disposition', 'attachment; filename="kitchen-duty.ics"');
            res.set('Cache-Control', 'public, max-age=3600'); // Cache 1 heure

            // Permettre CORS
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET');

            // Envoyer le contenu
            res.status(200).send(icsContent);
        } catch (error) {
            console.error('Erreur lors de la génération du calendrier:', error);
            res.status(500).send('Erreur lors de la génération du calendrier');
        }
    });

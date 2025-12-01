const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Configuration
const CONFIG = {
  members: ["Joya", "Alessandro", "Filippo", "Cédric"],
  // S47/2025 = Maria, puis toutes les 2 semaines à partir de là
  mariaReferenceWeek: 47,
  mariaReferenceYear: 2025,
  webappURL: "https://cedbo26.github.io/kitchen-duty/",
};

// Helpers semaines ISO
function getMondayOfISOWeek(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay(); // 0 = dim, 1 = lun
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setDate(simple.getDate() - dow + 1);
  } else {
    monday.setDate(simple.getDate() + 8 - dow);
  }
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getISOWeek(date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNo =
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  return { year: tmp.getFullYear(), week: weekNo };
}

function getWednesdayOfISOWeek(week, year) {
  const monday = getMondayOfISOWeek(week, year);
  const wednesday = new Date(monday);
  wednesday.setDate(monday.getDate() + 2); // lun + 2 = mer
  wednesday.setHours(0, 0, 0, 0);
  return wednesday;
}

function getTuesdayOfISOWeek(week, year) {
  const monday = getMondayOfISOWeek(week, year);
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1); // lun + 1 = mar
  tuesday.setHours(0, 0, 0, 0);
  return tuesday;
}

// Diff de semaines entre (year1, week1) et (year2, week2)
function getWeekDifference(year1, week1, year2, week2) {
  const monday1 = getMondayOfISOWeek(week1, year1);
  const monday2 = getMondayOfISOWeek(week2, year2);
  const diffDays = (monday2.getTime() - monday1.getTime()) / 86400000;
  return Math.round(diffDays / 7);
}

function getWeekKey(week, year) {
  return `${year}-W${week}`;
}

// Format ICS
function toICSDateUTC(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function toICSDateAllDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function toICSDateTimeLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

// Qui a la semaine, en tenant compte des swaps
function getPersonForWeek(week, year, swaps = {}) {
  const weekKey = getWeekKey(week, year);

  // 1) Swap prioritaire
  if (swaps[weekKey]) {
    return swaps[weekKey];
  }

  // 2) Différence en semaines par rapport à la référence Maria (S47/2025)
  const diff = getWeekDifference(
    CONFIG.mariaReferenceYear,
    CONFIG.mariaReferenceWeek,
    year,
    week
  );

  // Pour l’horizon utile (à partir de S47/2025) :
  // diff = 0 → S47/2025 = Maria, diff = 2 → Maria, etc.
  if (diff >= 0 && diff % 2 === 0) {
    return "Maria";
  }

  // 3) Semaines intermédiaires : rotation colocs
  // diff impair ≥ 1 : 1,3,5,7,... → 0,1,2,3,... pour la rotation
  let colocRotationIndex;
  if (diff >= 0) {
    colocRotationIndex = Math.floor((diff - 1) / 2);
  } else {
    // Si jamais on va avant la référence, on garde une rotation stable
    colocRotationIndex = Math.floor(diff / 2);
  }

  const len = CONFIG.members.length;
  const colocIndex = ((colocRotationIndex % len) + len) % len;
  return CONFIG.members[colocIndex];
}

// Cloud Function ICS
exports.kitchenDutyCalendar = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.database();
      const swapsSnap = await db.ref("swaps").get();
      const swaps = swapsSnap.exists() ? swapsSnap.val() : {};

      const now = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 3);

      // Normaliser sur le lundi de la semaine en cours
      const isoNow = getISOWeek(now);
      let monday = getMondayOfISOWeek(isoNow.week, isoNow.year);

      let ics = "";
      ics += "BEGIN:VCALENDAR\r\n";
      ics += "VERSION:2.0\r\n";
      ics += "PRODID:-//KitchenDuty//Firebase Functions//FR\r\n";
      ics += "CALSCALE:GREGORIAN\r\n";
      ics += "METHOD:PUBLISH\r\n";
      ics += "X-WR-CALNAME:🍳 KitchenDuty\r\n";
      ics += "X-WR-TIMEZONE:Europe/Zurich\r\n";
      ics += "X-WR-CALDESC:Planning de nettoyage cuisine - Colocation\r\n";

      // VTIMEZONE simplifié Europe/Zurich
      ics += "BEGIN:VTIMEZONE\r\n";
      ics += "TZID:Europe/Zurich\r\n";
      ics += "BEGIN:STANDARD\r\n";
      ics += "DTSTART:19701025T030000\r\n";
      ics += "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\n";
      ics += "TZOFFSETFROM:+0200\r\n";
      ics += "TZOFFSETTO:+0100\r\n";
      ics += "END:STANDARD\r\n";
      ics += "BEGIN:DAYLIGHT\r\n";
      ics += "DTSTART:19700329T020000\r\n";
      ics += "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\n";
      ics += "TZOFFSETFROM:+0100\r\n";
      ics += "TZOFFSETTO:+0200\r\n";
      ics += "END:DAYLIGHT\r\n";
      ics += "END:VTIMEZONE\r\n";

      while (monday <= end) {
        const { year, week } = getISOWeek(monday);
        const weekKey = getWeekKey(week, year);
        const person = getPersonForWeek(week, year, swaps);
        const isMaria = person === "Maria";

        // Mercredi–samedi (DTEND dimanche exclusif)
        const wednesday = getWednesdayOfISOWeek(week, year);
        const sundayExclusive = new Date(wednesday);
        sundayExclusive.setDate(wednesday.getDate() + 4); // mer → sam (DTEND = dim exclu)

        const dtstart = toICSDateAllDay(wednesday);
        const dtend = toICSDateAllDay(sundayExclusive);

        const summary = `Kitchen : ${person}`;

        const description = isMaria
          ? `Semaine de Maria (femme de ménage)\\n\\nWebapp: ${CONFIG.webappURL}`
          : `C'est le tour de ${person} pour nettoyer la cuisine cette semaine !\\n\\nWebapp: ${CONFIG.webappURL}`;

        const nowStamp = toICSDateUTC(now);

        ics += "BEGIN:VEVENT\r\n";
        ics += `UID:kitchenduty-${weekKey}@kitchen-duty-75864.web.app\r\n`;
        ics += `DTSTAMP:${nowStamp}\r\n`;
        ics += `DTSTART;VALUE=DATE:${dtstart}\r\n`;
        ics += `DTEND;VALUE=DATE:${dtend}\r\n`;
        ics += `SUMMARY:${summary}\r\n`;
        ics += `DESCRIPTION:${description}\r\n`;
        ics += `URL:${CONFIG.webappURL}\r\n`;
        ics += "STATUS:CONFIRMED\r\n";
        ics += "SEQUENCE:0\r\n";
        ics += "TRANSP:TRANSPARENT\r\n";

        // VALARM mardi 20:00 Europe/Zurich uniquement pour les colocs
        if (!isMaria) {
          const tuesday = getTuesdayOfISOWeek(week, year);
          tuesday.setHours(20, 0, 0, 0);
          const triggerLocal = toICSDateTimeLocal(tuesday);

          ics += "BEGIN:VALARM\r\n";
          ics += "ACTION:DISPLAY\r\n";
          ics +=
            "DESCRIPTION:Rappel KitchenDuty - C'est ton tour cette semaine !\r\n";
          ics += `TRIGGER;TZID=Europe/Zurich:${triggerLocal}\r\n`;
          ics += "END:VALARM\r\n";
        }

        ics += "END:VEVENT\r\n";

        // Semaine suivante
        monday.setDate(monday.getDate() + 7);
      }

      ics += "END:VCALENDAR\r\n";

      res.set("Content-Type", "text/calendar; charset=utf-8");
      res.status(200).send(ics);
    } catch (err) {
      console.error("ICS generation error", err);
      res.status(500).send("Error generating calendar");
    }
  });
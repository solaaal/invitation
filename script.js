/* =====================================================================
   GRUPPOMIMO — INVITATION — script.js
   Toute la logique du mini-site : navigation entre écrans, calendrier,
   confettis, et envoi des données (Formspree / Google Sheets).
   ===================================================================== */

(() => {
  "use strict";

  /* ===================================================================
     0. CONFIGURATION — à personnaliser facilement
     =================================================================== */
  const CONFIG = {
    // Option A — Formspree : remplacez par l'URL de votre formulaire Formspree
    // (créez un formulaire sur https://formspree.io puis collez son endpoint ici)
    FORMSPREE_ENDPOINT: "https://formspree.io/f/xojobkvn", // ex: "https://formspree.io/f/xxxxxxxx"

    // Option B — Google Sheet via Google Apps Script Web App
    // (déployez un script Apps Script en tant que "Web App" et collez l'URL ici)
    GOOGLE_SHEET_WEBAPP_URL: "", // ex: "https://script.google.com/macros/s/xxxx/exec"

    // Année/mois affichés dans le calendrier
    CALENDAR_YEAR: 2026,
    CALENDAR_MONTH: 6, // 0-indexé : 6 = Juillet

    // Jours totalement indisponibles (bloqués, affichés en rouge)
    FULLY_BLOCKED_DAYS: [9],

    // Jours avec seulement certains créneaux indisponibles
    // "lunch" = 11h30/12h00/12h30 — "evening" = 19h00/19h30/20h00
    PARTIAL_BLOCKED_DAYS: {
      8: ["19h00", "19h30", "20h00"],   // pas dispo le 8 au soir
      28: ["11h30", "12h00", "12h30"],  // pas dispo le 28 à midi
    },

    // Jour avec un message spécial affiché au clic
    SPECIAL_DAY: 14,
    SPECIAL_DAY_MESSAGE:
      "Comme tu le sais, ce jour sera notre anniversaire de rencontre. Trois ans après t'avoir rencontré, je suis toujours aussi attendri en te regardant, comme le premier jour. J'espère que le restaurant sera ouvert si c'est ton seul jour de disponibilité, sinon, je m'arrangerai :)",

    // Messages affichés à chaque esquive du bouton "Non" (dans l'ordre)
    DODGE_MESSAGES: ["T'es sûre ? 👀", "Arrête !! 😰😰", "Nonnnn "],
  };

  /* ===================================================================
     1. UTILITAIRES DE NAVIGATION ENTRE ÉCRANS
     =================================================================== */
  const screens = {
    hero: document.getElementById("page-hero"),
    question: document.getElementById("page-question"),
    no: document.getElementById("page-no"),
    calendar: document.getElementById("page-calendar"),
    final: document.getElementById("page-final"),
  };

  const progressFill = document.getElementById("progressFill");
  const stepLabel = document.getElementById("stepLabel");
  const stepEls = document.querySelectorAll(".step");

  /**
   * Affiche un écran avec une transition en fondu, et masque le précédent.
   * @param {HTMLElement} nextScreen - écran à afficher
   */
  function goTo(nextScreen) {
    const current = document.querySelector(".screen.is-active");
    if (current === nextScreen) return;

    if (current) {
      current.classList.add("is-leaving");
      current.classList.remove("is-entering");
      window.setTimeout(() => {
        current.classList.remove("is-active", "is-leaving");
      }, 350);
    }

    window.setTimeout(() => {
      nextScreen.classList.add("is-active", "is-entering");
      nextScreen.scrollIntoView({ behavior: "instant", block: "start" });
      window.setTimeout(() => nextScreen.classList.remove("is-entering"), 700);
      updateProgress(nextScreen.dataset.step);
    }, current ? 260 : 0);
  }

  /**
   * Met à jour la barre de progression (🍝 ─ ❤️ ─ 📅 ─ 🎉).
   * @param {string|number} step - étape courante (1 à 4)
   */
  function updateProgress(step) {
    const s = Number(step);
    const percent = ((s - 1) / 3) * 100;
    progressFill.style.width = percent + "%";
    stepLabel.textContent = `Étape ${s} / 4`;

    stepEls.forEach((el) => {
      const elStep = Number(el.dataset.step);
      el.classList.toggle("is-active", elStep === s);
      el.classList.toggle("is-done", elStep < s);
    });
  }

  /* ===================================================================
     2. ÉCOUTEURS DE NAVIGATION
     =================================================================== */
  /**
   * Attache un écouteur seulement si l'élément existe.
   * Évite qu'un bouton supprimé dans le HTML ne bloque tout le reste du script.
   */
  function on(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
  }

  on("btnToQuestion", () => goTo(screens.question));

  on("btnYes", () => {
    goTo(screens.calendar);
    launchConfetti(90);
  });

  /* --- Bouton "Non" qui esquive 3 fois avant de vraiment fonctionner --- */
  const noBtn = document.getElementById("btnNo");
  const dodgeMessageEl = document.getElementById("dodgeMessage");
  let dodgeCount = 0;
  let dodgeMessageTimeout = null;

  function showDodgeMessage(text) {
    if (!dodgeMessageEl) return;
    clearTimeout(dodgeMessageTimeout);
    dodgeMessageEl.textContent = text;
    dodgeMessageEl.classList.remove("is-visible");
    void dodgeMessageEl.offsetWidth; // force le redémarrage de l'animation
    dodgeMessageEl.classList.add("is-visible");
    dodgeMessageTimeout = window.setTimeout(() => {
      dodgeMessageEl.classList.remove("is-visible");
    }, 1600);
  }

  function moveButtonRandomly(btn) {
    const rect = btn.getBoundingClientRect();
    const margin = 20;
    const minTop = 160; // reste sous la barre de progression
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(minTop, window.innerHeight - rect.height - margin - 40);

    const randLeft = margin + Math.random() * (maxLeft - margin);
    const randTop = minTop + Math.random() * (maxTop - minTop);

    btn.style.position = "fixed";
    btn.style.left = randLeft + "px";
    btn.style.top = randTop + "px";
    btn.style.margin = "0";
    btn.style.zIndex = "60";
    btn.style.transition = "left .35s var(--ease), top .35s var(--ease)";

    btn.classList.remove("is-dodging");
    void btn.offsetWidth;
    btn.classList.add("is-dodging");
  }

  function resetDodge() {
    dodgeCount = 0;
    if (noBtn) {
      noBtn.classList.remove("is-dodging");
      noBtn.style.position = "";
      noBtn.style.left = "";
      noBtn.style.top = "";
      noBtn.style.margin = "";
      noBtn.style.zIndex = "";
      noBtn.style.transition = "";
    }
    if (dodgeMessageEl) dodgeMessageEl.classList.remove("is-visible");
  }

  if (noBtn) {
    noBtn.addEventListener("click", () => {
      if (dodgeCount < CONFIG.DODGE_MESSAGES.length) {
        showDodgeMessage(CONFIG.DODGE_MESSAGES[dodgeCount]);
        moveButtonRandomly(noBtn);
        dodgeCount++;
      } else {
        resetDodge();
        goTo(screens.no);
      }
    });
  }

  on("btnChangeMind", () => {
    resetDodge();
    goTo(screens.question);
  });

  on("btnClose", () => {
    // Fermeture élégante : on tente de fermer l'onglet, sinon on informe l'utilisateur.
    window.close();
    window.setTimeout(() => {
      const subtle = document.querySelector(".subtle-text");
      if (subtle) subtle.textContent = "Vous pouvez fermer cet onglet à tout moment ❤️";
    }, 300);
  });

  /* ===================================================================
     3. CALENDRIER — génération dynamique du mois de Juillet
     =================================================================== */
  const calendarGrid = document.getElementById("calendarGrid");
  const timeSlotsContainer = document.getElementById("timeSlots");
  const btnValidate = document.getElementById("btnValidate");
  const calendarHint = document.getElementById("calendarHint");

  let selectedDay = null;
  let selectedTime = null;

  function buildCalendar() {
    const { CALENDAR_YEAR, CALENDAR_MONTH } = CONFIG;
    const daysInMonth = new Date(CALENDAR_YEAR, CALENDAR_MONTH + 1, 0).getDate();
    const firstWeekday = new Date(CALENDAR_YEAR, CALENDAR_MONTH, 1).getDay(); // 0=dim
    // On veut une semaine commençant le lundi : décalage
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;

    const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];
    const frag = document.createDocumentFragment();

    dayLabels.forEach((label) => {
      const el = document.createElement("div");
      el.className = "day-label";
      el.textContent = label;
      frag.appendChild(el);
    });

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "day-cell is-empty";
      frag.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day-cell";
      cell.textContent = day;
      cell.setAttribute("role", "listitem");
      cell.setAttribute("aria-label", `${day} juillet`);

      if (CONFIG.FULLY_BLOCKED_DAYS.includes(day)) {
        cell.classList.add("is-unavailable");
        cell.disabled = true;
        cell.setAttribute("aria-disabled", "true");
        cell.setAttribute("aria-label", `${day} juillet — indisponible`);
      } else {
        cell.addEventListener("click", () => selectDay(cell, day));
      }

      frag.appendChild(cell);
    }

    calendarGrid.appendChild(frag);
  }

  const specialDayMessage = document.getElementById("specialDayMessage");

  function selectDay(cell, day) {
    document.querySelectorAll(".day-cell").forEach((c) => c.classList.remove("is-selected"));
    cell.classList.add("is-selected");
    selectedDay = day;

    // Message spécial (ex : 14 juillet)
    if (day === CONFIG.SPECIAL_DAY) {
      specialDayMessage.textContent = CONFIG.SPECIAL_DAY_MESSAGE;
      specialDayMessage.hidden = false;
    } else {
      specialDayMessage.hidden = true;
    }

    // Créneaux bloqués pour ce jour précis
    const blockedTimes = CONFIG.PARTIAL_BLOCKED_DAYS[day] || [];
    timeSlotsContainer.querySelectorAll(".time-chip").forEach((chip) => {
      const isBlocked = blockedTimes.includes(chip.dataset.time);
      chip.classList.toggle("is-unavailable", isBlocked);
      chip.disabled = isBlocked;
      chip.setAttribute("aria-disabled", String(isBlocked));

      // Si le créneau précédemment choisi devient invalide, on le désélectionne
      if (isBlocked && chip.classList.contains("is-selected")) {
        chip.classList.remove("is-selected");
        selectedTime = null;
      }
    });

    refreshValidateState();
  }

  timeSlotsContainer.querySelectorAll(".time-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      timeSlotsContainer.querySelectorAll(".time-chip").forEach((c) => c.classList.remove("is-selected"));
      chip.classList.add("is-selected");
      selectedTime = chip.dataset.time;
      refreshValidateState();
    });
  });

  function refreshValidateState() {
    const ready = selectedDay && selectedTime;
    btnValidate.disabled = !ready;
    calendarHint.textContent = ready
      ? `Rendez-vous le ${selectedDay} juillet à ${selectedTime} ✨`
      : "Choisissez un jour et une heure ✨";
  }

  btnValidate.addEventListener("click", async () => {
    if (!selectedDay || !selectedTime) return;

    btnValidate.disabled = true;
    btnValidate.textContent = "Envoi en cours…";

    const payload = {
      date: `${selectedDay} juillet ${CONFIG.CALENDAR_YEAR}`,
      heure: selectedTime,
      envoye_le: new Date().toISOString(),
    };

    await sendReservation(payload);

    document.getElementById("finalRecap").textContent =
      `📍 GruppoMimo — ${payload.date} à ${payload.heure}`;

    goTo(screens.final);
    launchConfetti(160);
  });

  /* ===================================================================
     4. ENVOI DES DONNÉES — Formspree ou Google Sheets
     =================================================================== */
  /**
   * Envoie la réservation vers Formspree et/ou Google Sheets si configurés.
   * Fonctionne silencieusement en local si aucune URL n'est renseignée.
   * @param {{date:string, heure:string, envoye_le:string}} payload
   */
  async function sendReservation(payload) {
    const tasks = [];

    if (CONFIG.FORMSPREE_ENDPOINT) {
      tasks.push(
        fetch(CONFIG.FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        }).catch((err) => console.warn("Formspree indisponible :", err))
      );
    }

    if (CONFIG.GOOGLE_SHEET_WEBAPP_URL) {
      tasks.push(
        fetch(CONFIG.GOOGLE_SHEET_WEBAPP_URL, {
          method: "POST",
          mode: "no-cors", // Apps Script ne renvoie pas toujours les en-têtes CORS
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch((err) => console.warn("Google Sheet indisponible :", err))
      );
    }

    if (tasks.length === 0) {
      console.info("[GruppoMimo] Aucune destination configurée — payload :", payload);
      return;
    }

    await Promise.allSettled(tasks);
  }

  /* ===================================================================
     5. CONFETTIS — canvas léger, sans dépendance externe
     =================================================================== */
  const canvas = document.getElementById("confettiCanvas");
  const ctx = canvas.getContext("2d");
  let confettiParticles = [];
  let confettiRAF = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const CONFETTI_COLORS = ["#C23B3B", "#FBE2E2", "#FBF6EF", "#201C1B", "#E8A0A0"];

  function launchConfetti(count = 100) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    for (let i = 0; i < count; i++) {
      confettiParticles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.3,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        speedY: 2 + Math.random() * 3,
        speedX: (Math.random() - 0.5) * 2,
        opacity: 1,
        life: 0,
      });
    }

    if (!confettiRAF) animateConfetti();
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confettiParticles.forEach((p) => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;
      p.life += 1;
      if (p.life > 140) p.opacity = Math.max(0, p.opacity - 0.04);

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    confettiParticles = confettiParticles.filter(
      (p) => p.opacity > 0 && p.y < canvas.height + 40
    );

    if (confettiParticles.length > 0) {
      confettiRAF = requestAnimationFrame(animateConfetti);
    } else {
      confettiRAF = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ===================================================================
     6. REVEAL AU SCROLL (section carbonara de la page 1)
     =================================================================== */
  const revealTargets = document.querySelectorAll(".reveal-on-scroll");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  revealTargets.forEach((el) => io.observe(el));

  /* ===================================================================
     7. INITIALISATION
     =================================================================== */
  buildCalendar();
  updateProgress(1);
})();

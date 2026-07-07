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
  document.getElementById("btnToQuestion").addEventListener("click", () => {
    goTo(screens.question);
  });

  document.getElementById("btnYes").addEventListener("click", () => {
    goTo(screens.calendar);
    launchConfetti(90);
  });

  document.getElementById("btnNo").addEventListener("click", () => {
    goTo(screens.no);
  });

  document.getElementById("btnChangeMind").addEventListener("click", () => {
    goTo(screens.question);
  });

  document.getElementById("btnClose").addEventListener("click", () => {
    // Fermeture élégante : on tente de fermer l'onglet, sinon on informe l'utilisateur.
    window.close();
    window.setTimeout(() => {
      document.querySelector(".subtle-text").textContent =
        "Vous pouvez fermer cet onglet à tout moment ❤️";
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
      cell.addEventListener("click", () => selectDay(cell, day));
      frag.appendChild(cell);
    }

    calendarGrid.appendChild(frag);
  }

  function selectDay(cell, day) {
    document.querySelectorAll(".day-cell").forEach((c) => c.classList.remove("is-selected"));
    cell.classList.add("is-selected");
    selectedDay = day;
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

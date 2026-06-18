/* ===== Automvia — réservation d'appels découverte =====
   Site statique (GitHub Pages) : les réservations sont
   1) conservées dans le navigateur (localStorage), et
   2) envoyées par courriel à Automvia via FormSubmit. */

(function () {
  "use strict";

  // --- Configuration ---
  // Pour CACHER votre courriel du code public, FormSubmit fournit un
  // identifiant unique une fois le formulaire activé :
  //   1) Envoyez une réservation de test → cliquez le lien d'activation reçu par courriel.
  //   2) Sur https://formsubmit.co, copiez votre « unique string ».
  //   3) Collez-la ci-dessous (ex. "a1b2c3d4e5f6").
  // Tant qu'elle est vide, le courriel ci-dessous est utilisé directement.
  var CODE_FORMSUBMIT = "";
  var COURRIEL_NOTIFICATION = "automvia@gmail.com";
  var ENDPOINT = "https://formsubmit.co/ajax/" + (CODE_FORMSUBMIT || COURRIEL_NOTIFICATION);
  var HEURE_DEBUT = 9;      // 9 h
  var HEURE_FIN = 17;       // dernier créneau : 16 h 30
  var MOIS_MAX = 2;         // réservation jusqu'à 2 mois d'avance
  var CLE_STOCKAGE = "automvia_reservations";

  var MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  // --- État ---
  var aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  var moisAffiche = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
  var dateChoisie = null;   // "AAAA-MM-JJ"
  var heureChoisie = null;  // "HH:MM"

  // --- Éléments ---
  var $ = function (id) { return document.getElementById(id); };
  var calMonth = $("calMonth"), calDays = $("calDays");
  var calPrev = $("calPrev"), calNext = $("calNext");
  var slotsEl = $("slots"), slotsDate = $("slotsDate");
  var form = $("bookingForm"), formError = $("formError");
  var summary = $("bookingSummary"), submitBtn = $("submitBtn");
  var bookingEl = $("booking"), confirmEl = $("confirmation");
  var confirmDetails = $("confirmationDetails");

  // --- Utilitaires ---
  function cleDate(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function formatHeure(h, m) {
    return h + " h " + String(m).padStart(2, "0");
  }

  function dateLisible(cle) {
    var p = cle.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return JOURS_FR[d.getDay()] + " " + d.getDate() + " " + MOIS_FR[d.getMonth()] + " " + d.getFullYear();
  }

  function lireReservations() {
    try {
      return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || [];
    } catch (e) {
      return [];
    }
  }

  function creneauPris(date, heure) {
    return lireReservations().some(function (r) {
      return r.date === date && r.heure === heure;
    });
  }

  // --- Calendrier ---
  function rendreCalendrier() {
    var annee = moisAffiche.getFullYear();
    var mois = moisAffiche.getMonth();
    calMonth.textContent = MOIS_FR[mois] + " " + annee;

    var moisMin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    var moisMax = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + MOIS_MAX, 1);
    calPrev.disabled = moisAffiche <= moisMin;
    calNext.disabled = moisAffiche >= moisMax;

    calDays.innerHTML = "";
    var premier = new Date(annee, mois, 1);
    // Semaine débutant le lundi : dimanche (0) devient la 7e colonne
    var decalage = (premier.getDay() + 6) % 7;
    for (var v = 0; v < decalage; v++) {
      var vide = document.createElement("span");
      vide.className = "cal-empty";
      calDays.appendChild(vide);
    }

    var nbJours = new Date(annee, mois + 1, 0).getDate();
    for (var j = 1; j <= nbJours; j++) {
      var d = new Date(annee, mois, j);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = j;
      var weekend = d.getDay() === 0 || d.getDay() === 6;
      btn.disabled = weekend || d < aujourdhui;
      if (dateChoisie === cleDate(d)) btn.classList.add("selected");
      btn.addEventListener("click", (function (dd) {
        return function () {
          dateChoisie = cleDate(dd);
          heureChoisie = null;
          rendreCalendrier();
          rendreCreneaux();
          majResume();
        };
      })(d));
      calDays.appendChild(btn);
    }
  }

  calPrev.addEventListener("click", function () {
    moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() - 1, 1);
    rendreCalendrier();
  });
  calNext.addEventListener("click", function () {
    moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + 1, 1);
    rendreCalendrier();
  });

  // --- Créneaux ---
  function rendreCreneaux() {
    slotsEl.innerHTML = "";
    if (!dateChoisie) {
      slotsDate.textContent = "Sélectionnez d'abord une date dans le calendrier.";
      return;
    }
    slotsDate.textContent = "Disponibilités le " + dateLisible(dateChoisie) + " :";

    for (var h = HEURE_DEBUT; h < HEURE_FIN; h++) {
      [0, 30].forEach(function (m) {
        var valeur = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = formatHeure(h, m);
        btn.disabled = creneauPris(dateChoisie, valeur);
        if (heureChoisie === valeur) btn.classList.add("selected");
        btn.addEventListener("click", function () {
          heureChoisie = valeur;
          rendreCreneaux();
          majResume();
        });
        slotsEl.appendChild(btn);
      });
    }
  }

  function majResume() {
    if (dateChoisie && heureChoisie) {
      var p = heureChoisie.split(":");
      summary.hidden = false;
      summary.textContent = "📅 Votre appel découverte : " + dateLisible(dateChoisie) +
        " à " + formatHeure(+p[0], +p[1]) + " (30 minutes)";
    } else {
      summary.hidden = true;
    }
  }

  // --- Soumission ---
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.hidden = true;

    // Anti-pourriel : si le champ honeypot est rempli, c'est un robot.
    // On interrompt silencieusement, sans rien enregistrer ni envoyer.
    if ($("fSiteWeb") && $("fSiteWeb").value) { return; }

    var nom = $("fNom").value.trim();
    var courriel = $("fCourriel").value.trim();
    var entreprise = $("fEntreprise").value.trim();
    var message = $("fMessage").value.trim();

    if (!dateChoisie || !heureChoisie) {
      afficherErreur("Veuillez choisir une date et une heure avant de confirmer.");
      return;
    }
    if (!nom || !courriel || !entreprise) {
      afficherErreur("Veuillez remplir tous les champs obligatoires (nom, courriel, entreprise).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
      afficherErreur("Veuillez entrer une adresse courriel valide.");
      return;
    }

    var reservation = {
      nom: nom,
      courriel: courriel,
      entreprise: entreprise,
      date: dateChoisie,
      heure: heureChoisie,
      message: message,
      statut: "En attente",
      creeLe: new Date().toISOString()
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Réservation en cours…";

    // 1) Enregistrement local (le créneau devient indisponible sur cet appareil)
    var liste = lireReservations();
    liste.push(reservation);
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(liste)); } catch (err) { /* stockage plein ou bloqué */ }

    // 2) Notification courriel à Automvia (FormSubmit)
    var p = heureChoisie.split(":");
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        _subject: "Nouvelle réservation Automvia — " + nom,
        _template: "table",
        _captcha: "false",
        Nom: nom,
        Courriel: courriel,
        Entreprise: entreprise,
        Date: dateLisible(dateChoisie),
        Heure: formatHeure(+p[0], +p[1]),
        Message: message || "(aucun)",
        Statut: "En attente"
      })
    }).catch(function () {
      /* Même si l'envoi échoue (hors ligne, bloqueur), la réservation
         locale est conservée — on ne bloque pas le client. */
    }).finally(function () {
      afficherConfirmation(reservation);
    });
  });

  function afficherErreur(texte) {
    formError.textContent = texte;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function afficherConfirmation(r) {
    var p = r.heure.split(":");
    confirmDetails.textContent = r.nom + " — " + dateLisible(r.date) + " à " +
      formatHeure(+p[0], +p[1]) + " (30 minutes)";
    bookingEl.hidden = true;
    confirmEl.hidden = false;
    confirmEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("newBookingBtn").addEventListener("click", function () {
    dateChoisie = null;
    heureChoisie = null;
    form.reset();
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmer ma réservation";
    majResume();
    rendreCalendrier();
    rendreCreneaux();
    confirmEl.hidden = true;
    bookingEl.hidden = false;
    bookingEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // --- Barre de navigation flottante + projecteurs ---
  var navShell = $("navShell");
  var spotlights = $("spotlights");
  var burger = $("navBurger"), navLinks = $("navLinks");

  function majNav() {
    navShell.classList.toggle("scrolled", window.scrollY > 50);
    // Les projecteurs s'effacent en descendant, reviennent en remontant
    if (spotlights) {
      var opacite = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.85));
      spotlights.style.opacity = opacite;
      spotlights.style.visibility = opacite === 0 ? "hidden" : "visible";
    }
  }
  window.addEventListener("scroll", majNav, { passive: true });
  majNav();

  burger.addEventListener("click", function () {
    var ouvert = navLinks.classList.toggle("open");
    navShell.classList.toggle("menu-open", ouvert);
    burger.setAttribute("aria-expanded", ouvert);
  });
  navLinks.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("open");
      navShell.classList.remove("menu-open");
      burger.setAttribute("aria-expanded", "false");
    }
  });

  // --- Services : onglets verticaux avec défilement automatique ---
  var vtabsRoot = $("vtabs");
  if (vtabsRoot) {
    var DUREE_AUTO = 5000;
    var onglets = Array.prototype.slice.call(vtabsRoot.querySelectorAll(".vtab"));
    var lames = Array.prototype.slice.call(vtabsRoot.querySelectorAll(".vtab-slide"));
    var galerie = $("vtabsGallery");
    var actifV = 0;
    var minuterie = null;

    function relancerBarre() {
      var barre = onglets[actifV].querySelector(".vtab-progress i");
      barre.style.animation = "none";
      void barre.offsetWidth; // force le redémarrage de l'animation
      barre.style.animation = "";
    }

    function activerService(index, dir) {
      if (index === actifV) return;
      var entrant = lames[index], sortant = lames[actifV];

      // La nouvelle image arrive du haut (suivant) ou du bas (précédent)
      entrant.style.transition = "none";
      entrant.style.transform = "translateY(" + (dir > 0 ? "-100%" : "100%") + ")";
      entrant.style.opacity = "0";
      void entrant.offsetWidth;
      entrant.style.transition = "";
      entrant.classList.add("active");
      entrant.style.transform = "";
      entrant.style.opacity = "";

      sortant.classList.remove("active");
      sortant.style.transform = "translateY(" + (dir > 0 ? "100%" : "-100%") + ")";
      sortant.style.opacity = "0";

      onglets[actifV].classList.remove("active");
      onglets[index].classList.add("active");
      actifV = index;
      relancerBarre();
      redemarrerAuto();
    }

    function serviceSuivant() { activerService((actifV + 1) % lames.length, 1); }
    function servicePrecedent() { activerService((actifV - 1 + lames.length) % lames.length, -1); }

    function redemarrerAuto() {
      clearInterval(minuterie);
      minuterie = setInterval(serviceSuivant, DUREE_AUTO);
    }

    onglets.forEach(function (o) {
      o.addEventListener("click", function () {
        var i = parseInt(o.getAttribute("data-index"), 10);
        activerService(i, i > actifV ? 1 : -1);
      });
    });
    $("vtabNext").addEventListener("click", function (e) { e.stopPropagation(); serviceSuivant(); });
    $("vtabPrev").addEventListener("click", function (e) { e.stopPropagation(); servicePrecedent(); });
    galerie.addEventListener("click", serviceSuivant);

    // Survol de la galerie : pause du défilement et de la barre
    galerie.addEventListener("mouseenter", function () {
      vtabsRoot.classList.add("paused");
      clearInterval(minuterie);
    });
    galerie.addEventListener("mouseleave", function () {
      vtabsRoot.classList.remove("paused");
      relancerBarre();
      redemarrerAuto();
    });

    redemarrerAuto();
  }

  // --- Init ---
  $("year").textContent = new Date().getFullYear();
  rendreCalendrier();
  rendreCreneaux();
})();

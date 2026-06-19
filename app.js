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
  var CODE_FORMSUBMIT = "f442e7459db0b0c3ff6eecdc413e92af";
  var COURRIEL_NOTIFICATION = "automvia@gmail.com";
  var ENDPOINT = "https://formsubmit.co/ajax/" + (CODE_FORMSUBMIT || COURRIEL_NOTIFICATION);
  // Ajout AUTOMATIQUE au Google Agenda d'Automvia (via Google Apps Script).
  // Collez ici l'URL « /exec » de votre script déployé. Tant que c'est vide,
  // un lien « Ajouter à l'agenda » est plutôt inclus dans le courriel de notification.
  var URL_AGENDA = "https://script.google.com/macros/s/AKfycbxPoKiCO0UQhkvlbZ96wpt6-MqjbUUR6qvKMM8W6ueScYvq5ur8Ee0aQAU90NzYgKODxA/exec";
  var HEURE_DEBUT = 9;      // 9 h
  var HEURE_FIN = 17;       // dernier créneau : 16 h 30
  var MOIS_MAX = 2;         // réservation jusqu'à 2 mois d'avance
  var DELAI_MIN_H = 24;     // réservation au moins 24 h à l'avance
  var DELAI_MODIF_MIN = 30; // délai (minutes) à respecter entre deux modifications
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
  var modeChangement = false; // true = mode « Changer ma réservation » (courriel + date seulement)

  // --- Éléments ---
  var $ = function (id) { return document.getElementById(id); };
  var calMonth = $("calMonth"), calDays = $("calDays");
  var calPrev = $("calPrev"), calNext = $("calNext");
  var slotsEl = $("slots"), slotsDate = $("slotsDate");
  var form = $("bookingForm"), formError = $("formError");
  var summary = $("bookingSummary"), submitBtn = $("submitBtn");
  var bookingEl = $("booking"), confirmEl = $("confirmation");
  var confirmDetails = $("confirmationDetails");
  var existingEl = $("bookingExisting");
  var changeBtn = $("changeBtn"), formTitre = $("formTitre"), changeHint = $("changeHint");
  var champNom = $("champNom"), champEntreprise = $("champEntreprise"), champMessage = $("champMessage");

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

  // Un créneau est « pris » s'il est occupé par une AUTRE réservation.
  // On ignore la réservation active de cet appareil (la plus récente) afin
  // que le client puisse resélectionner son propre créneau (= aucun changement).
  function creneauPris(date, heure) {
    var liste = lireReservations();
    var dernier = liste.length - 1;
    return liste.some(function (r, i) {
      return i !== dernier && r.date === date && r.heure === heure;
    });
  }

  // Date/heure exacte d'un créneau ("AAAA-MM-JJ" + "HH:MM").
  function dateHeure(cle, heure) {
    var p = cle.split("-");
    var t = heure.split(":");
    return new Date(+p[0], +p[1] - 1, +p[2], +t[0], +t[1], 0, 0);
  }

  // Limite minimale : un créneau doit être au moins DELAI_MIN_H à l'avance.
  function limiteMin() {
    return new Date(Date.now() + DELAI_MIN_H * 3600 * 1000);
  }

  // Lien « Ajouter à Google Agenda » (événement pré-rempli, 30 min, fuseau Québec).
  // Inclus dans le courriel de notification : Automvia clique pour l'ajouter à son agenda.
  function lienAgenda(r) {
    var jour = r.date.replace(/-/g, "");            // 2026-06-23 -> 20260623
    var t = r.heure.split(":");
    var debutMin = (+t[0]) * 60 + (+t[1]);
    var finMin = debutMin + 30;
    function hhmmss(min) {
      return String(Math.floor(min / 60)).padStart(2, "0") + String(min % 60).padStart(2, "0") + "00";
    }
    var titre = "Appel découverte — " + r.nom + " (" + r.entreprise + ")";
    var details = "Client : " + r.nom +
      "\nCourriel : " + r.courriel +
      "\nEntreprise : " + r.entreprise +
      (r.message ? "\nMessage : " + r.message : "");
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(titre) +
      "&dates=" + jour + "T" + hhmmss(debutMin) + "/" + jour + "T" + hhmmss(finMin) +
      "&ctz=America/Toronto" +
      "&details=" + encodeURIComponent(details);
  }

  // Retrouve la réservation existante d'un même courriel OU entreprise.
  // Retourne son index dans la liste, ou -1 s'il n'y en a pas.
  // Sert à DÉPLACER un rendez-vous (remplacement) au lieu de créer un doublon.
  function indexReservation(courriel, entreprise) {
    var c = courriel.trim().toLowerCase();
    var e = entreprise.trim().toLowerCase();
    var liste = lireReservations();
    for (var i = 0; i < liste.length; i++) {
      var r = liste[i];
      if ((r.courriel && r.courriel.trim().toLowerCase() === c) ||
        (r.entreprise && r.entreprise.trim().toLowerCase() === e)) {
        return i;
      }
    }
    return -1;
  }

  // Retrouve une réservation par courriel SEUL (mode « Changer ma réservation »).
  function indexParCourriel(courriel) {
    var c = courriel.trim().toLowerCase();
    var liste = lireReservations();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].courriel && liste[i].courriel.trim().toLowerCase() === c) {
        return i;
      }
    }
    return -1;
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

    var lim = limiteMin();
    var nbJours = new Date(annee, mois + 1, 0).getDate();
    for (var j = 1; j <= nbJours; j++) {
      var d = new Date(annee, mois, j);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = j;
      var weekend = d.getDay() === 0 || d.getDay() === 6;
      // Dernier créneau du jour (16 h 30) : si déjà sous la limite, jour complet indisponible.
      var dernierCreneau = new Date(annee, mois, j, HEURE_FIN - 1, 30);
      btn.disabled = weekend || d < aujourdhui || dernierCreneau < lim;
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

    var lim = limiteMin();
    for (var h = HEURE_DEBUT; h < HEURE_FIN; h++) {
      [0, 30].forEach(function (m) {
        var valeur = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = formatHeure(h, m);
        // Indisponible si déjà pris OU à moins de 24 h.
        btn.disabled = creneauPris(dateChoisie, valeur) || dateHeure(dateChoisie, valeur) < lim;
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

  // Bannière : rappelle au visiteur qu'il a déjà un rendez-vous (sur cet appareil)
  // et lui explique comment le déplacer sans créer de doublon.
  function majBanniereExistante() {
    if (!existingEl) return;
    var liste = lireReservations();
    if (!liste.length) { existingEl.hidden = true; return; }
    var r = liste[liste.length - 1]; // la plus récente
    var p = r.heure.split(":");
    existingEl.hidden = false;
    existingEl.innerHTML = "Vous avez déjà un rendez-vous le <strong>" +
      dateLisible(r.date) + " à " + formatHeure(+p[0], +p[1]) +
      "</strong>. Pour le déplacer, choisissez un nouveau créneau ci-dessous et confirmez avec le même courriel — aucun doublon ne sera créé.";
  }

  // --- Soumission ---
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.hidden = true;

    // Anti-pourriel : si le champ honeypot est rempli, c'est un robot.
    // On interrompt silencieusement, sans rien enregistrer ni envoyer.
    if ($("fSiteWeb") && $("fSiteWeb").value) { return; }

    var courriel = $("fCourriel").value.trim();

    // Validations communes aux deux modes : créneau + courriel + délai 24 h.
    if (!dateChoisie || !heureChoisie) {
      afficherErreur("Veuillez choisir une date et une heure avant de confirmer.");
      return;
    }
    if (!courriel || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
      afficherErreur("Veuillez entrer une adresse courriel valide.");
      return;
    }
    if (dateHeure(dateChoisie, heureChoisie) < limiteMin()) {
      afficherErreur("Les réservations doivent être faites au moins 24 h à l'avance. Veuillez choisir un créneau plus tardif.");
      heureChoisie = null;
      rendreCalendrier();
      rendreCreneaux();
      majResume();
      return;
    }

    var liste = lireReservations();

    // ===== Mode « Changer ma réservation » : courriel + nouvelle date seulement =====
    if (modeChangement) {
      var idxC = indexParCourriel(courriel);
      if (idxC === -1) {
        afficherErreur("Aucune réservation trouvée pour ce courriel sur cet appareil. Vérifiez l'adresse, ou faites une nouvelle réservation.");
        return;
      }
      var rdv = liste[idxC];
      // Aucun changement de créneau → aucun courriel.
      if (rdv.date === dateChoisie && rdv.heure === heureChoisie) {
        afficherConfirmation(rdv, true, true);
        return;
      }
      // Verrou anti-spam entre deux changements.
      if (rdv.modifieLe) {
        var restantC = DELAI_MODIF_MIN * 60000 - (Date.now() - new Date(rdv.modifieLe).getTime());
        if (restantC > 0) {
          afficherErreur("Vous avez déjà modifié ce rendez-vous récemment. Réessayez dans " +
            Math.ceil(restantC / 60000) + " min, ou écrivez-nous à automvia@gmail.com.");
          return;
        }
      }
      // On garde nom/entreprise/message d'origine, on met seulement la date à jour.
      var majRdv = {
        nom: rdv.nom, courriel: rdv.courriel, entreprise: rdv.entreprise,
        date: dateChoisie, heure: heureChoisie, message: rdv.message,
        statut: "Modifiée", creeLe: rdv.creeLe, modifieLe: new Date().toISOString()
      };
      envoyer(majRdv, true, liste, idxC);
      return;
    }

    // ===== Mode réservation normale : nom + entreprise requis en plus =====
    var nom = $("fNom").value.trim();
    var entreprise = $("fEntreprise").value.trim();
    var message = $("fMessage").value.trim();

    if (!nom || !entreprise) {
      afficherErreur("Veuillez remplir tous les champs obligatoires (nom, courriel, entreprise).");
      return;
    }

    // Réservation existante pour ce courriel/entreprise ? On DÉPLACE au lieu de doubler.
    var idx = indexReservation(courriel, entreprise);
    var estModif = idx !== -1;

    if (estModif) {
      var existante = liste[idx];
      // Aucun changement de créneau → AUCUN courriel n'est envoyé.
      if (existante.date === dateChoisie && existante.heure === heureChoisie) {
        afficherConfirmation(existante, true, true);
        return;
      }
      // Verrou anti-spam : un délai doit s'écouler entre deux vrais changements.
      if (existante.modifieLe) {
        var restantMs = DELAI_MODIF_MIN * 60000 - (Date.now() - new Date(existante.modifieLe).getTime());
        if (restantMs > 0) {
          afficherErreur("Vous avez déjà modifié ce rendez-vous récemment. Réessayez dans " +
            Math.ceil(restantMs / 60000) + " min, ou écrivez-nous à automvia@gmail.com.");
          return;
        }
      }
    }

    var reservation = {
      nom: nom,
      courriel: courriel,
      entreprise: entreprise,
      date: dateChoisie,
      heure: heureChoisie,
      message: message,
      statut: estModif ? "Modifiée" : "En attente",
      creeLe: estModif ? liste[idx].creeLe : new Date().toISOString(),
      modifieLe: estModif ? new Date().toISOString() : null
    };

    envoyer(reservation, estModif, liste, estModif ? idx : -1);
  });

  // Enregistre la réservation (remplacement si idx ≥ 0, sinon ajout), envoie le
  // courriel à Automvia + la confirmation automatique au client, puis affiche l'écran.
  function envoyer(reservation, estModif, liste, idx) {
    submitBtn.disabled = true;
    submitBtn.textContent = estModif ? "Mise à jour en cours…" : "Réservation en cours…";

    // On garde l'ancienne réservation (pour mettre à jour l'agenda) avant de la remplacer.
    var ancienne = (idx >= 0) ? liste[idx] : null;
    if (idx >= 0) { liste[idx] = reservation; } else { liste.push(reservation); }
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(liste)); } catch (err) { /* stockage plein ou bloqué */ }

    var p = reservation.heure.split(":");
    var quand = dateLisible(reservation.date) + " à " + formatHeure(+p[0], +p[1]);

    // 1) Ajout/MISE À JOUR automatique dans le Google Agenda d'Automvia (si configuré).
    if (URL_AGENDA) {
      var charge = {
        action: estModif ? "update" : "create",
        nom: reservation.nom,
        courriel: reservation.courriel,
        entreprise: reservation.entreprise,
        message: reservation.message || "",
        date: reservation.date,
        heure: reservation.heure
      };
      if (estModif && ancienne) {
        charge.ancienneDate = ancienne.date;
        charge.ancienneHeure = ancienne.heure;
      }
      // mode "no-cors" : requête simple, pas de préflight ; on ignore la réponse.
      fetch(URL_AGENDA, { method: "POST", mode: "no-cors", body: JSON.stringify(charge) }).catch(function () { });
    }

    // 2) Notification courriel à Automvia + confirmation automatique au client (FormSubmit).
    var corps = {
      _subject: (estModif ? "Réservation MISE À JOUR" : "Nouvelle réservation") + " Automvia — " + reservation.nom,
      _template: "table",
      _captcha: "false",
      _replyto: reservation.courriel,
      _autoresponse: estModif
        ? "Bonjour,\n\nVotre réservation Automvia a bien été mise à jour. Votre nouvelle date : " + quand + ".\n\n" +
          "Nous vous contacterons sous peu pour confirmer les détails. Si vous devez la modifier de nouveau ou l'annuler, répondez simplement à ce courriel.\n\n" +
          "Merci!\n— L'équipe Automvia"
        : "Bonjour,\n\nMerci d'avoir choisi Automvia! Nous avons bien reçu votre réservation d'appel découverte le " + quand + ".\n\n" +
          "Nous avons hâte de vous rencontrer pour en discuter. Si vous devez modifier ou annuler, répondez simplement à ce courriel.\n\n" +
          "— L'équipe Automvia",
      Nom: reservation.nom,
      Courriel: reservation.courriel,
      Entreprise: reservation.entreprise,
      Date: dateLisible(reservation.date),
      Heure: formatHeure(+p[0], +p[1]),
      Message: reservation.message || "(aucun)",
      Statut: estModif ? "Modifiée" : "En attente"
    };
    // Lien manuel d'agenda SEULEMENT si l'ajout automatique n'est pas configuré
    // (évite des doublons si Automvia cliquait le lien alors que l'auto est actif).
    if (!URL_AGENDA) {
      corps["Ajouter a Google Agenda"] = lienAgenda(reservation);
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(corps)
    }).catch(function () {
      /* Même si l'envoi échoue (hors ligne, bloqueur), la réservation
         locale est conservée — on ne bloque pas le client. */
    }).finally(function () {
      afficherConfirmation(reservation, estModif);
    });
  }

  function afficherErreur(texte) {
    formError.textContent = texte;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function afficherConfirmation(r, estModif, inchange) {
    var p = r.heure.split(":");
    var titre = confirmEl.querySelector("h3");
    if (titre) {
      titre.textContent = inchange
        ? "Votre rendez-vous est inchangé."
        : (estModif ? "C'est fait! Votre rendez-vous a été déplacé." : "Merci! Votre appel est réservé.");
    }
    confirmDetails.textContent = r.nom + " — " + dateLisible(r.date) + " à " +
      formatHeure(+p[0], +p[1]) + " (30 minutes)";
    var mailNote = $("confirmationMail");
    if (mailNote) {
      mailNote.textContent = inchange
        ? "Aucun changement : aucun nouveau courriel n'a été envoyé."
        : "Vous recevrez une confirmation par courriel.";
    }
    bookingEl.hidden = true;
    confirmEl.hidden = false;
    confirmEl.scrollIntoView({ behavior: "smooth", block: "center" });
    majBanniereExistante();
  }

  // --- Mode « Changer ma réservation » (courriel + nouvelle date seulement) ---
  function afficherChamp(el, montrer) {
    if (el) el.style.display = montrer ? "" : "none";
  }

  function entrerModeChangement() {
    modeChangement = true;
    formError.hidden = true;
    afficherChamp(champNom, false);
    afficherChamp(champEntreprise, false);
    afficherChamp(champMessage, false);
    if (changeHint) changeHint.hidden = false;
    if (formTitre) formTitre.textContent = "Changer ma réservation";
    submitBtn.textContent = "Mettre à jour ma réservation";
    changeBtn.textContent = "Annuler";
  }

  function sortirModeChangement() {
    modeChangement = false;
    afficherChamp(champNom, true);
    afficherChamp(champEntreprise, true);
    afficherChamp(champMessage, true);
    if (changeHint) changeHint.hidden = true;
    if (formTitre) formTitre.textContent = "3. Vos coordonnées";
    submitBtn.textContent = "Confirmer ma réservation";
    changeBtn.textContent = "Changer ma réservation";
  }

  changeBtn.addEventListener("click", function () {
    formError.hidden = true;
    if (modeChangement) { sortirModeChangement(); }
    else { entrerModeChangement(); }
  });

  $("newBookingBtn").addEventListener("click", function () {
    dateChoisie = null;
    heureChoisie = null;
    form.reset();
    submitBtn.disabled = false;
    sortirModeChangement();
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
  majBanniereExistante();
})();

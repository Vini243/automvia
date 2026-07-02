/* ===== Automvia — couche d'effets et d'interactions =====
   Tout ce qui est visuel ou interactif MAIS sans lien avec la
   réservation (app.js reste isolé : si l'un tombe en erreur,
   l'autre continue de fonctionner).

   Modules : intro, barre de progression, révélations, compteurs,
   scroll-spy, calculatrice d'heures perdues, FAQ, CTA mobile,
   curseur lumineux. Tout respecte prefers-reduced-motion. */

(function () {
  "use strict";

  // Active le rendu « JS dispo » (les révélations restent visibles si JS échoue).
  document.documentElement.classList.add("js");

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var souris = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var mobile = window.matchMedia("(max-width: 840px)");

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------- Formats de nombres (fr-CA) ---------- */
  function fmtInt(n) {
    var v = Math.round(n);
    var neg = v < 0 ? "-" : "";
    return neg + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  function fmt1(n) {
    var v = Math.round(n * 10) / 10;
    var i = Math.floor(v);
    var d = Math.round((v - i) * 10);
    return fmtInt(i) + "," + d;
  }

  /* ---------- 1. Intro : wordmark qui se fond (une fois par session) ---------- */
  var intro = document.getElementById("introOverlay");
  if (intro) {
    var dejaVu = false;
    try { dejaVu = !!sessionStorage.getItem("amvIntroSeen"); } catch (e) { }
    if (!reduit && !dejaVu) {
      intro.hidden = false;
      setTimeout(function () { intro.classList.add("fade"); }, 340);
      setTimeout(function () {
        intro.hidden = true;
        try { sessionStorage.setItem("amvIntroSeen", "1"); } catch (e) { }
      }, 640);
    }
  }

  /* ---------- 2. Barre de progression de lecture ---------- */
  var barre = document.getElementById("scrollProgress");
  if (barre) {
    var majBarre = function () {
      var d = document.documentElement;
      var max = d.scrollHeight - d.clientHeight;
      var p = max > 0 ? d.scrollTop / max : 0;
      barre.style.transform = "scaleX(" + p.toFixed(4) + ")";
    };
    window.addEventListener("scroll", majBarre, { passive: true });
    window.addEventListener("resize", majBarre);
    majBarre();
  }

  /* ---------- 3. Révélations au défilement ---------- */
  var aReveler = $$(".reveal, .reveal-stagger");
  if (aReveler.length) {
    if (reduit || !("IntersectionObserver" in window)) {
      aReveler.forEach(function (el) { el.classList.add("in"); });
    } else {
      var obsReveal = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obsReveal.unobserve(e.target);
          }
        });
      }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
      aReveler.forEach(function (el) { obsReveal.observe(el); });
    }
  }

  /* ---------- 4. Compteurs animés (data-count-from / data-count-to) ---------- */
  var compteurs = $$("[data-count-to]");
  if (compteurs.length) {
    var animerCompteur = function (el) {
      var cible = parseFloat(el.getAttribute("data-count-to")) || 0;
      var depart = parseFloat(el.getAttribute("data-count-from") || "0");
      var suffixe = el.getAttribute("data-count-suffix") || "";
      if (reduit) { el.textContent = fmtInt(cible) + suffixe; return; }
      var debut = null, duree = 1300;
      var pas = function (t) {
        if (debut === null) debut = t;
        var prog = Math.min((t - debut) / duree, 1);
        var adouci = 1 - Math.pow(1 - prog, 3);
        el.textContent = fmtInt(depart + (cible - depart) * adouci) + suffixe;
        if (prog < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    };
    if (!("IntersectionObserver" in window)) {
      compteurs.forEach(animerCompteur);
    } else {
      var obsCompteur = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) {
            animerCompteur(e.target);
            obsCompteur.unobserve(e.target);
          }
        });
      }, { threshold: 0.6 });
      compteurs.forEach(function (el) { obsCompteur.observe(el); });
    }
  }

  /* ---------- 5. Lien de navigation actif (scroll-spy) ---------- */
  var liensNav = $$(".nav-links a");
  if (liensNav.length && "IntersectionObserver" in window) {
    var parId = {};
    liensNav.forEach(function (a) {
      var id = (a.getAttribute("href") || "").replace("#", "");
      if (id) parId[id] = a;
    });
    var sectionsNav = Object.keys(parId)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    var obsNav = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) {
          liensNav.forEach(function (a) { a.classList.remove("active"); });
          var lien = parId[e.target.id];
          if (lien) lien.classList.add("active");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sectionsNav.forEach(function (s) { obsNav.observe(s); });
  }

  /* ---------- 6. Calculatrice d'heures perdues ----------
     Hypothèses : 8 min de coordination par rendez-vous, 47 semaines
     et 249 jours ouvrables par année. Aucune donnée n'est envoyée. */
  var calcRoot = document.getElementById("calculatrice");
  if (calcRoot) {
    var MIN_PAR_RDV = 8, SEMAINES = 47, JOURS = 249;
    var TAUX_MIN = 25, TAUX_MAX = 150, TAUX_PAS = 5;
    var etat = { rdv: 12, mails: 15, minMail: 6, taux: 45 };
    var affiche = { y: 0, m: 0, cash: 0 };
    var rafs = {};

    var el = {
      rdv: $("#calcRdv"), rdvVal: $("#calcRdvVal"), rdvFill: $("#calcRdvFill"),
      mails: $("#calcMails"), mailsVal: $("#calcMailsVal"), mailsFill: $("#calcMailsFill"),
      min: $("#calcMin"), minVal: $("#calcMinVal"), minFill: $("#calcMinFill"),
      rateUp: $("#calcRateUp"), rateDown: $("#calcRateDown"),
      rateVal: $("#calcRateVal"), rateEcho: $("#calcRateEcho"),
      yd: $("#calcYd"), md: $("#calcMd"), cashd: $("#calcCashd"),
      phraseBig: $("#calcPhraseBig"), phraseSmall: $("#calcPhraseSmall"),
      concY: $("#calcConcY")
    };

    var cibles = function () {
      var yMin = etat.rdv * MIN_PAR_RDV * SEMAINES + etat.mails * etat.minMail * JOURS;
      var yH = yMin / 60;
      return { y: yH, m: yH / 12, cash: yH * etat.taux };
    };

    var peindre = function () {
      if (el.yd) el.yd.textContent = fmtInt(affiche.y);
      if (el.md) el.md.textContent = fmt1(affiche.m);
      if (el.cashd) el.cashd.textContent = fmtInt(affiche.cash);
    };

    var majPhrase = function () {
      var tg = cibles();
      var grand = tg.y >= 25;
      if (el.phraseBig) el.phraseBig.hidden = !grand;
      if (el.phraseSmall) el.phraseSmall.hidden = grand;
      if (el.concY) el.concY.textContent = fmtInt(tg.y) + " heures par année";
    };

    var tween = function (cle, vers, duree) {
      if (rafs[cle]) cancelAnimationFrame(rafs[cle]);
      if (reduit || !duree) { affiche[cle] = vers; peindre(); return; }
      var de = affiche[cle] || 0;
      var t0 = performance.now();
      var pas = function (t) {
        var p = Math.min(1, (t - t0) / duree);
        var e = 1 - Math.pow(1 - p, 3);
        affiche[cle] = de + (vers - de) * e;
        peindre();
        if (p < 1) rafs[cle] = requestAnimationFrame(pas);
      };
      rafs[cle] = requestAnimationFrame(pas);
    };

    var recalculer = function (duree) {
      var tg = cibles();
      tween("y", tg.y, duree);
      tween("m", tg.m, duree);
      tween("cash", tg.cash, duree);
      majPhrase();
    };

    var majCurseurs = function () {
      if (el.rdvVal) el.rdvVal.textContent = etat.rdv;
      if (el.mailsVal) el.mailsVal.textContent = etat.mails;
      if (el.minVal) el.minVal.textContent = etat.minMail;
      if (el.rdvFill) el.rdvFill.style.width = (etat.rdv / 60 * 100).toFixed(1) + "%";
      if (el.mailsFill) el.mailsFill.style.width = (etat.mails / 60 * 100).toFixed(1) + "%";
      if (el.minFill) el.minFill.style.width = ((etat.minMail - 1) / 19 * 100).toFixed(1) + "%";
      if (el.rateVal) el.rateVal.textContent = etat.taux + " $ / h";
      if (el.rateEcho) el.rateEcho.textContent = etat.taux;
    };

    var brancher = function (input, cle) {
      if (!input) return;
      input.addEventListener("input", function () {
        etat[cle] = parseInt(input.value, 10) || 0;
        majCurseurs();
        recalculer(360);
      });
    };
    brancher(el.rdv, "rdv");
    brancher(el.mails, "mails");
    brancher(el.min, "minMail");

    if (el.rateUp) el.rateUp.addEventListener("click", function () {
      etat.taux = Math.min(TAUX_MAX, etat.taux + TAUX_PAS);
      majCurseurs(); recalculer(360);
    });
    if (el.rateDown) el.rateDown.addEventListener("click", function () {
      etat.taux = Math.max(TAUX_MIN, etat.taux - TAUX_PAS);
      majCurseurs(); recalculer(360);
    });

    majCurseurs();
    majPhrase();

    // Première animation quand la section devient visible.
    if (reduit || !("IntersectionObserver" in window)) {
      recalculer(0);
    } else {
      var obsCalc = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) {
            recalculer(1150);
            obsCalc.unobserve(e.target);
          }
        });
      }, { threshold: 0.25 });
      obsCalc.observe(calcRoot);
    }
  }

  /* ---------- 7. FAQ : questions à gauche, réponse à droite ---------- */
  var faqList = document.getElementById("faqList");
  var faqPane = document.getElementById("faqPane");
  if (faqList && faqPane) {
    var boutons = $$(".faq-btn", faqList);
    var reponses = $$(".faq-answer", faqPane);
    var faqActive = 0;
    boutons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-faq"), 10);
        if (i === faqActive) return;
        boutons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var montrer = function () {
          reponses.forEach(function (r) {
            var visible = parseInt(r.getAttribute("data-faq"), 10) === i;
            r.hidden = !visible;
            if (visible && !reduit) {
              r.classList.add("out");
              void r.offsetWidth;
              r.classList.remove("out");
            }
          });
        };
        faqActive = i;
        montrer();
      });
    });
  }

  /* ---------- 8. CTA collant (mobile, après un écran de défilement) ---------- */
  var sticky = document.getElementById("stickyCta");
  var zoneReserver = document.getElementById("reserver");
  if (sticky) {
    var reserverVisible = false;
    if (zoneReserver && "IntersectionObserver" in window) {
      var obsSticky = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) { reserverVisible = e.isIntersecting; majSticky(); });
      }, { threshold: 0.04 });
      obsSticky.observe(zoneReserver);
    }
    var majSticky = function () {
      var montrer = mobile.matches &&
        window.scrollY > window.innerHeight * 0.55 &&
        !reserverVisible;
      sticky.hidden = !montrer;
    };
    window.addEventListener("scroll", majSticky, { passive: true });
    window.addEventListener("resize", majSticky);
    if (mobile.addEventListener) mobile.addEventListener("change", majSticky);
    majSticky();
  }

  /* ===== Effets « souris » : pointeur fin + mouvement autorisé ===== */
  if (souris && !reduit) {

    /* ---------- 9. Curseur lumineux ---------- */
    var dot = document.getElementById("cursorDot");
    var anneau = document.getElementById("cursorRing");
    if (dot && anneau) {
      document.body.classList.add("cursor-on");
      var ax = window.innerWidth / 2, ay = window.innerHeight / 2;
      var cx = ax, cy = ay;
      window.addEventListener("mousemove", function (e) {
        cx = e.clientX; cy = e.clientY;
        dot.style.transform = "translate(" + cx + "px," + cy + "px) translate(-50%,-50%)";
      }, { passive: true });
      var suivre = function () {
        ax += (cx - ax) * 0.18;
        ay += (cy - ay) * 0.18;
        anneau.style.transform = "translate(" + ax + "px," + ay + "px) translate(-50%,-50%)";
        requestAnimationFrame(suivre);
      };
      requestAnimationFrame(suivre);

      var interactifs = "a, button, input, textarea, select, .faq-btn, .how-card, .mock";
      document.addEventListener("mouseover", function (e) {
        if (e.target.closest && e.target.closest(interactifs)) anneau.classList.add("hovering");
      });
      document.addEventListener("mouseout", function (e) {
        if (e.target.closest && e.target.closest(interactifs)) anneau.classList.remove("hovering");
      });
      document.addEventListener("mousedown", function () { anneau.classList.add("clic"); });
      document.addEventListener("mouseup", function () { anneau.classList.remove("clic"); });

      // Dans les zones de formulaire (calculatrice, réservation), on rend la
      // main au curseur natif : plus pratique pour manipuler curseurs et champs.
      if (zoneReserver) {
        var majZoneCurseur = function () {
          var entre = zoneReserver.getBoundingClientRect().top < window.innerHeight * 0.5;
          document.body.classList.toggle("cursor-calme", entre);
        };
        window.addEventListener("scroll", majZoneCurseur, { passive: true });
        window.addEventListener("resize", majZoneCurseur);
        majZoneCurseur();
      }
    }
  }
})();

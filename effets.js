/* ===== Automvia — couche d'effets premium =====
   Effets purement visuels et interactifs, AUCUNE logique de
   réservation ici (volontairement isolé d'app.js : si app.js
   tombe en erreur, ces effets continuent de fonctionner, et
   inversement).

   Modules : barre de progression, révélations au défilement,
   compteurs animés, curseur lumineux, lueur + parallaxe du hero,
   boutons magnétiques, cartes 3D. Tout respecte
   prefers-reduced-motion et se désactive sur écran tactile. */

(function () {
  "use strict";

  // Active le rendu « JS dispo » (les révélations restent visibles si JS échoue).
  document.documentElement.classList.add("js");

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var souris = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------- 1. Barre de progression de lecture ---------- */
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

  /* ---------- 2. Révélations au défilement ---------- */
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
      }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
      aReveler.forEach(function (el) { obsReveal.observe(el); });
    }
  }

  /* ---------- 3. Compteurs animés ---------- */
  var compteurs = $$("[data-count]");
  if (compteurs.length) {
    var animerCompteur = function (el) {
      var cible = parseFloat(el.getAttribute("data-count")) || 0;
      var suffixe = el.getAttribute("data-suffix") || "";
      if (reduit) { el.textContent = cible + suffixe; return; }
      var debut = null, duree = 1400;
      var pas = function (t) {
        if (debut === null) debut = t;
        var prog = Math.min((t - debut) / duree, 1);
        var adouci = 1 - Math.pow(1 - prog, 3); // ease-out cubique
        el.textContent = Math.round(cible * adouci) + suffixe;
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

  /* ---------- 3b. Bandeau d'intégrations : boucle fluide sans trou ----------
     Le HTML ne contient que les 4 outils. On les duplique ici autant de fois
     que nécessaire pour couvrir l'écran, puis on copie l'ensemble une fois
     pour que la translation -50 % reboucle sans laisser de vide. */
  var piste = document.querySelector(".marquee-track");
  if (piste && piste.children.length) {
    var modeles = Array.prototype.slice.call(piste.children);
    var ajouterSerie = function () {
      modeles.forEach(function (item) {
        var copie = item.cloneNode(true);
        copie.setAttribute("aria-hidden", "true");
        piste.appendChild(copie);
      });
    };
    var cible = Math.max(window.innerWidth, document.documentElement.clientWidth || 0) * 1.15;
    var garde = 0;
    while (piste.scrollWidth < cible && garde < 40) { ajouterSerie(); garde++; }
    // Copie de l'ensemble obtenu pour la boucle continue.
    Array.prototype.slice.call(piste.children).forEach(function (item) {
      var copie = item.cloneNode(true);
      copie.setAttribute("aria-hidden", "true");
      piste.appendChild(copie);
    });
  }

  /* ---------- 3c. Lien de navigation actif (scroll-spy) ----------
     Souligne le lien de la section actuellement visible. Purement
     visuel : la navigation fonctionne pareil si ce bloc échoue. */
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

  /* ===== Effets « gourmands » : souris fine + mouvement autorisé ===== */
  if (souris && !reduit) {

    /* ---------- 4. Curseur lumineux ---------- */
    var dot = document.getElementById("cursorDot");
    var anneau = document.getElementById("cursorRing");
    if (dot && anneau) {
      document.body.classList.add("cursor-on");
      var ax = window.innerWidth / 2, ay = window.innerHeight / 2; // position lissée de l'anneau
      var cx = ax, cy = ay;                                        // cible (souris)
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

      var interactifs = "a, button, input, textarea, select, .vtab, .process-row, .vtabs-gallery";
      document.addEventListener("mouseover", function (e) {
        if (e.target.closest && e.target.closest(interactifs)) anneau.classList.add("hovering");
      });
      document.addEventListener("mouseout", function (e) {
        if (e.target.closest && e.target.closest(interactifs)) anneau.classList.remove("hovering");
      });
      document.addEventListener("mousedown", function () { anneau.classList.add("clic"); });
      document.addEventListener("mouseup", function () { anneau.classList.remove("clic"); });

      // Une fois rendu à la section « Réserver » (et plus bas), on rend la main
      // au curseur natif : le suivi lumineux bleu se désactive pour faciliter
      // le remplissage du formulaire de réservation.
      var zoneReservation = document.getElementById("reserver");
      if (zoneReservation) {
        var majZoneCurseur = function () {
          var entre = zoneReservation.getBoundingClientRect().top < window.innerHeight * 0.5;
          document.body.classList.toggle("cursor-calme", entre);
        };
        window.addEventListener("scroll", majZoneCurseur, { passive: true });
        window.addEventListener("resize", majZoneCurseur);
        majZoneCurseur();
      }
    }

    /* ---------- 5. Lueur interactive + parallaxe du hero ---------- */
    var hero = document.getElementById("accueil");
    var lueur = document.getElementById("heroGlow");
    var heroInner = hero ? $(".container", hero) : null;
    if (hero) {
      hero.addEventListener("mousemove", function (e) {
        var r = hero.getBoundingClientRect();
        var mx = (e.clientX - r.left) / r.width;
        var my = (e.clientY - r.top) / r.height;
        if (lueur) {
          lueur.style.setProperty("--mx", (mx * 100).toFixed(1) + "%");
          lueur.style.setProperty("--my", (my * 100).toFixed(1) + "%");
        }
        if (heroInner) {
          heroInner.style.transform =
            "translate(" + ((mx - 0.5) * 14).toFixed(1) + "px," + ((my - 0.5) * 10).toFixed(1) + "px)";
        }
      });
      hero.addEventListener("mouseleave", function () {
        if (heroInner) heroInner.style.transform = "";
      });
    }

    /* ---------- 6. Boutons magnétiques ---------- */
    // On déplace l'élément vers le curseur. Pour le bouton « encadré » du hero,
    // on bouge le cadre entier plutôt que le lien à l'intérieur.
    var cadres = $$(".btn-frame");
    var boutonsSeuls = $$(".btn").filter(function (b) { return !b.closest(".btn-frame"); });
    cadres.concat(boutonsSeuls).forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        el.style.transform = "translate(" + (x * 0.25).toFixed(1) + "px," + (y * 0.4).toFixed(1) + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });

    /* ---------- 7. Cartes 3D (étapes) ---------- */
    $$("[data-tilt]").forEach(function (carte) {
      carte.addEventListener("mousemove", function (e) {
        var r = carte.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        carte.style.transform =
          "perspective(800px) rotateX(" + (-py * 6).toFixed(2) + "deg) rotateY(" +
          (px * 8).toFixed(2) + "deg) translateY(-6px)";
      });
      carte.addEventListener("mouseleave", function () { carte.style.transform = ""; });
    });
  }
})();

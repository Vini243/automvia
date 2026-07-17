// Pixel Meta (Facebook) — Automvia. ID du dataset : 1457090043127666.
// Externalisé dans ce fichier pour rester compatible avec la CSP (script-src 'self'),
// sans avoir besoin d'autoriser 'unsafe-inline'. Le script charge fbevents.js depuis
// connect.facebook.net (autorisé dans la CSP) et suit une vue de page.
!function (f, b, e, v, n, t, s) {
  if (f.fbq) return; n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
  n.queue = []; t = b.createElement(e); t.async = !0;
  t.src = v; s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
}(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '1457090043127666');
fbq('track', 'PageView');

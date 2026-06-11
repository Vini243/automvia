# Automvia — site vitrine

Site one-page pour **Automvia**, agence d'automatisation pour PME au Québec.
Hébergé gratuitement sur **GitHub Pages** (site statique : HTML, CSS, JavaScript — aucun cadriciel, aucune dépendance).

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Contenu du site (4 sections : Accueil, Services, Comment ça marche, Réserver) |
| `styles.css` | Style minimaliste — fond clair, accent bleu profond, responsive mobile |
| `app.js` | Calendrier, créneaux de 30 min, formulaire et envoi des réservations |

## Comment fonctionnent les réservations

GitHub Pages n'a pas de base de données. Chaque réservation est donc :

1. **Envoyée par courriel** à `felixlavigueur10@gmail.com` via [FormSubmit](https://formsubmit.co)
   (gratuit, sans compte). ⚠️ **À la toute première réservation**, FormSubmit envoie un
   courriel d'activation à cette adresse — il faut cliquer le lien une seule fois pour
   activer les envois.
2. **Conservée dans le navigateur** du visiteur (`localStorage`) pour bloquer le créneau
   sur son appareil.

Pour changer l'adresse de réception : modifier `COURRIEL_NOTIFICATION` au début de `app.js`.

Pour une vraie base de données partagée (créneaux bloqués pour tous les visiteurs),
brancher plus tard un service comme Supabase, Airtable ou Calendly.

## Modifier le site

1. Éditer les fichiers, puis :
2. `git add . && git commit -m "..." && git push`
3. GitHub Pages republie automatiquement en ~1 minute.

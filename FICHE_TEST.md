# Fiche de test — ApexAI

Checklist de test manuel de bout en bout. Cocher chaque case après vérification.
Prérequis : `front/` (3000), `back/` (3001) et `llm/` (8007) lancés, `.env` configurés, tables `job_offers` et colonnes `chat_sessions.title` / `student_profiles.phone,linkedin,portfolio` créées en base.

## 1. Authentification

- [ ] Créer un compte (`/inscription`) → redirection vers le chat, session active
- [ ] Se déconnecter puis se reconnecter (`/connexion`) → session restaurée
- [ ] Rafraîchir la page après connexion → toujours connecté (pas de redirection vers `/connexion`)

## 2. Upload de CV

- [ ] Sur la page d'accueil du chat (`/chat`), cliquer sur le trombone → sélectionner un PDF → chip "CV : nom_du_fichier" affiché
- [ ] Sur une conversation existante (`/chat/c/[id]`), même test
- [ ] Uploader un fichier `.txt` → accepté
- [ ] Uploader un format non supporté (ex. `.docx`) → message d'erreur clair, pas de crash
- [ ] Vérifier sur `/chat/profil` que "CV importé" apparaît avec une date de mise à jour

## 3. Offres d'emploi (`/chat/offres-emploi`)

- [ ] Publier une offre (titre, entreprise, type de contrat, lieu, pays, description) → apparaît dans la liste
- [ ] Se connecter avec un **autre compte** → l'offre est visible, **aucune icône de suppression** dessus
- [ ] Avec le compte propriétaire → icône de suppression visible et fonctionnelle
- [ ] Tenter de supprimer l'offre d'un autre utilisateur via l'API directement (devrait renvoyer 403) — test technique, optionnel en QA manuelle
- [ ] Cliquer "Postuler" sur une offre → nouvelle conversation créée, message d'ouverture cohérent avec l'offre

## 4. Matching CV / offre dans le chat

- [ ] Taper "je cherche un stage en data" (ou similaire) dans le chat → bannière de statut "Apex consulte les offres publiées…" → l'assistant présente des offres **réelles** (pas inventées) issues du catalogue
- [ ] Taper une demande vague sans offre précise → l'assistant ne doit **jamais** citer une entreprise/offre qui n'existe pas dans le catalogue
- [ ] Cliquer "Postuler" sur une offre → bannière "Apex compare ton profil à l'offre…" → score, forces, lacunes affichés dans la conversation
- [ ] Vérifier que le texte de l'assistant ne contient **aucun JSON brut** ni nom de fonction technique (`list_job_offers`, `match_cv_to_offer`, etc.)

## 5. Informations manquantes avant génération

- [ ] Avec un CV qui n'a **ni téléphone ni email**, lancer un matching → l'assistant doit **demander** ces informations avant de proposer les documents comme prêts
- [ ] Répondre avec un téléphone/email dans le message suivant → l'assistant régénère et les documents téléchargeables incluent bien ces informations

## 6. Téléchargement CV / lettre de motivation

- [ ] Après un matching réussi, cliquer "Télécharger CV (FR)" → PDF téléchargé, s'ouvre correctement, contenu cohérent avec le vrai CV
- [ ] Cliquer "Download CV (EN)" → PDF en anglais, reformulé naturellement (pas une traduction mot à mot)
- [ ] Cliquer "Lettre de motivation (FR)" → PDF téléchargé, personnalisé (mentionne la vraie entreprise/poste, faits réels du CV)
- [ ] Cliquer "Cover Letter (EN)" → idem en anglais
- [ ] Ouvrir les PDF et vérifier : accents corrects, aucun caractère cassé (`&`, `%`, `#`, `_`), mise en page professionnelle, date en français sur la version FR

## 7. Interruption de la réponse (bouton stop)

- [ ] Envoyer un message qui génère une longue réponse → pendant la génération, le bouton d'envoi devient un bouton stop (rouge, carré)
- [ ] Cliquer sur le bouton stop → la génération s'arrête immédiatement
- [ ] Le texte déjà généré au moment de l'arrêt reste affiché dans la conversation (n'est pas perdu, pas de message d'erreur rouge)
- [ ] Rafraîchir la page → le message partiel est toujours là (bien sauvegardé en base)

## 8. Titre des conversations récentes (sidebar)

- [ ] Démarrer une nouvelle conversation, envoyer un premier message → le titre dans la sidebar "RÉCENTS" se met à jour automatiquement (sans recharger la page) avec les premiers mots du message, pas `chat_xxxxxxxx`

## 9. Page Profil (`/chat/profil`)

- [ ] Section "Coordonnées" : email, téléphone, LinkedIn, portfolio affichés (ou "—" si vide)
- [ ] Aller sur "Paramètres", renseigner téléphone/LinkedIn/portfolio + rôle/secteur/pays ciblés → Enregistrer
- [ ] Revenir sur "Profil" → les nouvelles infos apparaissent
- [ ] **Vérifier que le CV importé n'a pas été écrasé** après avoir sauvegardé les paramètres (régression critique corrigée cette session)
- [ ] Section "Mes offres publiées" : liste les offres créées par ce compte, suppression fonctionnelle
- [ ] Section "Compétences détectées" : visible en local (`npm run dev`), **absente** sur le déploiement de prod

## 10. Éléments masqués en production

- [ ] En local (`NODE_ENV=development`) : l'item "Progression" et la suggestion "Mon plan 6 mois" sont visibles
- [ ] Sur le déploiement (prod) : les deux sont absents de la navigation et de la page d'accueil du chat
- [ ] Le bouton "Télécharger" (sans action) du bandeau supérieur a bien disparu, partout

## 11. Non-régression

- [ ] Le flux quiz/auto-évaluation (`/chat/analyse-cv`) fonctionne toujours (upload → quiz → résultats)
- [ ] L'assistant "coller une offre manuellement" (`/chat/analyse-cv/comparer-offre`) fonctionne toujours (accessible mais plus mis en avant)
- [ ] Génération de roadmap (`generate_roadmap` / page Progression) fonctionne toujours en local

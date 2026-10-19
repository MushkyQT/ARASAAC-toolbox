# Atelier Pictos

Transforme une histoire, un album, un conte ou une recette en **cartes pictogrammes ARASAAC de 8 × 8 cm**, bordées de la couleur de la nature du mot, avec le mot-clé en capitales d'imprimerie au-dessus de l'image.

| Couleur | Catégorie |
| --- | --- |
| 🟦 `#38B6FF` | Noms |
| 🟥 `#FF3131` | Personnes et êtres vivants |
| 🟩 `#00BF63` | Actions / verbes |
| 🟪 `#C21AE5` | Lieux |
| 🟧 `#FF914D` | Adjectifs, description, émotions |
| 🟨 `#FFDE59` | Temps |

## Parcours

Les trois étapes restent visibles en haut de l'écran (**1 Le texte · 2 Les mots · 3 L'impression**), avec leur état : nombre de mots du texte, de cartes choisies et à vérifier, de pages A4. Un clic sur une étape y mène.

1. **Le texte**. Coller un texte dans le cadre, importer un fichier (PDF, Word `.docx`, OpenDocument `.odt`, `.txt`, photo d'une page : on peut aussi le déposer sur la feuille), ou importer une page web.
   - Les PDF scannés et les photos sont lus par OCR (tesseract.js, en français).
   - Pour les recettes en ligne (Marmiton, 750g…), les ingrédients et les étapes sont extraits des données schema.org.
   - Le texte reste toujours modifiable. Après une retouche, **Mettre à jour les mots** garde les cartes déjà choisies et leurs images.
   - Un texte collé sans titre prend sa première ligne comme titre, s'il en a l'air ; le titre nomme aussi les fichiers téléchargés.
2. **Les mots**. Avant l'analyse, les **passages qui ne font pas partie de l'histoire ou de la recette** sont repérés et laissés de côté, par des règles fixes (sans IA, `src/lib/nlp/passages.ts`) :
   - mentions légales (©, droits réservés, ISBN, dépôt légal, licence Creative Commons, cookies, licence du projet Gutenberg) ;
   - crédits et édition (« Texte de… », « Illustrations de… », éditeur, collection, imprimeur) ;
   - liens, adresses e-mail ou postales, numéros de téléphone ;
   - menus et boutons d'un site (fil d'Ariane, « Partager sur Facebook », « Imprimer la recette », newsletter, commentaires, « Ces recettes pourraient aussi vous plaire ») ;
   - infos pratiques (temps de préparation, nombre de personnes, difficulté, numéro de page, fiche pédagogique) ;
   - texte dans une autre langue (licence en anglais).

   Leurs mots ne sont ni proposés ni présélectionnés. Un bandeau indique combien de passages ont été ignorés et pourquoi ; dans la vue **Dans le texte**, chacun s'affiche en grisé avec un bouton **Inclure**, et n'importe quel paragraphe peut à l'inverse être ignoré. Dans un long paragraphe, seule la phrase en cause est écartée. Un retour en début de ligne (titre, liste d'ingrédients) n'est plus pris pour un nom propre.

   L'analyse repère ensuite les verbes, noms, adjectifs, lieux, temps et personnages, et les ramène à leur forme de base :
   - « rencontra » → rencontrer ;
   - « petites » → petit ;
   - « se brosse les dents » → se brosser les dents.

   Les mots les plus importants sont présélectionnés (jamais les verbes passe-partout comme « faire » ou « dire », ni les mots inconnus d'ARASAAC qui ne sont pas des personnages). Deux vues :
   - **Liste** : en haut, **Sur la planche**, les cartes qui seront imprimées, dans l'ordre d'impression ; en dessous, **Autres mots du texte**, une étiquette par mot avec sa petite image et son nombre d'occurrences, triée par importance (ou dans l'ordre du texte, ou alphabétique). Un clic l'ajoute à la planche, le survol montre la phrase. Pour un long texte, seuls les mots fréquents et les plus importants s'affichent d'emblée, les autres derrière un bouton. Les filtres par couleur s'appliquent aux deux.
   - **Dans le texte** : le texte lui-même, mots-clés soulignés (en couleur s'ils sont sur la planche, en pointillé sinon). Un clic ajoute ou retire le mot ; au clavier, les flèches passent d'un mot à l'autre et Entrée le coche.

   Retirer une carte, ignorer un passage ou commencer un nouveau document affiche un message avec **Annuler**.

   Quand un mot a plusieurs pictogrammes (« mélanger » un liquide, une pâte au fouet, des cartes…) :
   - ses premières images s'affichent sous la tuile : un clic ou les flèches suffisent pour changer ;
   - « Image à vérifier » signale les mots dont l'image a été prise par défaut, et un bandeau propose de les **vérifier une par une**. L'image est alors légendée par ses synonymes ARASAAC (« remuer », « fouetter »…), le mot est surligné dans sa phrase, et on choisit d'un clic ou au clavier (touches 1 à 9, ← →) ;
   - le choix est mémorisé, donc le mot n'est plus signalé dans les textes suivants ;
   - si le mot revient avec deux sens (« l'avocat mange un avocat »), **+ Autre sens** ajoute une deuxième carte juste après, avec une autre image. Cette copie n'est pas mémorisée : le sens principal reste celui proposé la fois suivante.

   Cliquer sur une image (sur la planche ou dans l'aperçu) ouvre toutes les propositions ARASAAC pour ce mot, avec :
   - une recherche libre dans ARASAAC ;
   - les variantes pluriel et noir et blanc ;
   - la possibilité d'utiliser une image personnelle, de faire une carte sans image, ou de retirer la carte.
3. **L'impression**. Les réglages des cartes (taille, police, bordure, gras, coins arrondis) et de la planche (ordre, repères de découpe, noir et blanc), un aperçu fidèle des pages A4 (un clic sur une carte l'ouvre) et quatre exports, chacun expliqué sous son bouton :
   - **PDF à imprimer** : cartes exactement à la taille choisie (5, 6, 8 ou 10 cm ; 6 cartes de 8 cm par page), repères de découpe et mention de licence ARASAAC.
   - **Pour Canva : planches A4** (`.pptx`) : dans Canva, *Créer → Importer un fichier*. Bordures, textes (Open Sans) et images restent des éléments séparés et modifiables.
   - **Pour Canva : une carte par page** (`.pptx`, pages de 8 × 8 cm).
   - **Images PNG** des cartes en 300 dpi (`.zip`).

Les choix de pictogrammes sont **mémorisés par mot**, si bien que « loup » garde son image d'une histoire à l'autre. Le travail en cours est sauvegardé automatiquement dans le navigateur (IndexedDB).

## Choix techniques

Chaque brique a fait l'objet d'une comparaison, arbitrée par une revue « tech lead ».

| Fonction | Retenu | Écarté (et pourquoi) |
| --- | --- | --- |
| Analyse du texte | **Sans IA, dans le navigateur.** Recherche de l'expression la plus longue dans le lexique ARASAAC FR (16 000 mots-clés, dont les locutions), formes fléchies générées depuis le Lefff (conjugaisons, passé simple compris) et `french-adjectives`, règles de contexte (déterminant → nom, pronom sujet → verbe, « a été » → auxiliaire), `fr-compromise` en secours pour les mots inconnus | spaCy (fonction Python, démarrage à froid, lemmes moins bons que le Lefff) ; modèles transformers.js (111 Mo, sans lemmes) ; LLM (exclu par la consigne « pas d'IA ») |
| Couleur du mot | Déduite des métadonnées ARASAAC (type de mot-clé + catégories/étiquettes), recalculée quand on choisit un autre pictogramme, et modifiable à la main | — |
| Jev (TypeSafe) | **Pas en v1** | Ne génère pas de texte, donc ne peut ni extraire ni lemmatiser ; français non documenté ; accès anticipé avec clé ; le classement par catégorie est déjà couvert par ARASAAC. Voir « Évaluer Jev » ci-dessous |
| Lecture des documents | unpdf, mammoth, jszip + DOMParser (ODT), tesseract.js pour l'OCR : tout se passe **dans le navigateur** | Analyse côté serveur (limite de 4,5 Mo sur Vercel, confidentialité) |
| Lien web | Route `/api/extract-url` : recette schema.org d'abord, sinon Readability + linkedom, avec protection SSRF | Services tiers (r.jina.ai) |
| PDF | pdf-lib + fontkit dans le navigateur, unités exactes, `PrintScaling: None` | CSS d'impression (mise à l'échelle imprévisible), Puppeteer (disproportionné) |
| Canva | PPTX via pptxgenjs, éléments natifs modifiables | PDF (le texte est découpé à l'import), SVG |

Une seule géométrie (`src/lib/cards/layout.ts`) alimente l'aperçu, le PDF, le PPTX et les PNG, et la taille du texte s'ajuste à la largeur de la carte (« POMME / DE TERRE » passe sur deux lignes).

### Évaluer Jev plus tard

Jev peut servir à deux choses :
- choisir le **sens** d'un mot ambigu dans sa phrase (« avocat » : fruit ou métier) ;
- noter l'**importance** d'un mot pour le récit.

Pour décider s'il vaut l'intégration :
1. Annoter le pictogramme attendu pour chaque mot des textes de `tests/fixtures` (en ajouter au moins cinq).
2. Mesurer le pipeline sans IA sur ces textes : il sert de référence.
3. Prototyper une route `/api/jev` côté serveur, avec la clé dans `JEV_API_KEY`, un seul appel groupé par texte, une limite de 1,5 s et un retour à l'heuristique en cas d'échec.
4. Ne l'adopter que si le pictogramme correct en première position progresse d'au moins 10 points sur les mots ambigus.

## Développement

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # vitest : analyse, mise en page, PDF, PPTX, extraction web
pnpm typecheck && pnpm lint
pnpm lexicon        # régénère public/data/lexicon-fr.json depuis l'API ARASAAC
```

Le lexique (`public/data/lexicon-fr.json`, environ 5 Mo et 0,7 Mo compressé) est versionné pour que les builds soient reproductibles. On le régénère de temps en temps pour récupérer les nouveaux pictogrammes ARASAAC.

### Arborescence

```
src/lib/nlp/        analyse : passages ignorés, lexique, mots outils, désambiguïsation, présélection
src/lib/words.ts    nouvelle analyse du même document : les choix déjà faits sont conservés
src/lib/cards/      géométrie, PDF, PPTX, PNG, mesure du texte
src/lib/ingest/     lecture PDF/DOCX/ODT/images (navigateur) et pages web (serveur)
src/lib/arasaac.ts  URLs d'images, recherche, mention de licence
src/components/     interface (texte → mots → impression)
scripts/            génération du lexique
tests/              tests vitest et textes d'exemple
```

## Licences

- **Pictogrammes** : les symboles pictographiques utilisés sont la propriété du Gouvernement d'Aragon et ont été créés par Sergio Palao pour ARASAAC (https://arasaac.org), qui les distribuent sous licence Creative Commons BY-NC-SA. **Usage non commercial uniquement.** Les documents produits doivent conserver cette mention ; le PDF et le PPTX l'impriment déjà.
- **Conjugaisons** : Lefff, licence LGPL-LR.
- **Polices** : Open Sans, Andika et Atkinson Hyperlegible, licence SIL OFL.

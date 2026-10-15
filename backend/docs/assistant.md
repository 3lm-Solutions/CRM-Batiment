# Assistant IA (étape 14)

Chatbot public qui répond aux questions simples et transforme une conversation en prospect
exploitable, plus le back-office de qualification. Cahier des charges : « Finalisation &
Fiabilisation de l'Assistant IA » (P0 à P4).

## Flux

```
visiteur ─ POST /public/assistant/sessions ─────────────→ conversation + jeton (une seule fois)
   │
   └─ POST …/sessions/:id/messages  (en-tête X-Chat-Token)
        1. recherche dans la base de connaissances (PostgreSQL full-text, français)
        2. OpenAI (schéma JSON strict) → réponse + champs extraits
           └─ IA absente ou en erreur → mode guidé (questions dans l'ordre, regex email/téléphone)
        3. champs revalidés par le serveur (email, téléphone FR, type de projet de l'entreprise)
        4. filtre de sortie : montant, estimation, marge, fournisseur, engagement → réponse remplacée + journalisée
        5. nom + contact + besoin connus → statut À QUALIFIER (une seule fois, mise à jour conditionnelle)
           + client existant / conversation précédente rattachés (anti-doublon) + notification à l'équipe

équipe ─ /assistant/prospects ─ compléter ─ qualifier → DemandeDevis (source CHATBOT) ─ ou rejeter (motif)
```

| Statut | Signification |
|---|---|
| NOUVEAU | Conversation en cours, coordonnées incomplètes |
| A_QUALIFIER | Nom + téléphone ou email + besoin : l'équipe est notifiée |
| QUALIFIE | Transformé en demande de devis (client retrouvé par email/téléphone, sinon créé) |
| REJETE | Spam, hors zone, doublon… (motif obligatoire ; peut être rouvert) |

## Règles de sécurité (P4)

- **Jamais de prix** : le prompt l'interdit ET chaque réponse passe par `checkSensitiveOutput`
  (montants, « environ 4000 », marges, coûts d'achat, fournisseurs, prix final garanti, fuite du prompt).
  Une réponse bloquée est remplacée par un message neutre et journalisée (`REPONSE_BLOQUEE`).
- La base de connaissances ne doit contenir **aucun prix** : tout ce qu'elle contient peut être cité.
- L'IA ne crée **jamais** de devis : elle alimente un prospect que l'équipe qualifie.
- Le jeton de conversation est aléatoire (256 bits), seul son hash est stocké ; un mauvais jeton = 404.
- Limites par IP : 10 conversations, 15 messages, 5 formulaires par minute ; 40 messages max par conversation.
- La clé OpenAI reste côté serveur. Les erreurs IA sont journalisées sans la clé ni le prompt
  (`AssistantErreur`, page Assistant IA → Journal, ADMIN).

## Configuration

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Vide = mode guidé (fonctionne sans IA, sans coût) |
| `OPENAI_MODEL` | `gpt-4o-mini` par défaut (rapide, peu coûteux) |
| `OPENAI_TIMEOUT_MS` | 20 s par défaut ; une relance en cas d'erreur réseau |

Le widget public (`/chat` dans le web) indique l'entreprise par `?entreprise=<companyId>`.

## Base de connaissances

Page **Assistant IA → Base de connaissances** (ADMIN modifie ; TECHNICO et ASSISTANTE lisent).
Un document = un titre, une catégorie, un texte, une priorité (0–10). La recherche « Tester » montre
quels documents l'assistant utiliserait pour une question.

La recherche plein texte est calculée à la volée (suffisant jusqu'à quelques centaines de documents).
Au-delà, ajouter dans une migration :

```sql
CREATE INDEX rag_documents_fts ON rag_documents
  USING gin (to_tsvector('french', titre || ' ' || contenu));
```

## Limites connues

- Le mode guidé comprend les réponses dans l'ordre des questions ; il ne « comprend » pas une phrase libre
  comme le fait l'IA (il recopie le message comme description du projet).
- Les modèles de raisonnement (famille o / gpt-5) consomment des jetons de réflexion : garder un modèle
  de chat (`gpt-4o-mini`, `gpt-4.1-mini`) pour des réponses rapides.
- Une conversation expire après 7 jours (le visiteur en recommence une).

## Devis IA (étape 15)

Dans l'éditeur d'un devis modifiable, **Proposer avec l'IA** : le technico décrit les travaux
(la description de la demande est pré-remplie), l'assistant propose des lignes du catalogue avec
des quantités ; le technico décoche, corrige, puis **Ajouter au devis**.

```
POST /devis/:id/ia/proposer   { description }            → proposition (rien n'est enregistré)
POST /devis/:id/ia/appliquer  { lignes: [{ prestationId, quantite }] }  → devis mis à jour
```

| Règle | Comment |
|---|---|
| Jamais de prix inventé | le modèle choisit des **id** de prestations ; les prix viennent du moteur de chiffrage du catalogue, comme une ligne ajoutée à la main |
| Jamais de prestation inventée | id inconnu, doublon, quantité ≤ 0 ou > 10 000 : ignorés (`parseProposition`) ; 15 lignes max |
| Rien sans validation | `proposer` n'écrit rien ; `appliquer` ajoute toutes les lignes retenues **ou aucune** (une transaction) |
| Ce qui manque est dit | `nonCouverts` (travaux absents du catalogue) et `hypotheses` (dimensions supposées) affichés |
| Sans clé OpenAI | recherche par mots-clés (nom 3 pts, catégorie 2, description 1) ; m² et ml lus dans le texte (« 8 m² », « 12 ml ») |
| Panne de l'IA | même recherche par mots-clés + avertissement ; erreur journalisée (`DEVIS_…`, page Assistant IA → Journal) |

Le catalogue entier est envoyé au modèle s'il compte 80 prestations ou moins, sinon les 60 meilleures
correspondances par mots-clés. Droits : ADMIN, TECHNICO, ASSISTANTE (comme les lignes de devis).

-- CreateEnum
CREATE TYPE "NiveauNotification" AS ENUM ('INFO', 'SUCCES', 'ALERTE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECHNICO', 'ASSISTANTE', 'CHEF_CHANTIER', 'SOUS_TRAITANT', 'FOURNISSEUR');

-- CreateEnum
CREATE TYPE "RetourClientType" AS ENUM ('COMMENTAIRE', 'ALERTE');

-- CreateEnum
CREATE TYPE "RetourClientStatut" AS ENUM ('OUVERT', 'TRAITE');

-- CreateEnum
CREATE TYPE "PhotoMoment" AS ENUM ('AVANT', 'APRES');

-- CreateEnum
CREATE TYPE "PhotoAvancementStatut" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'MASQUEE');

-- CreateEnum
CREATE TYPE "StatutClient" AS ENUM ('PROSPECT', 'QUALIFIE', 'CLIENT');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('PARTICULIER', 'PROFESSIONNEL');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CHATBOT', 'TECHNICO_COMMERCIAL', 'APPEL', 'RECOMMANDATION', 'SITE_WEB', 'WHATSAPP', 'EMAIL', 'AUTRE');

-- CreateEnum
CREATE TYPE "DemandeStatut" AS ENUM ('NOUVEAU', 'EN_COURS', 'QUALIFIE', 'CONVERTI', 'PERDU');

-- CreateEnum
CREATE TYPE "DevisStatut" AS ENUM ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'SIGNE', 'REFUSE', 'REVISE', 'RENVOYE', 'ANNULE');

-- CreateEnum
CREATE TYPE "DevisLienType" AS ENUM ('VALIDATION', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "DevisLienStatut" AS ENUM ('ACTIF', 'OTP_ENVOYE', 'OTP_VERIFIE', 'UTILISE', 'BLOQUE', 'EXPIRE', 'ANNULE');

-- CreateEnum
CREATE TYPE "CanalEnvoi" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ModeValidation" AS ENUM ('EMAIL', 'SIGNATURE', 'VERBAL', 'AUTRE');

-- CreateEnum
CREATE TYPE "RelanceType" AS ENUM ('DEVIS', 'FACTURE');

-- CreateEnum
CREATE TYPE "FactureStatut" AS ENUM ('BROUILLON', 'ENVOYEE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "FactureType" AS ENUM ('ACOMPTE', 'SITUATION', 'FINALE', 'AVOIR');

-- CreateEnum
CREATE TYPE "CommandeFournisseurStatut" AS ENUM ('CREEE', 'ENVOYEE', 'EXPEDIEE', 'PARTIELLE', 'RECUE', 'CLOTUREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeMouvementStock" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "ChantierStatut" AS ENUM ('PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE', 'CLOTURE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TacheStatut" AS ENUM ('A_FAIRE', 'EN_COURS', 'BLOQUEE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "TypePrix" AS ENUM ('VENTE', 'ACHAT');

-- CreateEnum
CREATE TYPE "Unite" AS ENUM ('M2', 'ML', 'M3', 'PIECE', 'JOUR', 'HEURE', 'LITRE', 'KG', 'FORFAIT');

-- CreateEnum
CREATE TYPE "SousTraitantStatut" AS ENUM ('ACTIF', 'INACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "PointageStatut" AS ENUM ('SOUMIS', 'VALIDE', 'REFUSE');

-- CreateEnum
CREATE TYPE "ContratSousTraitantStatut" AS ENUM ('BROUILLON', 'ACTIF', 'TERMINE', 'RESILIE');

-- CreateEnum
CREATE TYPE "TypeAssurance" AS ENUM ('DECENNALE', 'RC_PRO', 'AUTRE');

-- CreateEnum
CREATE TYPE "AssuranceStatut" AS ENUM ('VALIDE', 'A_RENOUVELER', 'EXPIREE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('VIREMENT', 'CHEQUE', 'ESPECES', 'CARTE', 'AUTRE');

-- CreateEnum
CREATE TYPE "PaiementStatut" AS ENUM ('EN_ATTENTE', 'REGLE', 'ANNULE');

-- CreateEnum
CREATE TYPE "SavTicketStatut" AS ENUM ('OUVERT', 'EN_COURS', 'EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE');

-- CreateEnum
CREATE TYPE "SavTicketPriorite" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "SavTicketCategorie" AS ENUM ('DEFAUT_TRAVAUX', 'RETARD', 'FACTURATION', 'QUALITE', 'SAV_TECHNIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "DemoRequestStatut" AS ENUM ('PENDING', 'CONTACTED', 'SCHEDULED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "RapportStatut" AS ENUM ('SOUMIS', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "ProspectStatut" AS ENUM ('NOUVEAU', 'A_QUALIFIER', 'QUALIFIE', 'REJETE');

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "siret" TEXT,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "tvaDefaut" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "acomptePercentDefault" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "margeCiblePourcent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "seuilAlerteMargePourcent" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "fraisFixeDeplacement" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pasArrondiPrix" DECIMAL(8,2) NOT NULL DEFAULT 0.01,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "relancesActives" BOOLEAN NOT NULL DEFAULT true,
    "relanceDevisJours" INTEGER[] DEFAULT ARRAY[7, 14]::INTEGER[],
    "relanceFactureJours" INTEGER[] DEFAULT ARRAY[1, 15, 30]::INTEGER[],
    "savDureeMois" INTEGER NOT NULL DEFAULT 12,
    "prixMarcheMois" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "telephone" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "signatureBase64" TEXT,
    "signatureUpdatedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "resetCodeHash" TEXT,
    "resetCodeExpiresAt" TIMESTAMP(3),
    "resetCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "niveau" "NiveauNotification" NOT NULL DEFAULT 'INFO',
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lien" TEXT,
    "lueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "ancienneValeur" JSONB,
    "nouvelleValeur" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_counters" (
    "companyId" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("companyId", "prefix", "year")
);

-- CreateTable
CREATE TABLE "types_projet" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "types_projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "typeClient" "TypeClient" NOT NULL DEFAULT 'PARTICULIER',
    "statut" "StatutClient" NOT NULL DEFAULT 'PROSPECT',
    "devenuClientLe" TIMESTAMP(3),
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "siret" TEXT,
    "tvaIntracom" TEXT,
    "contactNom" TEXT,
    "contactFonction" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "adresseClient" TEXT,
    "adresseChantier" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'AUTRE',
    "besoin" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients_types_projet" (
    "clientId" INTEGER NOT NULL,
    "typeProjetId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_types_projet_pkey" PRIMARY KEY ("clientId", "typeProjetId")
);

-- CreateTable
CREATE TABLE "categories_prestations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_prestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_projet_categories" (
    "typeProjetId" INTEGER NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "types_projet_categories_pkey" PRIMARY KEY ("typeProjetId", "categorieId")
);

-- CreateTable
CREATE TABLE "sous_categories" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "sousCategorieId" INTEGER,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "unite" "Unite" NOT NULL DEFAULT 'M2',
    "prixVenteMin" DECIMAL(12,2) NOT NULL,
    "prixVenteMax" DECIMAL(12,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_prestations" (
    "id" SERIAL NOT NULL,
    "prestationId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "options_prestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choix_options" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "impactPrix" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "choix_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestations_compositions" (
    "id" SERIAL NOT NULL,
    "prestationId" INTEGER NOT NULL,
    "materiauId" INTEGER,
    "serviceMainOeuvreId" INTEGER,
    "quantiteParUnite" DECIMAL(12,4) NOT NULL DEFAULT 1,

    CONSTRAINT "prestations_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choix_options_compositions" (
    "id" SERIAL NOT NULL,
    "choixOptionId" INTEGER NOT NULL,
    "materiauId" INTEGER,
    "serviceMainOeuvreId" INTEGER,
    "quantiteParUnite" DECIMAL(12,4) NOT NULL DEFAULT 1,

    CONSTRAINT "choix_options_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiaux" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "fournisseurId" INTEGER,
    "nom" TEXT NOT NULL,
    "couleur" TEXT,
    "finition" TEXT,
    "unite" "Unite" NOT NULL DEFAULT 'PIECE',
    "prixAchatFixe" DECIMAL(12,2) NOT NULL,
    "stockActuel" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stockMinimum" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "dateMaj" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services_main_oeuvre" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "unite" "Unite" NOT NULL DEFAULT 'M2',
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "productiviteJour" DECIMAL(10,2),
    "coutJournalier" DECIMAL(12,2),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_main_oeuvre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fournisseurs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "delaiLivraison" INTEGER,
    "conditions" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_devis" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createurId" INTEGER,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "LeadSource" NOT NULL DEFAULT 'AUTRE',
    "description" TEXT NOT NULL,
    "besoinStructure" JSONB,
    "statut" "DemandeStatut" NOT NULL DEFAULT 'NOUVEAU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "demandeDevisId" INTEGER,
    "chantierId" INTEGER,
    "createurId" INTEGER,
    "reference" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionCourante" INTEGER NOT NULL DEFAULT 1,
    "statut" "DevisStatut" NOT NULL DEFAULT 'BROUILLON',
    "tauxTVA" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "totalHT" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coutTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margePourcent" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "dateEnvoi" TIMESTAMP(3),
    "dateValidation" TIMESTAMP(3),
    "modeValidation" "ModeValidation",
    "notes" TEXT,
    "motifRefus" TEXT,
    "signatureClientBase64" TEXT,
    "signatureClientDate" TIMESTAMP(3),
    "signatureConseillerBase64" TEXT,
    "signatureConseillerDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_devis" (
    "id" SERIAL NOT NULL,
    "devisId" INTEGER NOT NULL,
    "prestationId" INTEGER,
    "materiauId" INTEGER,
    "serviceMainOeuvreId" INTEGER,
    "description" TEXT,
    "quantite" DECIMAL(12,3) NOT NULL,
    "unite" "Unite" NOT NULL DEFAULT 'M2',
    "dimension" TEXT,
    "couleur" TEXT,
    "finition" TEXT,
    "optionsChoisies" JSONB,
    "prixUnitaireVente" DECIMAL(12,2) NOT NULL,
    "prixAchat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mainOeuvre" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalHT" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coutTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lignes_devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions_devis" (
    "id" SERIAL NOT NULL,
    "devisId" INTEGER NOT NULL,
    "auteurId" INTEGER,
    "numeroVersion" INTEGER NOT NULL,
    "justification" TEXT,
    "snapshotLignes" JSONB,
    "totalHT" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margePourcent" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis_liens_client" (
    "id" SERIAL NOT NULL,
    "devisId" INTEGER NOT NULL,
    "type" "DevisLienType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "versionDevis" INTEGER NOT NULL,
    "canal" "CanalEnvoi" NOT NULL DEFAULT 'EMAIL',
    "destinataire" TEXT NOT NULL,
    "statut" "DevisLienStatut" NOT NULL DEFAULT 'ACTIF',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "otpCodeHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpSentAt" TIMESTAMP(3),
    "otpVerifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_liens_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "devisId" INTEGER NOT NULL,
    "reference" TEXT,
    "typeFacture" "FactureType" NOT NULL DEFAULT 'FINALE',
    "statut" "FactureStatut" NOT NULL DEFAULT 'BROUILLON',
    "numeroSituation" INTEGER,
    "avancementCumule" DECIMAL(5,2),
    "factureOrigineId" INTEGER,
    "dateEmission" TIMESTAMP(3),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "tauxTVA" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "montantHT" DECIMAL(12,2) NOT NULL,
    "montantTVA" DECIMAL(12,2) NOT NULL,
    "montantTTC" DECIMAL(12,2) NOT NULL,
    "acomptePercent" DECIMAL(5,2),
    "acompteMontant" DECIMAL(12,2),
    "referenceDevis" TEXT,
    "nomClient" TEXT,
    "prenomClient" TEXT,
    "emailClient" TEXT,
    "telephoneClient" TEXT,
    "adresseClient" TEXT,
    "clientSiret" TEXT,
    "clientTvaIntracom" TEXT,
    "companyNom" TEXT,
    "companyEmail" TEXT,
    "companyTelephone" TEXT,
    "companyAdresse" TEXT,
    "companySiret" TEXT,
    "companyIban" TEXT,
    "companyBic" TEXT,
    "lienPublicToken" TEXT,
    "conditionsPaiement" TEXT,
    "communicationPaiement" TEXT,
    "notesLegales" TEXT,
    "referencePaiement" TEXT,
    "emailEnvoiClient" TEXT,
    "dateEnvoiClient" TIMESTAMP(3),
    "datePaiement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_facture" (
    "id" SERIAL NOT NULL,
    "factureId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unite" TEXT NOT NULL DEFAULT 'UNITE',
    "prixUnitaireHT" DECIMAL(12,2) NOT NULL,
    "tauxTVA" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "montantHT" DECIMAL(12,2) NOT NULL,
    "montantTVA" DECIMAL(12,2) NOT NULL,
    "montantTTC" DECIMAL(12,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lignes_facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes_fournisseur" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "devisId" INTEGER,
    "fournisseurId" INTEGER NOT NULL,
    "chantierId" INTEGER,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statutLivraison" "CommandeFournisseurStatut" NOT NULL DEFAULT 'CREEE',
    "dateEnvoi" TIMESTAMP(3),
    "dateLivraisonPrevue" TIMESTAMP(3),
    "notes" TEXT,
    "dateAccuseReception" TIMESTAMP(3),
    "commentaireFournisseur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commandes_fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande_fournisseur" (
    "id" SERIAL NOT NULL,
    "commandeFournisseurId" INTEGER NOT NULL,
    "materiauId" INTEGER,
    "materiauNom" TEXT NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,
    "quantiteRecue" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unite" "Unite" NOT NULL DEFAULT 'PIECE',
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "totalHT" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lignes_commande_fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receptions" (
    "id" SERIAL NOT NULL,
    "commandeFournisseurId" INTEGER NOT NULL,
    "userId" INTEGER,
    "dateReception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receptions_lignes" (
    "id" SERIAL NOT NULL,
    "receptionId" INTEGER NOT NULL,
    "ligneCommandeId" INTEGER NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "receptions_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "materiauId" INTEGER NOT NULL,
    "userId" INTEGER,
    "type" "TypeMouvementStock" NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,
    "stockAvant" DECIMAL(12,3) NOT NULL,
    "stockApres" DECIMAL(12,3) NOT NULL,
    "motif" TEXT,
    "reference" TEXT,
    "chantierId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chantiers" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "chefChantierId" INTEGER,
    "reference" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "description" TEXT,
    "statut" "ChantierStatut" NOT NULL DEFAULT 'PLANIFIE',
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,
    "plan2d" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chantiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chantiers_sous_traitants" (
    "chantierId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "chantiers_sous_traitants_pkey" PRIMARY KEY ("chantierId", "userId")
);

-- CreateTable
CREATE TABLE "taches" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "statut" "TacheStatut" NOT NULL DEFAULT 'A_FAIRE',
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "commentaire" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taches_checklist" (
    "id" SERIAL NOT NULL,
    "tacheId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "fait" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "faitLe" TIMESTAMP(3),
    "faitParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taches_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos_avancement" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "tacheId" INTEGER NOT NULL,
    "checklistItemId" INTEGER,
    "auteurId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "moment" "PhotoMoment" NOT NULL,
    "commentaire" TEXT,
    "statut" "PhotoAvancementStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifMasquage" TEXT,
    "valideParId" INTEGER,
    "valideLe" TIMESTAMP(3),
    "fichierId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_avancement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retours_client" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "tacheId" INTEGER,
    "photoId" INTEGER,
    "type" "RetourClientType" NOT NULL,
    "message" TEXT NOT NULL,
    "statut" "RetourClientStatut" NOT NULL DEFAULT 'OUVERT',
    "reponse" TEXT,
    "reponduParId" INTEGER,
    "reponduLe" TIMESTAMP(3),
    "traiteParId" INTEGER,
    "traiteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retours_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pointages" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "tacheId" INTEGER,
    "date" DATE NOT NULL,
    "heures" DECIMAL(4,2) NOT NULL,
    "commentaire" TEXT,
    "statut" "PointageStatut" NOT NULL DEFAULT 'SOUMIS',
    "motifRefus" TEXT,
    "saisiParId" INTEGER,
    "valideParId" INTEGER,
    "valideLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pointages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_taches" (
    "id" SERIAL NOT NULL,
    "tacheId" INTEGER NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affectations_taches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_chantier" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "fichierId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_chantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sous_traitants" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "siret" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "specialite" TEXT,
    "statut" "SousTraitantStatut" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrats_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "montantHT" DECIMAL(12,2) NOT NULL,
    "statut" "ContratSousTraitantStatut" NOT NULL DEFAULT 'BROUILLON',
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrats_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assurances_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "typeAssurance" "TypeAssurance" NOT NULL,
    "numeroAttestation" TEXT NOT NULL,
    "compagnieAssurance" TEXT NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "fichierId" INTEGER,
    "statut" "AssuranceStatut" NOT NULL DEFAULT 'VALIDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assurances_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "contratId" INTEGER,
    "montantHT" DECIMAL(12,2) NOT NULL,
    "montantTTC" DECIMAL(12,2) NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL,
    "modePaiement" "ModePaiement" NOT NULL,
    "statut" "PaiementStatut" NOT NULL DEFAULT 'REGLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiements_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilites_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disponibilites_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notations_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "chantierId" INTEGER,
    "noteQualite" INTEGER NOT NULL,
    "noteDelai" INTEGER NOT NULL,
    "noteCommunication" INTEGER NOT NULL,
    "noteGlobale" DECIMAL(3,2) NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notations_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav_tickets" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "devisId" INTEGER,
    "factureId" INTEGER,
    "chantierId" INTEGER,
    "createurId" INTEGER,
    "origine" TEXT NOT NULL DEFAULT 'INTERNE',
    "assignedToId" INTEGER,
    "reference" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "SavTicketStatut" NOT NULL DEFAULT 'OUVERT',
    "priorite" "SavTicketPriorite" NOT NULL DEFAULT 'NORMALE',
    "categorie" "SavTicketCategorie" NOT NULL DEFAULT 'AUTRE',
    "dateEcheance" TIMESTAMP(3),
    "dateResolution" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sav_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav_ticket_notes" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "userId" INTEGER,
    "contenu" TEXT NOT NULL,
    "visibleClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sav_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relances" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "type" "RelanceType" NOT NULL,
    "devisId" INTEGER,
    "factureId" INTEGER,
    "niveau" INTEGER NOT NULL,
    "automatique" BOOLEAN NOT NULL DEFAULT true,
    "destinataire" TEXT NOT NULL,
    "emailEnvoye" BOOLEAN NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav_ticket_historique" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "statut" "SavTicketStatut" NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sav_ticket_historique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "assignedToId" INTEGER,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "entreprise" TEXT,
    "message" TEXT,
    "statut" "DemoRequestStatut" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'PUBLIC_FORM',
    "dateContact" TIMESTAMP(3),
    "dateDemo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "statut" "ProspectStatut" NOT NULL DEFAULT 'NOUVEAU',
    "source" "LeadSource" NOT NULL DEFAULT 'CHATBOT',
    "emailMessageId" TEXT,
    "emailSujet" TEXT,
    "clientNom" TEXT,
    "clientPrenom" TEXT,
    "clientEmail" TEXT,
    "clientTelephone" TEXT,
    "adresse" TEXT,
    "typeProjet" TEXT,
    "description" TEXT,
    "delai" TEXT,
    "besoinStructure" JSONB,
    "clientId" INTEGER,
    "doublonDeId" INTEGER,
    "demandeDevisId" INTEGER,
    "notesInternes" TEXT,
    "motifRejet" TEXT,
    "traiteParId" INTEGER,
    "traiteLe" TIMESTAMP(3),
    "derniereActivite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_chat" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER,
    "role" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "nlpResultat" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_documents" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_feedbacks" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "messageExcerpt" TEXT,
    "rating" TEXT NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_erreurs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_erreurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichiers" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "chantierId" INTEGER,
    "rapportId" INTEGER,
    "savTicketId" INTEGER,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapports_chantier" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "tacheId" INTEGER,
    "auteurId" INTEGER NOT NULL,
    "contenu" TEXT NOT NULL,
    "avancement" INTEGER,
    "statut" "RapportStatut" NOT NULL DEFAULT 'SOUMIS',
    "commentaireValidation" TEXT,
    "valideParId" INTEGER,
    "valideLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapports_chantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_espace_liens" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_espace_liens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prix_references" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "prestationId" INTEGER,
    "materiauId" INTEGER,
    "type" "TypePrix" NOT NULL DEFAULT 'VENTE',
    "unite" "Unite" NOT NULL,
    "prixMin" DECIMAL(12,2) NOT NULL,
    "prixMax" DECIMAL(12,2) NOT NULL,
    "source" TEXT,
    "importeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prix_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_siret_key" ON "companies"("siret");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "notifications_userId_lueAt_createdAt_idx" ON "notifications"("userId", "lueAt", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entite_entiteId_idx" ON "audit_logs"("entite", "entiteId");

-- CreateIndex
CREATE UNIQUE INDEX "types_projet_companyId_nom_key" ON "types_projet"("companyId", "nom");

-- CreateIndex
CREATE INDEX "clients_companyId_archivedAt_idx" ON "clients"("companyId", "archivedAt");

-- CreateIndex
CREATE INDEX "clients_companyId_typeClient_idx" ON "clients"("companyId", "typeClient");

-- CreateIndex
CREATE INDEX "clients_companyId_statut_idx" ON "clients"("companyId", "statut");

-- CreateIndex
CREATE INDEX "clients_companyId_nom_idx" ON "clients"("companyId", "nom");

-- CreateIndex
CREATE INDEX "clients_companyId_email_idx" ON "clients"("companyId", "email");

-- CreateIndex
CREATE INDEX "clients_companyId_telephone_idx" ON "clients"("companyId", "telephone");

-- CreateIndex
CREATE INDEX "clients_types_projet_typeProjetId_idx" ON "clients_types_projet"("typeProjetId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_prestations_companyId_nom_key" ON "categories_prestations"("companyId", "nom");

-- CreateIndex
CREATE INDEX "types_projet_categories_categorieId_idx" ON "types_projet_categories"("categorieId");

-- CreateIndex
CREATE UNIQUE INDEX "sous_categories_categorieId_nom_key" ON "sous_categories"("categorieId", "nom");

-- CreateIndex
CREATE INDEX "sous_categories_companyId_idx" ON "sous_categories"("companyId");

-- CreateIndex
CREATE INDEX "prestations_companyId_actif_idx" ON "prestations"("companyId", "actif");

-- CreateIndex
CREATE INDEX "prestations_categorieId_idx" ON "prestations"("categorieId");

-- CreateIndex
CREATE INDEX "prestations_sousCategorieId_idx" ON "prestations"("sousCategorieId");

-- CreateIndex
CREATE UNIQUE INDEX "options_prestations_prestationId_nom_key" ON "options_prestations"("prestationId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "choix_options_optionId_nom_key" ON "choix_options"("optionId", "nom");

-- CreateIndex
CREATE INDEX "prestations_compositions_prestationId_idx" ON "prestations_compositions"("prestationId");

-- CreateIndex
CREATE INDEX "prestations_compositions_materiauId_idx" ON "prestations_compositions"("materiauId");

-- CreateIndex
CREATE INDEX "prestations_compositions_serviceMainOeuvreId_idx" ON "prestations_compositions"("serviceMainOeuvreId");

-- CreateIndex
CREATE INDEX "choix_options_compositions_choixOptionId_idx" ON "choix_options_compositions"("choixOptionId");

-- CreateIndex
CREATE INDEX "materiaux_companyId_actif_idx" ON "materiaux"("companyId", "actif");

-- CreateIndex
CREATE INDEX "materiaux_fournisseurId_idx" ON "materiaux"("fournisseurId");

-- CreateIndex
CREATE INDEX "services_main_oeuvre_companyId_actif_idx" ON "services_main_oeuvre"("companyId", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "fournisseurs_userId_key" ON "fournisseurs"("userId");

-- CreateIndex
CREATE INDEX "fournisseurs_companyId_idx" ON "fournisseurs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_devis_reference_key" ON "demandes_devis"("reference");

-- CreateIndex
CREATE INDEX "demandes_devis_companyId_statut_idx" ON "demandes_devis"("companyId", "statut");

-- CreateIndex
CREATE INDEX "demandes_devis_clientId_idx" ON "demandes_devis"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "devis_reference_key" ON "devis"("reference");

-- CreateIndex
CREATE INDEX "devis_companyId_statut_idx" ON "devis"("companyId", "statut");

-- CreateIndex
CREATE INDEX "devis_clientId_idx" ON "devis"("clientId");

-- CreateIndex
CREATE INDEX "devis_chantierId_idx" ON "devis"("chantierId");

-- CreateIndex
CREATE INDEX "devis_demandeDevisId_idx" ON "devis"("demandeDevisId");

-- CreateIndex
CREATE INDEX "lignes_devis_devisId_idx" ON "lignes_devis"("devisId");

-- CreateIndex
CREATE INDEX "lignes_devis_prestationId_idx" ON "lignes_devis"("prestationId");

-- CreateIndex
CREATE INDEX "lignes_devis_materiauId_idx" ON "lignes_devis"("materiauId");

-- CreateIndex
CREATE INDEX "lignes_devis_serviceMainOeuvreId_idx" ON "lignes_devis"("serviceMainOeuvreId");

-- CreateIndex
CREATE UNIQUE INDEX "versions_devis_devisId_numeroVersion_key" ON "versions_devis"("devisId", "numeroVersion");

-- CreateIndex
CREATE UNIQUE INDEX "devis_liens_client_tokenHash_key" ON "devis_liens_client"("tokenHash");

-- CreateIndex
CREATE INDEX "devis_liens_client_devisId_type_statut_idx" ON "devis_liens_client"("devisId", "type", "statut");

-- CreateIndex
CREATE INDEX "devis_liens_client_expiresAt_idx" ON "devis_liens_client"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "factures_reference_key" ON "factures"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "factures_lienPublicToken_key" ON "factures"("lienPublicToken");

-- CreateIndex
CREATE INDEX "factures_companyId_statut_idx" ON "factures"("companyId", "statut");

-- CreateIndex
CREATE INDEX "factures_devisId_typeFacture_idx" ON "factures"("devisId", "typeFacture");

-- CreateIndex
CREATE INDEX "lignes_facture_factureId_idx" ON "lignes_facture"("factureId");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_fournisseur_reference_key" ON "commandes_fournisseur"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_fournisseur_devisId_fournisseurId_key" ON "commandes_fournisseur"("devisId", "fournisseurId");

-- CreateIndex
CREATE INDEX "commandes_fournisseur_chantierId_idx" ON "commandes_fournisseur"("chantierId");

-- CreateIndex
CREATE INDEX "commandes_fournisseur_companyId_statutLivraison_idx" ON "commandes_fournisseur"("companyId", "statutLivraison");

-- CreateIndex
CREATE INDEX "commandes_fournisseur_fournisseurId_idx" ON "commandes_fournisseur"("fournisseurId");

-- CreateIndex
CREATE INDEX "lignes_commande_fournisseur_commandeFournisseurId_idx" ON "lignes_commande_fournisseur"("commandeFournisseurId");

-- CreateIndex
CREATE INDEX "receptions_commandeFournisseurId_idx" ON "receptions"("commandeFournisseurId");

-- CreateIndex
CREATE INDEX "receptions_lignes_receptionId_idx" ON "receptions_lignes"("receptionId");

-- CreateIndex
CREATE INDEX "receptions_lignes_ligneCommandeId_idx" ON "receptions_lignes"("ligneCommandeId");

-- CreateIndex
CREATE INDEX "mouvements_stock_companyId_createdAt_idx" ON "mouvements_stock"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "mouvements_stock_materiauId_idx" ON "mouvements_stock"("materiauId");

-- CreateIndex
CREATE UNIQUE INDEX "chantiers_reference_key" ON "chantiers"("reference");

-- CreateIndex
CREATE INDEX "chantiers_companyId_statut_idx" ON "chantiers"("companyId", "statut");

-- CreateIndex
CREATE INDEX "chantiers_clientId_idx" ON "chantiers"("clientId");

-- CreateIndex
CREATE INDEX "chantiers_chefChantierId_idx" ON "chantiers"("chefChantierId");

-- CreateIndex
CREATE INDEX "chantiers_sous_traitants_userId_idx" ON "chantiers_sous_traitants"("userId");

-- CreateIndex
CREATE INDEX "taches_chantierId_statut_idx" ON "taches"("chantierId", "statut");

-- CreateIndex
CREATE INDEX "taches_checklist_tacheId_idx" ON "taches_checklist"("tacheId");

-- CreateIndex
CREATE UNIQUE INDEX "photos_avancement_fichierId_key" ON "photos_avancement"("fichierId");

-- CreateIndex
CREATE INDEX "photos_avancement_chantierId_date_idx" ON "photos_avancement"("chantierId", "date");

-- CreateIndex
CREATE INDEX "photos_avancement_tacheId_idx" ON "photos_avancement"("tacheId");

-- CreateIndex
CREATE INDEX "photos_avancement_companyId_statut_idx" ON "photos_avancement"("companyId", "statut");

-- CreateIndex
CREATE INDEX "photos_avancement_auteurId_date_idx" ON "photos_avancement"("auteurId", "date");

-- CreateIndex
CREATE INDEX "retours_client_chantierId_createdAt_idx" ON "retours_client"("chantierId", "createdAt");

-- CreateIndex
CREATE INDEX "retours_client_companyId_statut_type_idx" ON "retours_client"("companyId", "statut", "type");

-- CreateIndex
CREATE INDEX "retours_client_clientId_createdAt_idx" ON "retours_client"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "pointages_companyId_statut_idx" ON "pointages"("companyId", "statut");

-- CreateIndex
CREATE INDEX "pointages_sousTraitantId_date_idx" ON "pointages"("sousTraitantId", "date");

-- CreateIndex
CREATE INDEX "pointages_chantierId_idx" ON "pointages"("chantierId");

-- CreateIndex
CREATE INDEX "affectations_taches_tacheId_idx" ON "affectations_taches"("tacheId");

-- CreateIndex
CREATE INDEX "affectations_taches_userId_idx" ON "affectations_taches"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_chantier_fichierId_key" ON "documents_chantier"("fichierId");

-- CreateIndex
CREATE INDEX "documents_chantier_chantierId_idx" ON "documents_chantier"("chantierId");

-- CreateIndex
CREATE UNIQUE INDEX "sous_traitants_userId_key" ON "sous_traitants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sous_traitants_companyId_siret_key" ON "sous_traitants"("companyId", "siret");

-- CreateIndex
CREATE INDEX "sous_traitants_companyId_statut_idx" ON "sous_traitants"("companyId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "contrats_sous_traitant_reference_key" ON "contrats_sous_traitant"("reference");

-- CreateIndex
CREATE INDEX "contrats_sous_traitant_companyId_statut_idx" ON "contrats_sous_traitant"("companyId", "statut");

-- CreateIndex
CREATE INDEX "contrats_sous_traitant_sousTraitantId_idx" ON "contrats_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "contrats_sous_traitant_chantierId_idx" ON "contrats_sous_traitant"("chantierId");

-- CreateIndex
CREATE INDEX "assurances_sous_traitant_companyId_dateExpiration_idx" ON "assurances_sous_traitant"("companyId", "dateExpiration");

-- CreateIndex
CREATE INDEX "assurances_sous_traitant_sousTraitantId_idx" ON "assurances_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "paiements_sous_traitant_companyId_datePaiement_idx" ON "paiements_sous_traitant"("companyId", "datePaiement");

-- CreateIndex
CREATE INDEX "paiements_sous_traitant_sousTraitantId_idx" ON "paiements_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "paiements_sous_traitant_contratId_idx" ON "paiements_sous_traitant"("contratId");

-- CreateIndex
CREATE INDEX "disponibilites_sous_traitant_sousTraitantId_dateDebut_idx" ON "disponibilites_sous_traitant"("sousTraitantId", "dateDebut");

-- CreateIndex
CREATE INDEX "disponibilites_sous_traitant_companyId_idx" ON "disponibilites_sous_traitant"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "notations_sous_traitant_sousTraitantId_chantierId_key" ON "notations_sous_traitant"("sousTraitantId", "chantierId");

-- CreateIndex
CREATE INDEX "notations_sous_traitant_companyId_idx" ON "notations_sous_traitant"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "sav_tickets_reference_key" ON "sav_tickets"("reference");

-- CreateIndex
CREATE INDEX "sav_tickets_companyId_statut_priorite_idx" ON "sav_tickets"("companyId", "statut", "priorite");

-- CreateIndex
CREATE INDEX "sav_tickets_companyId_createdAt_idx" ON "sav_tickets"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "sav_tickets_clientId_idx" ON "sav_tickets"("clientId");

-- CreateIndex
CREATE INDEX "sav_tickets_assignedToId_idx" ON "sav_tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "sav_ticket_notes_ticketId_idx" ON "sav_ticket_notes"("ticketId");

-- CreateIndex
CREATE INDEX "relances_devisId_idx" ON "relances"("devisId");

-- CreateIndex
CREATE INDEX "relances_factureId_idx" ON "relances"("factureId");

-- CreateIndex
CREATE INDEX "relances_companyId_createdAt_idx" ON "relances"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "sav_ticket_historique_ticketId_idx" ON "sav_ticket_historique"("ticketId");

-- CreateIndex
CREATE INDEX "demo_requests_statut_createdAt_idx" ON "demo_requests"("statut", "createdAt");

-- CreateIndex
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");

-- CreateIndex
CREATE INDEX "demo_requests_assignedToId_idx" ON "demo_requests"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_tokenHash_key" ON "chat_sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_emailMessageId_key" ON "chat_sessions"("emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_demandeDevisId_key" ON "chat_sessions"("demandeDevisId");

-- CreateIndex
CREATE INDEX "chat_sessions_companyId_statut_derniereActivite_idx" ON "chat_sessions"("companyId", "statut", "derniereActivite");

-- CreateIndex
CREATE INDEX "chat_sessions_companyId_clientEmail_idx" ON "chat_sessions"("companyId", "clientEmail");

-- CreateIndex
CREATE INDEX "chat_sessions_companyId_source_idx" ON "chat_sessions"("companyId", "source");

-- CreateIndex
CREATE INDEX "messages_chat_sessionId_createdAt_idx" ON "messages_chat"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "rag_documents_companyId_actif_categorie_idx" ON "rag_documents"("companyId", "actif", "categorie");

-- CreateIndex
CREATE INDEX "assistant_feedbacks_companyId_rating_idx" ON "assistant_feedbacks"("companyId", "rating");

-- CreateIndex
CREATE INDEX "assistant_erreurs_companyId_createdAt_idx" ON "assistant_erreurs"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "fichiers_cle_key" ON "fichiers"("cle");

-- CreateIndex
CREATE INDEX "fichiers_companyId_idx" ON "fichiers"("companyId");

-- CreateIndex
CREATE INDEX "fichiers_chantierId_idx" ON "fichiers"("chantierId");

-- CreateIndex
CREATE INDEX "fichiers_rapportId_idx" ON "fichiers"("rapportId");

-- CreateIndex
CREATE INDEX "fichiers_savTicketId_idx" ON "fichiers"("savTicketId");

-- CreateIndex
CREATE INDEX "rapports_chantier_chantierId_createdAt_idx" ON "rapports_chantier"("chantierId", "createdAt");

-- CreateIndex
CREATE INDEX "rapports_chantier_auteurId_idx" ON "rapports_chantier"("auteurId");

-- CreateIndex
CREATE INDEX "rapports_chantier_companyId_statut_idx" ON "rapports_chantier"("companyId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "client_espace_liens_tokenHash_key" ON "client_espace_liens"("tokenHash");

-- CreateIndex
CREATE INDEX "client_espace_liens_clientId_idx" ON "client_espace_liens"("clientId");

-- CreateIndex
CREATE INDEX "prix_references_companyId_prestationId_idx" ON "prix_references"("companyId", "prestationId");

-- CreateIndex
CREATE INDEX "prix_references_companyId_materiauId_idx" ON "prix_references"("companyId", "materiauId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_counters" ADD CONSTRAINT "reference_counters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_projet" ADD CONSTRAINT "types_projet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients_types_projet" ADD CONSTRAINT "clients_types_projet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients_types_projet" ADD CONSTRAINT "clients_types_projet_typeProjetId_fkey" FOREIGN KEY ("typeProjetId") REFERENCES "types_projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories_prestations" ADD CONSTRAINT "categories_prestations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_projet_categories" ADD CONSTRAINT "types_projet_categories_typeProjetId_fkey" FOREIGN KEY ("typeProjetId") REFERENCES "types_projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_projet_categories" ADD CONSTRAINT "types_projet_categories_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_categories" ADD CONSTRAINT "sous_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_categories" ADD CONSTRAINT "sous_categories_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_prestations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_prestations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_sousCategorieId_fkey" FOREIGN KEY ("sousCategorieId") REFERENCES "sous_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_prestations" ADD CONSTRAINT "options_prestations_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options" ADD CONSTRAINT "choix_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options_prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations_compositions" ADD CONSTRAINT "prestations_compositions_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations_compositions" ADD CONSTRAINT "prestations_compositions_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations_compositions" ADD CONSTRAINT "prestations_compositions_serviceMainOeuvreId_fkey" FOREIGN KEY ("serviceMainOeuvreId") REFERENCES "services_main_oeuvre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options_compositions" ADD CONSTRAINT "choix_options_compositions_choixOptionId_fkey" FOREIGN KEY ("choixOptionId") REFERENCES "choix_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options_compositions" ADD CONSTRAINT "choix_options_compositions_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options_compositions" ADD CONSTRAINT "choix_options_compositions_serviceMainOeuvreId_fkey" FOREIGN KEY ("serviceMainOeuvreId") REFERENCES "services_main_oeuvre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiaux" ADD CONSTRAINT "materiaux_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiaux" ADD CONSTRAINT "materiaux_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_main_oeuvre" ADD CONSTRAINT "services_main_oeuvre_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_devis" ADD CONSTRAINT "demandes_devis_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_demandeDevisId_fkey" FOREIGN KEY ("demandeDevisId") REFERENCES "demandes_devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_serviceMainOeuvreId_fkey" FOREIGN KEY ("serviceMainOeuvreId") REFERENCES "services_main_oeuvre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_devis" ADD CONSTRAINT "versions_devis_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_devis" ADD CONSTRAINT "versions_devis_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis_liens_client" ADD CONSTRAINT "devis_liens_client_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_factureOrigineId_fkey" FOREIGN KEY ("factureOrigineId") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_fournisseur" ADD CONSTRAINT "commandes_fournisseur_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_fournisseur" ADD CONSTRAINT "commandes_fournisseur_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_fournisseur" ADD CONSTRAINT "commandes_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_fournisseur" ADD CONSTRAINT "commandes_fournisseur_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande_fournisseur" ADD CONSTRAINT "lignes_commande_fournisseur_commandeFournisseurId_fkey" FOREIGN KEY ("commandeFournisseurId") REFERENCES "commandes_fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande_fournisseur" ADD CONSTRAINT "lignes_commande_fournisseur_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_commandeFournisseurId_fkey" FOREIGN KEY ("commandeFournisseurId") REFERENCES "commandes_fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions_lignes" ADD CONSTRAINT "receptions_lignes_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "receptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions_lignes" ADD CONSTRAINT "receptions_lignes_ligneCommandeId_fkey" FOREIGN KEY ("ligneCommandeId") REFERENCES "lignes_commande_fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_chefChantierId_fkey" FOREIGN KEY ("chefChantierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers_sous_traitants" ADD CONSTRAINT "chantiers_sous_traitants_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chantiers_sous_traitants" ADD CONSTRAINT "chantiers_sous_traitants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches" ADD CONSTRAINT "taches_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_checklist" ADD CONSTRAINT "taches_checklist_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_checklist" ADD CONSTRAINT "taches_checklist_faitParId_fkey" FOREIGN KEY ("faitParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "taches_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_avancement" ADD CONSTRAINT "photos_avancement_fichierId_fkey" FOREIGN KEY ("fichierId") REFERENCES "fichiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos_avancement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_reponduParId_fkey" FOREIGN KEY ("reponduParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_client" ADD CONSTRAINT "retours_client_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_taches" ADD CONSTRAINT "affectations_taches_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_taches" ADD CONSTRAINT "affectations_taches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_chantier" ADD CONSTRAINT "documents_chantier_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_chantier" ADD CONSTRAINT "documents_chantier_fichierId_fkey" FOREIGN KEY ("fichierId") REFERENCES "fichiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_traitants" ADD CONSTRAINT "sous_traitants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_traitants" ADD CONSTRAINT "sous_traitants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitant" ADD CONSTRAINT "contrats_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitant" ADD CONSTRAINT "contrats_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitant" ADD CONSTRAINT "contrats_sous_traitant_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurances_sous_traitant" ADD CONSTRAINT "assurances_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurances_sous_traitant" ADD CONSTRAINT "assurances_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurances_sous_traitant" ADD CONSTRAINT "assurances_sous_traitant_fichierId_fkey" FOREIGN KEY ("fichierId") REFERENCES "fichiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitant" ADD CONSTRAINT "paiements_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitant" ADD CONSTRAINT "paiements_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitant" ADD CONSTRAINT "paiements_sous_traitant_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "contrats_sous_traitant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites_sous_traitant" ADD CONSTRAINT "disponibilites_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites_sous_traitant" ADD CONSTRAINT "disponibilites_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitant" ADD CONSTRAINT "notations_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitant" ADD CONSTRAINT "notations_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitant" ADD CONSTRAINT "notations_sous_traitant_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_notes" ADD CONSTRAINT "sav_ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "sav_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_notes" ADD CONSTRAINT "sav_ticket_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_historique" ADD CONSTRAINT "sav_ticket_historique_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "sav_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_historique" ADD CONSTRAINT "sav_ticket_historique_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_doublonDeId_fkey" FOREIGN KEY ("doublonDeId") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_demandeDevisId_fkey" FOREIGN KEY ("demandeDevisId") REFERENCES "demandes_devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_chat" ADD CONSTRAINT "messages_chat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_chat" ADD CONSTRAINT "messages_chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_feedbacks" ADD CONSTRAINT "assistant_feedbacks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_feedbacks" ADD CONSTRAINT "assistant_feedbacks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_erreurs" ADD CONSTRAINT "assistant_erreurs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_erreurs" ADD CONSTRAINT "assistant_erreurs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_rapportId_fkey" FOREIGN KEY ("rapportId") REFERENCES "rapports_chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_savTicketId_fkey" FOREIGN KEY ("savTicketId") REFERENCES "sav_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_chantier" ADD CONSTRAINT "rapports_chantier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_chantier" ADD CONSTRAINT "rapports_chantier_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_chantier" ADD CONSTRAINT "rapports_chantier_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_chantier" ADD CONSTRAINT "rapports_chantier_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_chantier" ADD CONSTRAINT "rapports_chantier_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_espace_liens" ADD CONSTRAINT "client_espace_liens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_espace_liens" ADD CONSTRAINT "client_espace_liens_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_espace_liens" ADD CONSTRAINT "client_espace_liens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_references" ADD CONSTRAINT "prix_references_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_references" ADD CONSTRAINT "prix_references_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_references" ADD CONSTRAINT "prix_references_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_references" ADD CONSTRAINT "prix_references_importeParId_fkey" FOREIGN KEY ("importeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


import { BadRequestException, type ValidationError } from '@nestjs/common';

/**
 * Every form error returned by the API, in French and readable by a non-developer.
 *
 * class-validator writes "telephone must be a string" by default. The global ValidationPipe uses
 * `validationExceptionFactory`: each default message is rewritten ("Le téléphone doit être un
 * texte."); messages already written in French in a DTO (`{ message: '…' }`) are kept as they are.
 */

/** How a field is named in a sentence. Unknown fields fall back to their own name. */
const LABELS: Record<string, string> = {
  nom: 'Le nom',
  prenom: 'Le prénom',
  email: 'L’email',
  telephone: 'Le téléphone',
  password: 'Le mot de passe',
  currentPassword: 'Le mot de passe actuel',
  newPassword: 'Le nouveau mot de passe',
  code: 'Le code',
  role: 'Le rôle',
  description: 'La description',
  contenu: 'Le message',
  titre: 'Le titre',
  motif: 'Le motif',
  notes: 'Les notes',
  adresse: 'L’adresse',
  adresseClient: 'L’adresse du client',
  adresseChantier: 'L’adresse du chantier',
  entreprise: 'L’entreprise',
  siret: 'Le SIRET',
  quantite: 'La quantité',
  unite: 'L’unité',
  prixUnitaireVente: 'Le prix de vente',
  prixAchat: 'Le prix d’achat',
  prixAchatFixe: 'Le prix d’achat',
  mainOeuvre: 'La main d’œuvre',
  tauxTVA: 'Le taux de TVA',
  montant: 'Le montant',
  montantHT: 'Le montant HT',
  montantTTC: 'Le montant TTC',
  pourcentage: 'Le pourcentage',
  avancement: 'L’avancement',
  dateDebut: 'La date de début',
  dateFin: 'La date de fin',
  dateEcheance: 'La date d’échéance',
  dateExpiration: 'La date d’expiration',
  date: 'La date',
  clientId: 'Le client',
  chantierId: 'Le chantier',
  devisId: 'Le devis',
  factureId: 'La facture',
  fournisseurId: 'Le fournisseur',
  prestationId: 'La prestation',
  materiauId: 'Le matériau',
  userId: 'L’utilisateur',
  chefChantierId: 'Le chef de chantier',
  categorieId: 'La catégorie',
  typeProjetIds: 'Les types de projet',
  statut: 'Le statut',
  priorite: 'La priorité',
  categorie: 'La catégorie',
  source: 'L’origine',
  page: 'La page',
  limit: 'Le nombre par page',
  search: 'La recherche',
  signatureBase64: 'La signature',
  delaiLivraison: 'Le délai de livraison',
  lignes: 'Les lignes',
  rating: 'L’avis',
  companyId: 'L’entreprise',
};

const label = (field: string) => LABELS[field] ?? `Le champ « ${field} »`;
const lower = (field: string) => {
  const l = label(field);
  return l.charAt(0).toLowerCase() + l.slice(1);
};

/** A message class-validator generated itself (English), as opposed to one written in a DTO. */
function isDefaultMessage(message: string, field: string): boolean {
  return message.startsWith(`${field} `) || message.startsWith('each value in ') || message.startsWith('nested property ') || message.startsWith('property ');
}

const number = (message: string) => /(-?\d+(?:\.\d+)?)/.exec(message.replace(/^.*?(must|should)/, ''))?.[1] ?? '';

/** French sentence for one failed constraint. */
export function frenchMessage(field: string, constraint: string, original: string): string {
  if (!isDefaultMessage(original, field)) return original; // already written in French in the DTO
  const L = label(field);
  switch (constraint) {
    case 'whitelistValidation':
      return `Le champ « ${field} » n’est pas attendu.`;
    case 'isNotEmpty':
    case 'isDefined':
      return `${L} est obligatoire.`;
    case 'isString':
      return `${L} doit être un texte.`;
    case 'isEmail':
      return `${L} n’est pas une adresse email valide.`;
    case 'isInt':
      return `${L} doit être un nombre entier.`;
    case 'isNumber':
    case 'isNumberString':
      return `${L} doit être un nombre (2 décimales maximum pour un montant).`;
    case 'isPositive':
      return `${L} doit être supérieur à 0.`;
    case 'min':
      return `${L} doit être au moins ${number(original)}.`;
    case 'max':
      return `${L} ne peut pas dépasser ${number(original)}.`;
    case 'minLength':
      return `${L} doit contenir au moins ${number(original)} caractères.`;
    case 'maxLength':
      return `${L} ne peut pas dépasser ${number(original)} caractères.`;
    case 'isEnum':
    case 'isIn':
      return `${L} n’a pas une valeur autorisée.`;
    case 'isBoolean':
      return `${L} doit être oui ou non.`;
    case 'isDateString':
    case 'isISO8601':
    case 'isDate':
      return `${L} n’est pas une date valide.`;
    case 'isArray':
      return `${L} doit être une liste.`;
    case 'arrayMinSize':
      return `Choisissez au moins ${number(original)} élément(s) pour ${lower(field)}.`;
    case 'arrayMaxSize':
      return `${number(original)} éléments maximum pour ${lower(field)}.`;
    case 'arrayUnique':
      return `${L} contient des doublons.`;
    case 'isObject':
      return `${L} n’a pas le bon format.`;
    case 'isUrl':
      return `${L} n’est pas une adresse web valide.`;
    case 'matches':
      return `${L} n’a pas le bon format.`;
    case 'nestedValidation':
      return `${L} contient une valeur invalide.`;
    default:
      return `${L} est invalide.`;
  }
}

/** Flattens nested errors ("lignes.0.quantite") into French messages, one per problem. */
export function frenchMessages(errors: ValidationError[], parent = ''): string[] {
  const out: string[] = [];
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const position = /^\d+$/.test(e.property) ? Number(e.property) + 1 : null;
    for (const [constraint, message] of Object.entries(e.constraints ?? {})) {
      const text = frenchMessage(e.property, constraint, message);
      out.push(position !== null ? `Ligne ${position} : ${text}` : text);
    }
    if (e.children?.length) out.push(...frenchMessages(e.children, path));
  }
  return [...new Set(out)];
}

/** Used by the global ValidationPipe (app.setup.ts). Same response shape as before, in French. */
export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException({ message: frenchMessages(errors), code: 'VALIDATION' });
}

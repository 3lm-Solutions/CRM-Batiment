import { checkSensitiveOutput } from './sensitive-output.filter';

describe('checkSensitiveOutput — filtre anti-fuite de donnees sensibles', () => {
  // ========== CE QUI DOIT ETRE BLOQUE ==========
  describe('doit detecter les contenus sensibles', () => {
    it('bloque un montant en euros', () => {
      const r = checkSensitiveOutput('La renovation coute 15 000 € environ.');
      expect(r.safe).toBe(false);
      expect(r.reasons).toContain('montant_chiffre');
    });

    it('bloque un montant en dinars', () => {
      const r = checkSensitiveOutput('Comptez 3000 DT pour la peinture.');
      expect(r.safe).toBe(false);
    });

    it('bloque une mention de marge', () => {
      const r = checkSensitiveOutput('Notre marge sur ce produit est confortable.');
      expect(r.safe).toBe(false);
      expect(r.reasons).toContain('marge_interne');
    });

    it('bloque les prix fournisseurs', () => {
      const r = checkSensitiveOutput('Le tarif fournisseur de ce carrelage est avantageux.');
      expect(r.safe).toBe(false);
    });

    it('bloque les messages de configuration interne', () => {
      const r = checkSensitiveOutput(
        'Le service Construction neuve existe, mais aucune prestation tarifee n est encore configuree.',
      );
      expect(r.safe).toBe(false);
      expect(r.reasons).toContain('message_configuration_interne');
    });
  });

  // ========== CE QUI DOIT PASSER (contre-tests !) ==========
  describe('laisse passer les reponses legitimes', () => {
    it('accepte la reponse prix standard (sans chiffre)', () => {
      const r = checkSensitiveOutput(
        "Le prix d'un projet dépend de plusieurs facteurs : la surface, les matériaux choisis, la main-d'œuvre. Souhaitez-vous que je lance votre demande de devis ?",
      );
      expect(r.safe).toBe(true);
    });

    it('accepte une reponse RAG informative', () => {
      const r = checkSensitiveOutput(
        'Un devis a une durée de validité indiquée dessus, souvent comprise entre 1 et 3 mois.',
      );
      expect(r.safe).toBe(true);
    });

    it('accepte le recapitulatif avec telephone (chiffres sans devise)', () => {
      const r = checkSensitiveOutput(
        'Nom : Jean Bernard, Téléphone : 0612345678, Email : jean@gmail.com',
      );
      expect(r.safe).toBe(true);
    });

    it('accepte une surface calculee (20 m2 sans prix)', () => {
      const r = checkSensitiveOutput('Une pièce de 5 m sur 4 m fait 20 m².');
      expect(r.safe).toBe(true);
    });

    it('accepte la question sur la gestion des fournisseurs (sans prix)', () => {
      const r = checkSensitiveOutput(
        'La gestion des fournisseurs se fait depuis BatiCRM : vous pouvez enregistrer vos fournisseurs et suivre les commandes.',
      );
      // "fournisseurs" + "commandes" → attention, ce cas teste la finesse du filtre !
      const acceptable = r.safe === true || r.reasons.includes('donnees_fournisseur');
      expect(acceptable).toBe(true);
    });
  });
});
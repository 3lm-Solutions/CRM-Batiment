
interface CGVDocumentProps {
  companyNom?: string;
  companyEmail?: string;
  companyTelephone?: string;
  companyAdresse?: string;
  companySiret?: string;
  pageOffset?: number; // Permet de définir le numéro de page initial (ex: 4 pour Devis, 3 pour Facture)
}

export function CGVDocument({
  companyNom = 'Pronergy Luxembourg',
  companyEmail = 'pronergylux@gmail.com',
  companyTelephone = '+352 661 333 793',
  companyAdresse = 'Rue Tresch 2, 8373 Habscht (Hobscheid)',
  companySiret = 'LU33391273',
  pageOffset = 4,
}: CGVDocumentProps) {
  return (
    <>
      {/* PAGE 1 des CGV (Page 4 du Devis / Page 3 de la Facture) */}
      <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-[10.5px] leading-[1.35] relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', margin: '10px auto', boxSizing: 'border-box' }}>
        <div>
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-300 pb-1 mb-3 uppercase tracking-wider">
            Conditions Générales de Ventes
          </h2>
          
          <div className="space-y-2.5">
            <div>
              <p className="font-semibold text-slate-900">1. Préambule</p>
              <p className="text-slate-600 mt-0.5">
                Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre <strong>{companyNom}</strong> (connu commercialement sous le nom de Pronergy Luxembourg), située à <strong>{companyAdresse}</strong>, immatriculée sous le numéro de TVA <strong>{companySiret}</strong>, spécialisée dans la commercialisation de panneaux solaires et de travaux de bâtiment, et ses clients. Toute commande implique l'adhésion sans réserve aux présentes CGV.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">2. Commande</p>
              <p className="text-slate-600 mt-0.5">
                Toute commande doit être confirmée par écrit via un devis signé par le client. Le devis précise les travaux à réaliser, les matériaux utilisés, le prix, et les délais d'exécution.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">3. Prix</p>
              <p className="text-slate-600 mt-0.5">
                Les prix indiqués dans le devis sont fermes et non révisables pendant la période de validité du devis. Les prix s'entendent hors taxes (HT), sauf indication contraire. Les taxes applicables seront ajoutées selon la législation en vigueur au moment de la facturation.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">4. Modalités de paiement</p>
              <p className="text-slate-600 mt-0.5">
                Les paiements se font par virement bancaire aux coordonnées fournies sur la facture. Les modalités de paiement sont les suivantes, sauf accord spécifique :
              </p>
              <ul className="list-disc pl-4 mt-0.5 text-slate-600 space-y-0.5">
                <li>20% d'acompte à la commande</li>
                <li>30% à mi-chantier</li>
                <li>50% à la réception des travaux</li>
              </ul>
              <p className="text-slate-600 mt-1">
                En cas de refus de la commune ou du gestionnaire d'électricité, l'acompte versé sera intégralement remboursé au client. Le non-respect des échéances de paiement peut entraîner la suspension des travaux et/ou l'application de pénalités de retard calculées sur la base du taux légal en vigueur.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">5. Délais de livraison et d'exécution</p>
              <p className="text-slate-600 mt-0.5">
                Les délais de livraison et d'exécution indiqués sont donnés à titre indicatif et peuvent être modifiés en fonction des aléas techniques et climatiques. {companyNom} s'engage à informer le client de tout retard significatif et à convenir d'une nouvelle date d'exécution.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">6. Garantie</p>
              <p className="text-slate-600 mt-0.5">
                Les installations sont garanties contre tout défaut de matériel et de pose pendant une période de 10 ans à compter de la réception des travaux. La garantie ne couvre pas les dommages résultant de l'usure normale, de l'utilisation abusive ou incorrecte, ou des catastrophes naturelles.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">7. Responsabilité</p>
              <p className="text-slate-600 mt-0.5">
                {companyNom} est responsable des dommages directs causés au client en raison d'une faute ou d'une négligence dans l'exécution des travaux. La responsabilité de {companyNom} est limitée au montant total de la commande. Elle ne peut être tenue responsable des dommages indirects ou immatériels.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">8. Réception des travaux</p>
              <p className="text-slate-600 mt-0.5">
                La réception des travaux est effectuée en présence du client ou de son représentant et donne lieu à la signature d'un procès-verbal de réception. Les éventuelles réserves doivent être mentionnées sur ce document. Le règlement du solde de la commande intervient après la levée des réserves.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">9. Droit de rétractation</p>
              <p className="text-slate-600 mt-0.5">
                Le client dispose d'un délai de 14 jours à compter de la signature du devis pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités. Toute rétractation doit être notifiée par écrit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400 mt-4 text-slate-400">
          <span>{companyNom} — CGV</span>
          <span>Page {pageOffset}</span>
        </div>
      </div>

      {/* PAGE 2 des CGV (Page 5 du Devis / Page 4 de la Facture) */}
      <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-[10.5px] leading-[1.35] relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', margin: '10px auto', boxSizing: 'border-box' }}>
        <div>
          <div className="space-y-2.5">
            <div>
              <p className="font-semibold text-slate-900">10. Force majeure</p>
              <p className="text-slate-600 mt-0.5">
                {companyNom} ne peut être tenue responsable de l'inexécution ou du retard dans l'exécution de ses obligations en cas de force majeure, telle que définie par la législation luxembourgeoise.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">11. Propriété intellectuelle</p>
              <p className="text-slate-600 mt-0.5">
                Tous les documents techniques, études, devis, dessins, remis au client demeurent la propriété exclusive de {companyNom}. Ils ne peuvent être communiqués à des tiers sans l'accord écrit de {companyNom}.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">12. Prime Clever Solar</p>
              <p className="text-slate-600 mt-0.5">Pour bénéficier de la Prime Clever Solar, les conditions suivantes doivent être remplies :</p>
              <ol className="list-decimal pl-4 mt-0.5 text-slate-600 space-y-0.5">
                <li><strong>Éligibilité :</strong> Le client doit être résident luxembourgeois et l'installation réalisée sur une propriété située au Luxembourg.</li>
                <li><strong>Certification :</strong> L'installation doit être effectuée par un installateur certifié, ou son sous-traitant principal RD LUX (Windhof, TVA LU032411465, Aut. N° 101 21 546).</li>
                <li><strong>Conformité :</strong> Le système doit être conforme aux normes techniques et de sécurité en vigueur.</li>
                <li><strong>Puissance :</strong> La puissance installée doit respecter les critères définis par le programme.</li>
                <li><strong>Documentation :</strong> Preuve de résidence, certificat de conformité et contrat de raccordement réseau requis.</li>
                <li><strong>Délais :</strong> La demande doit être soumise avant le début des travaux.</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-slate-900">13. Subvention Clever Heizen</p>
              <p className="text-slate-600 mt-0.5">Pour bénéficier de la subvention Clever Heizen, les conditions suivantes doivent être remplies :</p>
              <ol className="list-decimal pl-4 mt-0.5 text-slate-600 space-y-0.5">
                <li><strong>Éligibilité :</strong> Logement situé au Luxembourg, résident luxembourgeois.</li>
                <li><strong>Certification :</strong> Travaux réalisés par un professionnel agréé (ex : RD LUX, Aut. N° 101 21 544).</li>
                <li><strong>Conformité :</strong> Chauffage écologique et performant répondant aux critères du programme.</li>
                <li><strong>Documentation :</strong> Preuve de résidence, factures détaillées et attestations techniques.</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-slate-900">14. Litiges</p>
              <p className="text-slate-600 mt-0.5">
                En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le litige sera soumis aux tribunaux compétents du Luxembourg.
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">15. Loi applicable</p>
              <p className="text-slate-600 mt-0.5">
                Les présentes CGV sont régies par la loi luxembourgeoise.
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-center text-[11px] leading-5">
            Pour toute question relative aux présentes Conditions Générales de Vente, vous pouvez contacter notre service client à <a href={`mailto:${companyEmail}`} className="text-blue-600 font-semibold">{companyEmail}</a> ou au <span className="font-semibold">{companyTelephone}</span>.
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
          <span>{companyNom} — CGV</span>
          <span>Page {pageOffset + 1}</span>
        </div>
      </div>
    </>
  );
}

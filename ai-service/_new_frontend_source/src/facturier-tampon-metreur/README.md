# Dossier Look 3 — Facturier & Tampon Métreur

Ce dossier regroupe l'ensemble des fichiers autonomes constituant le **Look 3 : « Le Facturier & Tampon Métreur »**, conçu spécialement pour les professionnels de la rénovation, architectes d'intérieur et métreurs BTP.

---

## 📁 Composition du Dossier (`src/facturier-tampon-metreur/`)

| Fichier | Rôle & Description |
| :--- | :--- |
| `FacturierView.tsx` | **Composant principal (Orchestrateur)** : assemble l'inspecteur gauche, le grand livre droit, la télémétrie de marge et la barre de validation finale. |
| `TamponEncreurMetreur.tsx` | **Tampon Encreur Officiel Interactif** : cachet circulaire certifié (DTU, NF P03-001, RGE QUALI, Assurance Décennale AXA). Réactif au clic avec effet mécanique et calcul de conformité en direct. |
| `GrandLivreBordereau.tsx` | **Grand Livre Typographique (BPU)** : tableau comptable à haute densité avec édition inline des quantités, alertes de fourchettes tarifaires, et tiroirs dépliables (fourniture vs pose, options DTU). |
| `InspecteurChantier.tsx` | **Volet d'Inspection Latéral** : intègre le studio de capture multi-modale (Texte libre, Scanner Photo IA avec détection matériaux, Dictaphone Vocal 60s) et la fiche d'identité du chantier / maître d'ouvrage. |
| `BarometreMargeRuler.tsx` | **Réglet Baromètre Laiton & Bois** : règle millimétrée visualisant le Taux de Marque dans sa plage saine `[15% – 40%]` avec sélecteur de Taux de Marge instantané. |
| `index.ts` | **Point d'entrée du module** : exporte tous les sous-composants pour une intégration propre en une seule ligne. |

---

## ⚙️ Caractéristiques Métier Clés

1. **Édition Directe (In-Place)** :
   * La quantité d'ouvrage (`quantiteOuvrage`) s'édite directement dans le champ de la cellule du tableau.
   * Tout champ vide apparaît en surbrillance rouge claire bloquante, et se recalcule instantanément dès la frappe.

2. **Tampon Encreur Réactif** :
   * Affiche `CONFORME` (en encre cuivre/ambre) lorsque le taux de marque se situe entre `15%` et `40%`.
   * Bascule en `RÉVISION` (en encre grenat) si le devis est sous-évalué ou sur-évalué.
   * Clic interactif incrémentant le visa de contrôle du métreur.

3. **White Theme Architectural** :
   * Fond papier atelier lin (`#f8f9fa` / `#ffffff`), bordures techniques filaires (`border-stone-200`), typographie tabulaire `JetBrains Mono` pour les montants et `Plus Jakarta Sans` pour les désignations.

---

## 🚀 Utilisation Rapide

```tsx
import { FacturierView } from './facturier-tampon-metreur';

// Utilisation directe dans votre page ou modal :
<FacturierView
  calculation={calculation}
  tauxMarge={tauxMarge}
  tauxTVA={tauxTVA}
  clientInfo={clientInfo}
  onUpdateClientInfo={setClientInfo}
  onUpdateTauxMarge={handleUpdateTauxMarge}
  onUpdateQuantite={handleUpdateQuantite}
  onToggleOption={handleToggleOption}
  onDeleteOccurrence={handleDeleteOccurrence}
  onAddPrestation={handleAddPrestation}
  onChangeTauxTVA={setTauxTVA}
  onSendToClient={() => setIsSendModalOpen(true)}
  onSaveDraft={handleSaveDraft}
  onOpenPreview={() => setIsPreviewOpen(true)}
  isSavingDraft={isSavingDraft}
  isLoading={isLoading}
  activePrestationsCount={prestations.length}
  onGenerateFromText={handleGenerateFromText}
/>
```

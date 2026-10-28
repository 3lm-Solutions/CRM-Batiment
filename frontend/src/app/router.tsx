import type { Role } from '@/shared';
import type { ReactNode } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AssistantPage } from '@/features/assistant/AssistantPage';
import { PublicChatPage } from '@/features/assistant/ChatLauncher';
import { ProspectDetailPage } from '@/features/assistant/ProspectDetailPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { AuthProvider } from '@/features/auth/auth-context';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { CataloguePage } from '@/features/catalogue/CataloguePage';
import { PrestationDetailPage } from '@/features/catalogue/PrestationDetailPage';
import { ChantierDetailPage } from '@/features/chantiers/ChantierDetailPage';
import { ChantiersPage } from '@/features/chantiers/ChantiersPage';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { CommandeDetailPage } from '@/features/commandes/CommandeDetailPage';
import { CommandesPage } from '@/features/commandes/CommandesPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DemandesPage } from '@/features/demandes/DemandesPage';
import { DemoRequestsPage } from '@/features/demo/DemoRequestsPage';
import { PublicDemoPage } from '@/features/demo/PublicDemoPage';
import { DevisEditorPage } from '@/features/devis/DevisEditorPage';
import { DevisListPage } from '@/features/devis/DevisListPage';
import { EspaceClientApercuPage, EspaceClientPage } from '@/features/espace-client/EspaceClientPage';
import { FactureDetailPage } from '@/features/factures/FactureDetailPage';
import { FournisseursPage } from '@/features/fournisseurs/FournisseursPage';
import { FacturesPage } from '@/features/factures/FacturesPage';
import { FournisseurCommandePage, FournisseurCommandesPage } from '@/features/portail-fournisseur/FournisseurPages';
import { PortailHomePage } from '@/features/portail-st/PortailHomePage';
import { StChantierPage, StChantiersPage, StDossierPage, StRapportsPage } from '@/features/portail-st/StPages';
import { StDisponibilitesPage } from '@/features/portail-st/StDisponibilitesPage';
import { ClientDevisPage } from '@/features/public/ClientDevisPage';
import { SavDetailPage } from '@/features/sav/SavDetailPage';
import { SavPage } from '@/features/sav/SavPage';
import { SousTraitantDetailPage } from '@/features/sous-traitants/SousTraitantDetailPage';
import { SousTraitantsPage } from '@/features/sous-traitants/SousTraitantsPage';
import { StockPage } from '@/features/stock/StockPage';
import { UsersPage } from '@/features/users/UsersPage';
import { SettingsPage } from '@/features/company/SettingsPage';
import { PublicFacturePage } from '@/features/public/PublicFacturePage';
import { PlanningPage } from '@/features/planning/PlanningPage';
import { PointagesPage } from '@/features/pointages/PointagesPage';
import { StHeuresPage } from '@/features/portail-st/StHeuresPage';
import { AppLayout } from '@/layouts/AppLayout';
import { RequireAuth, RequireRoles, RoleHome } from './guards';
import { NotFoundPage } from './placeholders';

const BUREAU: Role[] = ['ADMIN', 'TECHNICO', 'ASSISTANTE'];
const STAFF: Role[] = [...BUREAU, 'CHEF_CHANTIER'];
const ST_READERS: Role[] = ['ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER'];
const PORTAL: Role[] = ['SOUS_TRAITANT', 'FOURNISSEUR'];

/** One protected page: path, roles, header title. */
const page = (path: string, roles: Role[], element: ReactNode, title: string) => ({
  path,
  element: <RequireRoles roles={roles}>{element}</RequireRoles>,
  handle: { title },
});

/**
 * Routes. `handle.title` feeds the header title and the browser tab.
 * Role checks here are UX only — the API enforces the same rules.
 */
export const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      // ── public ──
      // Home page for visitors (old app), role home once signed in
      { index: true, element: <RoleHome /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/changer-mot-de-passe', element: <ChangePasswordPage /> },
      { path: '/mot-de-passe-oublie', element: <ForgotPasswordPage /> },
      { path: '/demo', element: <PublicDemoPage /> },
      // Public chatbot, embeddable in the company website (<iframe src=".../chat?entreprise=1">)
      { path: '/chat', element: <PublicChatPage /> },
      // Links emailed to the client — no account
      { path: '/devis/lien/:token', element: <ClientDevisPage /> },
      { path: '/espace-client/:token', element: <EspaceClientPage /> },
      // QR code printed on an invoice (21/10)
      { path: '/facture/:token', element: <PublicFacturePage /> },
      // Office preview of a client's space (full page, like the client sees it)
      {
        path: '/clients/:id/espace-client',
        element: (
          <RequireAuth>
            <RequireRoles roles={BUREAU}>
              <EspaceClientApercuPage />
            </RequireRoles>
          </RequireAuth>
        ),
      },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'profil', element: <ProfilePage />, handle: { title: 'Mon profil' } },

          // ── pilotage ──
          page('tableau-de-bord', ['ADMIN'], <DashboardPage />, 'Tableau de bord'),
          page('demandes-demo', ['ADMIN', 'TECHNICO'], <DemoRequestsPage />, 'Demandes de démo'),
          page('demandes-demo/:id', ['ADMIN', 'TECHNICO'], <DemoRequestsPage />, 'Demandes de démo'),
          page('audit', ['ADMIN'], <AuditPage />, 'Audit'),

          // ── commercial ──
          page('assistant', BUREAU, <AssistantPage />, 'Assistant IA'),
          page('assistant/prospects/:id', BUREAU, <ProspectDetailPage />, 'Prospect'),
          page('demandes', BUREAU, <DemandesPage />, 'Demandes de devis'),
          page('devis', STAFF, <DevisListPage />, 'Devis'),
          page('devis/:id', STAFF, <DevisEditorPage />, 'Devis'),
          page('prospects', STAFF, <ClientsPage mode="prospects" />, 'Prospects'),
          page('clients', STAFF, <ClientsPage mode="clients" />, 'Clients'),
          page('clients/:id', STAFF, <ClientDetailPage />, 'Fiche client'),

          // ── opérations ──
          page('chantiers', STAFF, <ChantiersPage />, 'Chantiers'),
          page('chantiers/:id', STAFF, <ChantierDetailPage />, 'Chantier'),
          page('planning', STAFF, <PlanningPage />, 'Planning'),
          page('pointages', STAFF, <PointagesPage />, 'Pointages'),
          page('factures', STAFF, <FacturesPage />, 'Factures'),
          page('factures/:id', STAFF, <FactureDetailPage />, 'Facture'),
          page('commandes', STAFF, <CommandesPage />, 'Commandes fournisseur'),
          page('commandes/:id', STAFF, <CommandeDetailPage />, 'Commande'),
          page('stock', STAFF, <StockPage />, 'Stock'),
          page('sous-traitants', ST_READERS, <SousTraitantsPage />, 'Sous-traitants'),
          page('sous-traitants/:id', ST_READERS, <SousTraitantDetailPage />, 'Sous-traitant'),
          page('sav', STAFF, <SavPage />, 'SAV'),
          page('sav/:id', STAFF, <SavDetailPage />, 'Ticket SAV'),

          // ── référentiel ──
          page('catalogue', STAFF, <CataloguePage />, 'Catalogue'),
          page('catalogue/prestations/:id', STAFF, <PrestationDetailPage />, 'Prestation'),
          page('fournisseurs', BUREAU, <FournisseursPage />, 'Fournisseurs'),
          page('utilisateurs', ['ADMIN'], <UsersPage />, 'Utilisateurs'),
          page('parametres', ['ADMIN'], <SettingsPage />, 'Paramètres'),

          // ── portails (Step 11) ──
          page('portail', PORTAL, <PortailHomePage />, 'Mon espace'),
          page('portail/chantiers', ['SOUS_TRAITANT'], <StChantiersPage />, 'Mes chantiers'),
          page('portail/chantiers/:id', ['SOUS_TRAITANT'], <StChantierPage />, 'Chantier'),
          page('portail/rapports', ['SOUS_TRAITANT'], <StRapportsPage />, 'Mes rapports'),
          page('portail/dossier', ['SOUS_TRAITANT'], <StDossierPage />, 'Mon dossier'),
          page('portail/heures', ['SOUS_TRAITANT'], <StHeuresPage />, 'Mes heures'),
          page('portail/disponibilites', ['SOUS_TRAITANT'], <StDisponibilitesPage />, 'Mes disponibilités'),
          page('portail/commandes', ['FOURNISSEUR'], <FournisseurCommandesPage />, 'Mes commandes'),
          page('portail/commandes/:id', ['FOURNISSEUR'], <FournisseurCommandePage />, 'Commande'),

          { path: '*', element: <NotFoundPage />, handle: { title: 'Page introuvable' } },
        ],
      },
    ],
  },
]);

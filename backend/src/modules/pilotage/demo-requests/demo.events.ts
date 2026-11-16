export const DemoEvents = { NOUVELLE: 'demo.nouvelle' } as const;

export interface DemoRequestEvent {
  companyId: number;
  demoRequestId: number;
  nom: string;
  entreprise: string | null;
}

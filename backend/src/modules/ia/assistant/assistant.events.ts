export const AssistantEvents = {
  /** A chatbot conversation now has a name, a contact and a need: the sales team takes over */
  PROSPECT_A_QUALIFIER: 'assistant.prospect.a-qualifier',
  /** The visitor asked for a human / an urgent intervention */
  CONTACT_HUMAIN: 'assistant.contact-humain',
} as const;

export interface ProspectEvent {
  companyId: number;
  sessionId: number;
  nom: string | null;
  typeProjet: string | null;
  doublon: boolean;
  /** Where it came from (22/10): the chatbot (default) or an email */
  source?: 'CHATBOT' | 'EMAIL';
}

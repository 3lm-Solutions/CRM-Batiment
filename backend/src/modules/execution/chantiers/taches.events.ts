/** Task events (16/11, mobile lot B1), emitted after the commit. NotificationsListener handles them. */
export const TacheEvents = {
  /** New people put on a task (not the ones already there) */
  AFFECTEE: 'tache.affectee',
  COMMENTEE: 'tache.commentee',
} as const;

export interface TacheAffecteeEvent {
  companyId: number;
  chantierId: number;
  chantierReference: string;
  tacheId: number;
  tacheLibelle: string;
  /** users newly assigned (the author of the change excluded) */
  userIds: number[];
  parId: number;
}

export interface TacheCommenteeEvent {
  companyId: number;
  chantierId: number;
  chantierReference: string;
  tacheId: number;
  tacheLibelle: string;
  auteurId: number;
  auteurNom: string;
  extrait: string;
  /** assignees + the job site's chef, the author excluded */
  destinataires: number[];
}

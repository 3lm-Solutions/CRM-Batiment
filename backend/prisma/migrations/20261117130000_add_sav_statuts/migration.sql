-- Cahier des charges SAV 4.1: À qualifier, Planifié, Rejeté
ALTER TYPE "SavTicketStatut" ADD VALUE IF NOT EXISTS 'A_QUALIFIER';
ALTER TYPE "SavTicketStatut" ADD VALUE IF NOT EXISTS 'PLANIFIE';
ALTER TYPE "SavTicketStatut" ADD VALUE IF NOT EXISTS 'REJETE';

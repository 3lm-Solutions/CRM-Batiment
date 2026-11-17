-- Cahier des charges SAV (chap. 3): Responsable SAV and Agent SAV roles
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'RESPONSABLE_SAV';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AGENT_SAV';

-- Optional one-to-one link between a subcontractor record and its portal account.
ALTER TABLE "sous_traitants" ADD COLUMN "userId" INTEGER;

CREATE UNIQUE INDEX "sous_traitants_userId_key" ON "sous_traitants"("userId");

ALTER TABLE "sous_traitants"
  ADD CONSTRAINT "sous_traitants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

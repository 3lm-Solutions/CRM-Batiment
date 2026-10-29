-- Run by PostgreSQL ONLY when the volume is created (first « pnpm db:up »).
-- crm_batiment      : development (created by POSTGRES_DB)
-- crm_batiment_test : automatic tests (pnpm test:e2e, pnpm e2e)
-- crm_batiment_2    : second test database
CREATE DATABASE crm_batiment_test OWNER crm;
CREATE DATABASE crm_batiment_2 OWNER crm;
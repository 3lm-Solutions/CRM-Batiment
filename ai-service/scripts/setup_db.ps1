# Initialise la base Docker (tables + donnees test).
# Prerequis : docker compose up -d
# On copie les .sql DANS le conteneur (evite Windows qui remplace e accentue par ?).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Invoke-PsqlFile([string]$LocalPath) {
    $name = [System.IO.Path]::GetFileName($LocalPath)
    docker cp $LocalPath "devis_ia_db:/tmp/$name"
    if ($LASTEXITCODE -ne 0) { throw "docker cp a echoue pour $name" }
    docker exec -e PGCLIENTENCODING=UTF8 devis_ia_db psql -U postgres -d devis_ia_test -v ON_ERROR_STOP=1 -f "/tmp/$name"
}

Write-Host "1/2 - Creation des tables (ignore si elles existent deja)..."
$createOutput = Invoke-PsqlFile "$Root\scripts\create_tables.sql" 2>&1
if ($LASTEXITCODE -ne 0) {
    $text = ($createOutput | Out-String)
    if ($text -notmatch "already exists") {
        Write-Host $text
        throw "Echec creation des tables"
    }
    Write-Host "Tables deja presentes, on continue."
}

Write-Host "2/2 - Insertion des donnees test (reinitialise le catalogue)..."
Invoke-PsqlFile "$Root\scripts\seed_test_data.sql"
if ($LASTEXITCODE -ne 0) { throw "Echec insertion des donnees" }

Write-Host ""
Write-Host "OK - Base prete."
Write-Host 'Mettre dans .env : DATABASE_URL=postgresql://postgres:postgres@localhost:5432/devis_ia_test'

# This script automates the cleanup of broken node_modules and reinstallation.

Write-Host "Verifying Node.js version..." -ForegroundColor Cyan
$nodeVer = node -v
if ($nodeVer -notmatch "v(2[2-9]|[3-9][0-9])\.") {
    Write-Host "CRITICAL: You are on $nodeVer. Node.js 22+ is required for the frontend." -ForegroundColor Red
    Write-Host "Please download the latest LTS from https://nodejs.org/ before running this script."
    exit 1 # Exit with a non-zero code to indicate failure
}

Write-Host "Checking for hung processes on port 3000 (Backend)..." -ForegroundColor Cyan
try {
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($connections) {
        $pidsToKill = $connections | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique

        foreach ($currentPid in $pidsToKill) {
            # PID 0 is the System Idle Process, which cannot and should not be killed.
            if ($currentPid -eq 0) {
                Write-Host "Skipping PID 0 (System Idle Process) found on port 3000 connections." -ForegroundColor Gray
                continue
            }

            try {
                $process = Get-Process -Id $currentPid -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "Found hung process with PID $($currentPid) (Name: '$($process.ProcessName)'). Attempting to kill it..." -ForegroundColor Yellow
                    Stop-Process -Id $currentPid -Force -ErrorAction Stop # Use -ErrorAction Stop to catch specific errors
                    Write-Host "Successfully killed process with PID $($currentPid)." -ForegroundColor Green
                } else {
                    Write-Host "Process with PID $($currentPid) previously identified, but no longer running (likely terminated)." -ForegroundColor DarkYellow
                }
            } catch {
                Write-Host "ERROR: Could not stop process with PID $($currentPid). Details: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } elseif ($connections -eq $null) { # Explicitly check for $null to differentiate from empty array
        Write-Host "Port 3000 is clear." -ForegroundColor Green
    }
} catch {
    Write-Host "An error occurred while checking for processes on port 3000: $($_.Exception.Message)" -ForegroundColor Red
    # Decide if you want to exit here or continue. For a cleanup script, continuing might be acceptable.
}

Write-Host "Cleaning up all node_modules and locks..." -ForegroundColor Cyan
$pathsToClean = @(
    "node_modules", "package-lock.json",
    "backend/node_modules", "backend/package-lock.json",
    "frontend/node_modules", "frontend/package-lock.json",
    "backend/dist" # Often good to clean build artifacts too
)
$pathsToClean | ForEach-Object {
    if (Test-Path $_) { 
        Write-Host "Removing $_..." -ForegroundColor DarkGray
        Remove-Item -Path $_ -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "Path $_ not found, skipping." -ForegroundColor DarkGray
    }
}

Write-Host "Installing project dependencies (root)..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 'npm install' failed in the root directory." -ForegroundColor Red
    exit 1
}

Write-Host "Repairing backend dependencies..." -ForegroundColor Cyan
Set-Location backend
npm install # A regular npm install should suffice after deleting node_modules. Use --force only if absolutely necessary.
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 'npm install' failed in the backend directory." -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "Generating Prisma Client..." -ForegroundColor Yellow
# On Windows, directly invoke the .cmd shim for better reliability.
# On other OS, npx prisma generate is usually fine.
if ($IsWindows -or $env:OS -match "Windows") {
    & ".\node_modules\.bin\prisma.cmd" generate
} else {
    npx prisma generate
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: 'npx prisma generate' had an issue. Trying fallback..." -ForegroundColor Yellow
    npm exec prisma generate
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "CRITICAL: Could not generate Prisma Client." -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

Write-Host "Repairing frontend dependencies..." -ForegroundColor Cyan
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 'npm install' failed in the frontend directory." -ForegroundColor Red
    exit 1
}
Set-Location ..

Write-Host "Project fixed! Run 'npm run dev' to start development." -ForegroundColor Green
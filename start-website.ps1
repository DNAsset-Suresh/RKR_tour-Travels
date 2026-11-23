param(
    [int]$FrontendPort = 3001,
    [switch]$NoWait
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Resolve PostgreSQL binary
$pgBins = @(
    'D:\Survey_Checklist\dnassets-verify\.runtime\pgsql\bin',
    'C:\Program Files\PostgreSQL\18\bin',
    'C:\Program Files\PostgreSQL\17\bin',
    'C:\Program Files\PostgreSQL\16\bin'
)
$postgresBin = $null
foreach ($bin in $pgBins) {
    if (Test-Path "$bin\postgres.exe") {
        $postgresBin = $bin
        break
    }
}

# 2. Resolve Node executable
$nodeExe = $null
if (Test-Path "$projectRoot\.local\node.cmd") {
    $nodeExe = "$projectRoot\.local\node.cmd"
} elseif (Get-Command 'node.exe' -ErrorAction SilentlyContinue) {
    $nodeExe = (Get-Command 'node.exe').Source
} elseif (Test-Path 'C:\Users\DELL\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe') {
    $nodeExe = 'C:\Users\DELL\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe'
    $env:ELECTRON_RUN_AS_NODE = '1'
}

$localDir = Join-Path $projectRoot '.local'
if (-not (Test-Path $localDir)) { New-Item -ItemType Directory -Path $localDir | Out-Null }

# 3. Clean stale PostgreSQL postmaster.pid if process is not running
$pidPath = Join-Path $projectRoot '.local\pgdata\postmaster.pid'
if (Test-Path $pidPath) {
    $pidContent = Get-Content $pidPath -ErrorAction SilentlyContinue
    if ($pidContent -and $pidContent.Count -gt 0) {
        $pgPid = [int]$pidContent[0]
        $proc = Get-Process -Id $pgPid -ErrorAction SilentlyContinue
        if (-not $proc) {
            Remove-Item $pidPath -Force
        }
    } else {
        Remove-Item $pidPath -Force
    }
}

# 4. Start PostgreSQL if not already listening
if ($postgresBin) {
    $existingPg = Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue
    if (-not $existingPg) {
        Write-Host "Starting PostgreSQL on 127.0.0.1:55432..."
        Start-Process -FilePath "$postgresBin\postgres.exe" `
            -ArgumentList "-D `"$projectRoot\.local\pgdata`"" `
            -RedirectStandardOutput (Join-Path $localDir 'postgres.log') `
            -RedirectStandardError (Join-Path $localDir 'postgres-error.log') `
            -PassThru -NoNewWindow | Out-Null
        Start-Sleep -Seconds 2
    }
}

# 5. Start Backend API if not already listening
if ($nodeExe) {
    $existingApi = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
    if (-not $existingApi) {
        Write-Host "Starting Backend API on http://localhost:5000..."
        $env:ELECTRON_RUN_AS_NODE = '1'
        Start-Process -FilePath $nodeExe `
            -ArgumentList "`"$projectRoot\backend\server.js`"" `
            -WorkingDirectory "$projectRoot\backend" `
            -RedirectStandardOutput (Join-Path $localDir 'api.log') `
            -RedirectStandardError (Join-Path $localDir 'api-error.log') `
            -PassThru -NoNewWindow | Out-Null
        Start-Sleep -Seconds 2
    }
}

# 6. Start Frontend dev server if not already listening
if ($nodeExe) {
    $existingFrontend = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
    if (-not $existingFrontend) {
        Write-Host "Starting Frontend on http://localhost:$FrontendPort..."
        $env:ELECTRON_RUN_AS_NODE = '1'
        $env:FRONTEND_PORT = "$FrontendPort"
        Start-Process -FilePath $nodeExe `
            -ArgumentList "`"$projectRoot\frontend\dev-server.js`"" `
            -WorkingDirectory "$projectRoot\frontend" `
            -RedirectStandardOutput (Join-Path $localDir 'frontend.log') `
            -RedirectStandardError (Join-Path $localDir 'frontend-error.log') `
            -PassThru -NoNewWindow | Out-Null
        Start-Sleep -Seconds 1
    }
}

Write-Host "RKR TOUR services ready:"
Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Backend API: http://localhost:5000"

if (-not $NoWait) {
    while ($true) {
        Start-Sleep -Seconds 30
    }
}

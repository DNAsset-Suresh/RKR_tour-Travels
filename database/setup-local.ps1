param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localRoot = Join-Path $projectRoot '.local'
$clusterPath = Join-Path $localRoot 'pgdata'
$envPath = Join-Path $projectRoot 'backend\.env'
if (Test-Path -LiteralPath $envPath) { throw 'backend/.env already exists; refusing to overwrite configuration.' }
if (Test-Path -LiteralPath $clusterPath) { throw 'Local database cluster already exists; use start-local.ps1.' }
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
$ownerPassword = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$appPassword = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$adminKey = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$pwFile = Join-Path $localRoot 'init-password.tmp'
[IO.File]::WriteAllText($pwFile,$ownerPassword)
try {
  & (Join-Path $PostgresBin 'initdb.exe') -D $clusterPath -U rkr_owner --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$pwFile
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL initialization failed.' }
} finally { Remove-Item -LiteralPath $pwFile -ErrorAction SilentlyContinue }
Add-Content -LiteralPath (Join-Path $clusterPath 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = 55432`ntimezone = 'Asia/Kolkata'"
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $clusterPath -l (Join-Path $localRoot 'postgres.log') -w start
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start.' }
$priorPgPassword=$env:PGPASSWORD
try {
  $env:PGPASSWORD=$ownerPassword
  "CREATE ROLE rkr_app LOGIN PASSWORD '$appPassword'; CREATE DATABASE rkr_tour OWNER rkr_app;" | & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p 55432 -U rkr_owner -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
} finally { $env:PGPASSWORD=$priorPgPassword }
$envContent=@"
NODE_ENV=development
HOST=127.0.0.1
PORT=5000
FRONTEND_ORIGIN=http://localhost:3001,http://localhost:3002
PGHOST=127.0.0.1
PGPORT=55432
PGDATABASE=rkr_tour
PGUSER=rkr_app
PGPASSWORD=$appPassword
PGSSL=false
ADMIN_API_KEY=$adminKey
BUSINESS_PHONE=
BUSINESS_WHATSAPP=
BUSINESS_EMAIL=
BUSINESS_ADDRESS=
BUSINESS_INSTAGRAM=
BUSINESS_FACEBOOK=
"@
[IO.File]::WriteAllText($envPath,$envContent)
[IO.File]::WriteAllText((Join-Path $localRoot 'owner.env'),"PGUSER=rkr_owner`nPGPASSWORD=$ownerPassword")
Write-Output 'Isolated PostgreSQL is ready on 127.0.0.1:55432. Credentials saved locally; no credentials printed.'

param([string]$PostgresBin)
if (-not $PostgresBin) {
  if (Test-Path 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe') { $PostgresBin = 'C:\Program Files\PostgreSQL\18\bin' }
  elseif (Test-Path 'D:\Survey_Checklist\dnassets-verify\.runtime\pgsql\bin\pg_ctl.exe') { $PostgresBin = 'D:\Survey_Checklist\dnassets-verify\.runtime\pgsql\bin' }
  else { $PostgresBin = 'C:\Program Files\PostgreSQL\18\bin' }
}
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
& (Join-Path $PostgresBin 'pg_ctl.exe') -D (Join-Path $projectRoot '.local\pgdata') -l (Join-Path $projectRoot '.local\postgres.log') -w start

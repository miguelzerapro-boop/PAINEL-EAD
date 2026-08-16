# ===========================================================================
# Sobe um PostgreSQL de HOMOLOGACAO local, isolado.
#
# Duas versoes disponiveis, para provar que o schema funciona na versao que o
# Supabase realmente roda (15) e na mais recente (18):
#
#   .\scripts\homolog\iniciar-banco.ps1                    # PG 18.4, porta 55432
#   .\scripts\homolog\iniciar-banco.ps1 -Versao 15         # PG 15.18, porta 55433
#   .\scripts\homolog\iniciar-banco.ps1 -Versao 15 -Parar
#   .\scripts\homolog\iniciar-banco.ps1 -Recriar
#
# NAO e producao e NAO e o Supabase.
# ===========================================================================
param(
  [ValidateSet('15', '18')]
  [string]$Versao = '18',
  [switch]$Parar,
  [switch]$Recriar
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if ($Versao -eq '15') {
  $nativo = Join-Path $raiz 'node_modules\pg15\native'
  $porta = 55433
  $sufixo = 'pg15'
} else {
  $nativo = Join-Path $raiz 'node_modules\@embedded-postgres\windows-x64\native'
  $porta = 55432
  $sufixo = 'pg18'
}

$bin = Join-Path $nativo 'bin'
$dados = Join-Path $raiz ".homolog\$sufixo\data"
$log = Join-Path $raiz ".homolog\$sufixo\postgres.log"

if (-not (Test-Path "$bin\postgres.exe")) {
  throw "Binario do PostgreSQL $Versao nao encontrado em $bin. Rode npm install."
}

if ($Parar) {
  if (Test-Path $dados) {
    & "$bin\pg_ctl.exe" -D $dados stop -m fast 2>&1 | Out-String | Write-Host
  } else {
    Write-Host "datadir $sufixo nao existe"
  }
  return
}

if ($Recriar -and (Test-Path $dados)) {
  try { & "$bin\pg_ctl.exe" -D $dados stop -m immediate 2>&1 | Out-Null } catch {}
  Start-Sleep -Seconds 1
  Remove-Item -Recurse -Force $dados
}

if (-not (Test-Path $dados)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $dados) | Out-Null
  & "$bin\initdb.exe" -D $dados -U postgres --auth=trust --encoding=UTF8 --locale=C 2>&1 | Out-Null
  Write-Host "datadir criado em $dados"
}

& "$bin\pg_ctl.exe" -D $dados -l $log -o "-p $porta" start 2>&1 | Out-String | Write-Host
Start-Sleep -Seconds 2
Write-Host "PostgreSQL $Versao ouvindo em localhost:$porta"

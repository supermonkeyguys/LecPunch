[CmdletBinding()]
param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $packageRoot '.env'
$upstreamCompose = Join-Path $packageRoot '.upstream/docker-jitsi-meet/docker-compose.yml'
$overrideCompose = Join-Path $packageRoot 'compose.lan.override.yml'
if (-not (Test-Path $envPath) -or -not (Test-Path $upstreamCompose)) { throw '请先运行 Initialize-LanMeet.ps1。' }

$command = @('compose','--env-file',$envPath,'-f',$upstreamCompose,'-f',$overrideCompose)
if ($Stop) { & docker @command 'down'; exit $LASTEXITCODE }
& docker @command 'up' '-d'
exit $LASTEXITCODE

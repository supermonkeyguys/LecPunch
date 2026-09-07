[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $packageRoot '.env'
if (-not (Test-Path $envPath)) { throw '未找到 lan-meet/.env。' }
$vars = @{}
Get-Content $envPath | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { $key,$value = $_ -split '=',2; $vars[$key] = $value }
if ($vars['LAN_BIND_IP'] -eq '0.0.0.0') { throw '拒绝：会议端口不可绑定 0.0.0.0。' }

$upstreamCompose = Join-Path $packageRoot '.upstream/docker-jitsi-meet/docker-compose.yml'
$overrideCompose = Join-Path $packageRoot 'compose.lan.override.yml'
$renderedCompose = & docker compose --env-file $envPath -f $upstreamCompose -f $overrideCompose config
if ($LASTEXITCODE -ne 0) { throw '无法渲染 Docker Compose 配置。' }
$forbiddenExposure = $renderedCompose | Select-String -Pattern '(?i)0\.0\.0\.0|:8000|(?<![A-Z0-9_])(?:turn|stun):'
if ($forbiddenExposure) { throw "安全检查失败：渲染后的 Compose 包含禁止暴露或公网发现项：$($forbiddenExposure.Line -join '; ')" }

& docker compose --env-file $envPath -f $upstreamCompose -f $overrideCompose ps
$https = Test-NetConnection -ComputerName $vars['LAN_BIND_IP'] -Port ([int]$vars['HTTPS_PORT']) -InformationLevel Quiet
if (-not $https) { throw 'HTTPS 端口未监听。' }
$curlPath = Join-Path $env:SystemRoot 'System32/curl.exe'
if (-not (Test-Path $curlPath)) { throw '缺少 Windows curl.exe，无法验证浏览器隐私配置。' }
$configJs = ((& $curlPath --insecure --silent --show-error "https://$($vars['LAN_BIND_IP']):$($vars['HTTPS_PORT'])/config.js") -join "`n")
if ($LASTEXITCODE -ne 0) { throw '无法读取 Jitsi config.js。' }
foreach ($requiredSetting in 'config.p2p = { enabled: false };','config.analytics = { disabled: true };','config.disableThirdPartyRequests = true;') {
  if ($configJs -notmatch [regex]::Escape($requiredSetting)) { throw "浏览器隐私配置缺失：$requiredSetting" }
}
Write-Host "本机 HTTPS 可达：https://$($vars['LAN_BIND_IP']):$($vars['HTTPS_PORT'])"
Write-Host '浏览器 P2P、分析与第三方请求禁用配置已加载。'
Write-Host '请按 docs/双设备验收.md 在第二台局域网设备完成音视频、令牌拒绝和抓包验证。'

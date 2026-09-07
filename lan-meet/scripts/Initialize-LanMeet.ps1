#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$LanBindIp,
  [Parameter(Mandatory = $true)][string]$LanAllowedCidr,
  [string]$ReleaseTag = 'stable-11146'
)

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $packageRoot '.env'
$runtimeRoot = Join-Path $packageRoot '.runtime'
$upstreamRoot = Join-Path $packageRoot '.upstream'
$certificateRoot = Join-Path $packageRoot 'certs'

function New-Secret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    $rng.Dispose()
  }
  return ([BitConverter]::ToString($buffer).Replace('-', '')).ToLowerInvariant()
}

function Set-EnvValue([System.Collections.Generic.List[string]]$Lines, [string]$Name, [string]$Value) {
  $pattern = "^$([regex]::Escape($Name))="
  for ($index = 0; $index -lt $Lines.Count; $index++) {
    if ($Lines[$index] -match $pattern) { $Lines[$index] = "$Name=$Value"; return }
  }
  throw "模板缺少 $Name"
}

function Set-OrAddEnvValue([System.Collections.Generic.List[string]]$Lines, [string]$Name, [string]$Value) {
  $pattern = "^$([regex]::Escape($Name))="
  for ($index = 0; $index -lt $Lines.Count; $index++) {
    if ($Lines[$index] -match $pattern) { $Lines[$index] = "$Name=$Value"; return }
  }
  $Lines.Add("$Name=$Value")
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw '未找到 Docker Desktop CLI。请先安装并启动 Docker Desktop。' }
$composeVersion = & docker compose version 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 不可用。' }
$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($LanBindIp, [ref]$parsedAddress)) { throw 'LAN_BIND_IP 必须是 IPv4/IPv6 地址。' }
if ($LanBindIp -match '^(0\.0\.0\.0|127\.|169\.254\.)') { throw 'LAN_BIND_IP 不能是公网全绑定、回环或链路本地地址。' }
if (-not (Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -eq $LanBindIp)) { throw '该 LAN_BIND_IP 未配置在本机网卡上。' }
$ipv4Bytes = $parsedAddress.GetAddressBytes()
$isPrivateIpv4 = ($ipv4Bytes[0] -eq 10) -or
  ($ipv4Bytes[0] -eq 172 -and $ipv4Bytes[1] -ge 16 -and $ipv4Bytes[1] -le 31) -or
  ($ipv4Bytes[0] -eq 192 -and $ipv4Bytes[1] -eq 168)
if (-not $isPrivateIpv4) { throw 'LAN_BIND_IP 必须是 RFC1918 私有 IPv4 地址（10/8、172.16/12 或 192.168/16）。' }

if (-not (Test-Path $envPath)) { Copy-Item (Join-Path $packageRoot '.env.example') $envPath }
$lines = [System.Collections.Generic.List[string]](Get-Content $envPath)
$absolutePackagePath = $packageRoot.Replace('\', '/')
Set-EnvValue $lines 'LAN_BIND_IP' $LanBindIp
Set-EnvValue $lines 'LAN_ALLOWED_CIDR' $LanAllowedCidr
Set-EnvValue $lines 'PUBLIC_URL' "https://${LanBindIp}:8443"
Set-EnvValue $lines 'JITSI_RELEASE_TAG' $ReleaseTag
Set-EnvValue $lines 'JITSI_IMAGE_VERSION' $ReleaseTag
Set-EnvValue $lines 'CONFIG' "$absolutePackagePath/.runtime/config"
Set-EnvValue $lines 'TLS_CERT_PATH' "$absolutePackagePath/certs/meet.crt"
Set-EnvValue $lines 'TLS_KEY_PATH' "$absolutePackagePath/certs/meet.key"
Set-OrAddEnvValue $lines 'HTTP_PORT' '8000'
foreach ($key in 'MEET_JWT_SECRET','JICOFO_COMPONENT_SECRET','JICOFO_AUTH_PASSWORD','JVB_AUTH_PASSWORD','JIGASI_XMPP_PASSWORD','JIBRI_RECORDER_PASSWORD','JIBRI_XMPP_PASSWORD','JIGASI_TRANSCRIBER_PASSWORD') {
  $current = $lines | Where-Object { $_ -like "$key=*" } | Select-Object -First 1
  if (-not $current -or $current -match 'REPLACE_WITH') { Set-OrAddEnvValue $lines $key (New-Secret) }
}
Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8

$directories = 'web','prosody/config','prosody/prosody-plugins-custom','jicofo','jvb','jigasi','jibri','transcriber','storage/jibri','storage/prosody','storage/transcripts','storage/web','tmp/web-crontabs','tmp/web-load-test'
$directories | ForEach-Object { New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot "config/$_") | Out-Null }
New-Item -ItemType Directory -Force -Path $upstreamRoot,$certificateRoot | Out-Null

$zipPath = Join-Path $upstreamRoot "$ReleaseTag.zip"
if (-not (Test-Path (Join-Path $upstreamRoot 'docker-jitsi-meet'))) {
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  $downloadUri = "https://github.com/jitsi/docker-jitsi-meet/archive/refs/tags/$ReleaseTag.zip"
  $downloaded = $false
  foreach ($attempt in 1..3) {
    try {
      $curlPath = Join-Path $env:SystemRoot 'System32/curl.exe'
      if (Test-Path $curlPath) {
        & $curlPath --fail --location --retry 2 --retry-all-errors --connect-timeout 20 --output $zipPath $downloadUri
        if ($LASTEXITCODE -ne 0) { throw "curl 下载失败（退出码 $LASTEXITCODE）。" }
      } else {
        Invoke-WebRequest -Uri $downloadUri -OutFile $zipPath -MaximumRedirection 5
      }
      if ((Get-Item -LiteralPath $zipPath).Length -lt 1024) { throw '下载文件过小。' }
      $downloaded = $true
      break
    } catch {
      Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
      if ($attempt -eq 3) { throw "无法下载固定 Jitsi 上游版本 $ReleaseTag：$($_.Exception.Message)" }
      Start-Sleep -Seconds ($attempt * 2)
    }
  }
  if (-not $downloaded) { throw "无法下载固定 Jitsi 上游版本 $ReleaseTag。" }
  (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content -LiteralPath (Join-Path $upstreamRoot "$ReleaseTag.sha256") -Encoding ascii
  try {
    Expand-Archive -LiteralPath $zipPath -DestinationPath $upstreamRoot -Force
  } catch {
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    throw "下载的 Jitsi 上游 ZIP 无法解压：$($_.Exception.Message)"
  }
  $downloaded = Get-ChildItem $upstreamRoot -Directory | Where-Object Name -like 'docker-jitsi-meet-*' | Select-Object -First 1
  if (-not $downloaded) { throw '未找到下载的官方 Jitsi compose 文件。' }
  Rename-Item -LiteralPath $downloaded.FullName -NewName 'docker-jitsi-meet'
}

Copy-Item (Join-Path $packageRoot 'templates/custom-config.js') (Join-Path $runtimeRoot 'config/web/custom-config.js') -Force
$certificatePath = Join-Path $certificateRoot 'meet.crt'
$privateKeyPath = Join-Path $certificateRoot 'meet.key'
if (-not ((Test-Path $certificatePath) -and (Test-Path $privateKeyPath))) {
  Remove-Item -LiteralPath $certificatePath,$privateKeyPath -Force -ErrorAction SilentlyContinue
  $opensslCandidates = @(
    @{ Binary = 'C:\Program Files\Git\mingw64\bin\openssl.exe'; Config = 'C:\Program Files\Git\mingw64\etc\ssl\openssl.cnf' },
    @{ Binary = 'C:\Program Files\Git\usr\bin\openssl.exe'; Config = 'C:\Program Files\Git\usr\ssl\openssl.cnf' }
  )
  $openssl = $opensslCandidates | Where-Object { (Test-Path $_.Binary) -and (Test-Path $_.Config) } | Select-Object -First 1
  if (-not $openssl) { throw '缺少可用的 Git for Windows OpenSSL 与 openssl.cnf。请安装 Git for Windows 后重试；未生成证书不会启动会议。' }
  & $openssl.Binary req -config $openssl.Config -x509 -nodes -newkey rsa:2048 -sha256 -days 365 -keyout $privateKeyPath -out $certificatePath -subj "/CN=$LanBindIp" -addext "subjectAltName=IP:$LanBindIp"
  if ($LASTEXITCODE -ne 0) { throw '自签证书生成失败。' }
} else {
  Write-Host '检测到已有自签证书，保留不重建。'
}

foreach ($rule in @(
  @{ Name='LecPunch LAN Meet HTTPS'; Protocol='TCP'; Port='8443' },
  @{ Name='LecPunch LAN Meet Media'; Protocol='UDP'; Port='10000' }
)) {
  Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Profile Private -Protocol $rule.Protocol -LocalAddress $LanBindIp -LocalPort $rule.Port -RemoteAddress $LanAllowedCidr -ErrorAction Stop | Out-Null
}

$firewallRules = Get-NetFirewallRule -DisplayName 'LecPunch LAN Meet *' -ErrorAction Stop
if (@($firewallRules).Count -ne 2) { throw '未能确认两条局域网防火墙规则；不会启动会议。' }

Write-Host "初始化完成。先在每台参会设备信任 certs/meet.crt，再运行 scripts/Start-LanMeet.ps1。"

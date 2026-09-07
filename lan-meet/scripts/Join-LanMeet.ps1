#Requires -Version 5.1

[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9.-]+$')]
    [string]$ApiHost = '43.138.244.158',

    [ValidatePattern('^[A-Za-z0-9.-]+$')]
    [string]$MeetHost = '192.168.5.95',

    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')]
    [string]$Room = 'weekly-standup'
)

$ErrorActionPreference = 'Stop'
$apiBase = 'http' + '://' + $ApiHost + '/api'
$meetOrigin = 'https' + '://' + $MeetHost + ':8443'
$securePassword = $null
$bstr = [IntPtr]::Zero
$plainPassword = $null

try {
    $username = Read-Host 'LecPunch username'
    if ([string]::IsNullOrWhiteSpace($username)) {
        throw 'Username is required.'
    }

    $securePassword = Read-Host 'LecPunch password' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $loginBody = @{
        username = $username
        password = $plainPassword
    } | ConvertTo-Json -Compress

    $login = Invoke-RestMethod `
        -Method Post `
        -Uri ($apiBase + '/auth/login') `
        -ContentType 'application/json' `
        -Body $loginBody

    if (-not $login.accessToken) {
        throw 'Login failed: no access token was returned.'
    }

    $meeting = Invoke-RestMethod `
        -Method Get `
        -Uri ($apiBase + '/meet/token?room=' + [uri]::EscapeDataString($Room)) `
        -Headers @{ Authorization = ('Bearer ' + $login.accessToken) }

    if ($meeting.room -ne $Room -or $meeting.expiresInSeconds -ne 300 -or -not $meeting.token) {
        throw 'Meeting token response is invalid. The meeting will not be opened.'
    }

    $meetingUrl = $meetOrigin + '/' + $Room + '?jwt=' + [uri]::EscapeDataString([string]$meeting.token)
    Write-Host ('Token received for room "{0}". It expires in {1} seconds.' -f $meeting.room, $meeting.expiresInSeconds)
    Start-Process $meetingUrl
}
catch {
    Write-Error ('Could not open the LAN meeting: ' + $_.Exception.Message)
    exit 1
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $plainPassword = $null
}

param(
    [string]$PublicKeyFile,
    [string]$BindAddress = '0.0.0.0',
    [ValidateRange(1, 65535)]
    [int]$SshPort = 2222,
    [ValidateRange(1, 65535)]
    [int]$WebPort = 8000,
    [switch]$Disable
)

$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
if ($projectDir -notmatch '^[A-Za-z]:\\') { throw 'Run this script from the Windows project copy.' }
$localDir = Join-Path $projectDir '.local'
$configPath = Join-Path $localDir 'remote.json'
$encoding = New-Object System.Text.UTF8Encoding($false)

if ($Disable) {
    New-Item -ItemType Directory -Force -Path $localDir | Out-Null
    [IO.File]::WriteAllText($configPath, '{"enabled":false}', $encoding)
    & (Join-Path $PSScriptRoot 'deploy-local.ps1') -Port $WebPort
    Write-Output 'Remote SSH disabled. Project files and the persistent remote home are retained.'
    exit 0
}

if (!$PublicKeyFile) { throw 'Provide -PublicKeyFile pointing to your Mac SSH .pub file.' }
$address = [Net.IPAddress]::Parse($BindAddress)
if ($address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Provide an IPv4 bind address.' }
$key = (Get-Content -LiteralPath $PublicKeyFile -Raw).Replace("`r`n", "`n").Trim()
if (!$key -or @($key.Split("`n") | Where-Object { $_ -notmatch '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)\s+[A-Za-z0-9+/=]+(?:\s.*)?$' }).Count) {
    throw 'The file must contain SSH public keys, not private keys.'
}
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
[IO.File]::WriteAllText((Join-Path $localDir 'authorized_keys'), $key + "`n", $encoding)
$config = @{ enabled = $true; bindAddress = $BindAddress; port = $SshPort }
[IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json), $encoding)
& (Join-Path $PSScriptRoot 'deploy-local.ps1') -Port $WebPort
Write-Output "SSH enabled: user blog, port $SshPort; container project /app"
Write-Output 'For direct LAN browser access, also run scripts\configure-lan.ps1. SSH tunneling remains available.'
Write-Output "Allow LAN connections by running scripts\configure-lan-firewall.ps1 -Port $SshPort in an administrator PowerShell."

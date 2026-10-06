param(
    [string]$BindAddress = '0.0.0.0',
    [ValidateRange(1, 65535)]
    [int]$WebPort = 8000,
    [switch]$Disable
)

$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
if ($projectDir -notmatch '^[A-Za-z]:\\') { throw 'Run this script from the Windows project copy.' }
$address = [Net.IPAddress]::Parse($BindAddress)
if ($address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Provide an IPv4 bind address.' }
$localDir = Join-Path $projectDir '.local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$config = @{ enabled = !$Disable; bindAddress = $BindAddress }
$encoding = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $localDir 'lan.json'), ($config | ConvertTo-Json), $encoding)
& (Join-Path $PSScriptRoot 'deploy-local.ps1') -Port $WebPort
if ($Disable) {
    Write-Output 'LAN browser access disabled. Local browser access and SSH settings are retained.'
} else {
    Write-Output "Open http://<Windows-LAN-IP>:$WebPort/ from another computer on the local network."
    Write-Output "Allow the port with scripts\configure-lan-firewall.ps1 -Service HTTP -Port $WebPort in an administrator PowerShell."
}

param(
    [ValidateRange(1, 65535)]
    [int]$Port = 2222,
    [ValidateSet('SSH', 'HTTP')]
    [string]$Service = 'SSH',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Windows firewall changes require an administrator PowerShell. This rule only allows the chosen port from the local subnet on Private networks.'
}
$ruleName = "BlogByCodex-$Service-$Port"
if ($Remove) {
    Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Output "Removed firewall rule: $ruleName"
} elseif (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
    Set-NetFirewallRule -Name $ruleName -Enabled True -Profile Private -Direction Inbound -Action Allow
    Get-NetFirewallRule -Name $ruleName | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet
    Write-Output "Enabled firewall rule: $ruleName"
} else {
    New-NetFirewallRule -Name $ruleName -DisplayName "Blog By Codex $Service ($Port)" -Direction Inbound -Protocol TCP -LocalPort $Port -RemoteAddress LocalSubnet -Profile Private -Action Allow | Out-Null
    Write-Output "Allowed local subnet $Service on Private networks, TCP $Port."
}

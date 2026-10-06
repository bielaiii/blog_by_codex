param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Windows', 'WSL')]
    [string]$Mode,
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [string]$Distro = 'Ubuntu-24.04',
    [string]$WslUser = 'xiang',
    [string]$WslProjectPath
)

$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
if ($projectDir -notmatch '^[A-Za-z]:\\') {
    throw 'Run this script from the Windows project copy.'
}
$startup = Join-Path $PSScriptRoot 'windows-startup.ps1'

if ($Mode -eq 'Windows') {
    & (Join-Path $PSScriptRoot 'deploy-local.ps1') -Port $Port
    & $startup -Install -Mode Windows -ProjectPath $projectDir -Port $Port
    & $startup -Remove -Mode WSL
} else {
    # Both launch modes use the same checkout by default, preserving edits and Git state.
    if (!$WslProjectPath) {
        $WslProjectPath = '/mnt/' + $projectDir.Substring(0, 1).ToLowerInvariant() + '/' + $projectDir.Substring(3).Replace('\', '/')
    }
    & wsl.exe --distribution $Distro --user $WslUser --exec env ("BLOG_PORT=" + $Port) bash ($WslProjectPath.TrimEnd('/') + '/scripts/deploy-local.sh')
    if ($LASTEXITCODE -ne 0) { throw "WSL deployment failed with exit code $LASTEXITCODE" }
    & $startup -Install -Mode WSL -Distro $Distro -WslUser $WslUser -ProjectPath $WslProjectPath -Port $Port
    & $startup -Remove -Mode Windows
}

Write-Output "Active mode: $Mode; login startup updated; http://127.0.0.1:$Port"

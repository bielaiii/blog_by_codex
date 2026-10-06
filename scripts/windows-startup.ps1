param(
    [switch]$Install,
    [switch]$Remove,
    [ValidateSet('WSL', 'Windows')]
    [string]$Mode = 'WSL',
    [string]$Distro,
    [string]$WslUser,
    [string]$ProjectPath,
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$ProjectName = 'blog-by-codex-local'
)

$ErrorActionPreference = 'Stop'
if (!$PSBoundParameters.ContainsKey('Mode') -and (Split-Path $PSScriptRoot -Leaf) -eq 'BlogByCodexWindows') {
    $Mode = 'Windows'
}
$startupName = 'BlogByCodex'
if ($Mode -eq 'Windows') { $startupName = 'BlogByCodexWindows' }
$installDir = Join-Path $env:LOCALAPPDATA $startupName
$runner = Join-Path $installDir 'windows-startup.ps1'
$configPath = Join-Path $installDir 'config.json'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) ($startupName + '.lnk')

if ($Remove) {
    if (Test-Path $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    Write-Output 'Login startup removed. The current container is unchanged.'
    exit 0
}

if ($Install) {
    if ($Mode -eq 'WSL') {
        if (!$Distro -or !$WslUser -or !$ProjectPath -or !$ProjectPath.StartsWith('/')) {
            throw 'Provide -Distro, -WslUser, and an absolute Linux -ProjectPath.'
        }
        $config = @{ Mode = 'WSL'; Distro = $Distro; WslUser = $WslUser; ProjectPath = $ProjectPath; Port = $Port }
    } else {
        if (!$ProjectPath) { $ProjectPath = Join-Path $PSScriptRoot '..' }
        $ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).ProviderPath
        if ($ProjectPath -notmatch '^[A-Za-z]:\\' -or !(Test-Path -LiteralPath (Join-Path $ProjectPath 'scripts\deploy-local.ps1'))) {
            throw 'Provide a Windows project directory containing scripts\deploy-local.ps1.'
        }
        $config = @{ Mode = 'Windows'; ProjectPath = $ProjectPath; Port = $Port; ProjectName = $ProjectName }
    }
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    if ($PSCommandPath -ne $runner) { Copy-Item -LiteralPath $PSCommandPath -Destination $runner -Force }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'docker-local-env.ps1') -Destination $installDir -Force
    $config |
        ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
    $shortcut.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $runner + '"'
    $shortcut.WorkingDirectory = $installDir
    $shortcut.Save()
    Write-Output "Login startup installed: $shortcutPath"
    Write-Output "Log: $(Join-Path $installDir 'startup.log')"
    exit 0
}

$configPath = Join-Path $PSScriptRoot 'config.json'
$installDir = $PSScriptRoot
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
Start-Transcript -Path (Join-Path $installDir 'startup.log') -Append | Out-Null
try {
    $ready = $false
    # Docker Desktop must have 'Start Docker Desktop when you sign in' enabled.
    $nativeWindows = $config.Mode -eq 'Windows'
    if ($nativeWindows) {
        . (Join-Path $PSScriptRoot 'docker-local-env.ps1')
        $dockerExe = Get-BlogDockerExecutable
    }
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($nativeWindows) {
            $ready = Test-BlogDockerReady $dockerExe
        } else {
            # Starting WSL also makes the project's bind mount available after login.
            & wsl.exe --distribution $config.Distro --user $config.WslUser --exec bash -c 'timeout 5 docker info >/dev/null 2>&1 || timeout 5 docker.exe --context desktop-linux info >/dev/null 2>&1'
            $ready = $LASTEXITCODE -eq 0
        }
        if ($ready) { break }
        Start-Sleep -Seconds 5
    }
    if (!$ready) {
        if ($nativeWindows) { throw 'Docker Desktop Linux engine is unavailable.' }
        throw 'Docker is unavailable in WSL. Start Docker Desktop and enable the distro in Settings > Resources > WSL Integration.'
    }
    if ($nativeWindows) {
        & (Join-Path $config.ProjectPath 'scripts\deploy-local.ps1') -Port $config.Port -ProjectName $config.ProjectName
    } else {
        $wslPort = 8000
        if ($config.Port) { $wslPort = $config.Port }
        & wsl.exe --distribution $config.Distro --user $config.WslUser --exec env ("BLOG_PORT=" + $wslPort) bash ($config.ProjectPath.TrimEnd('/') + '/scripts/deploy-local.sh')
        if ($LASTEXITCODE -ne 0) { throw "Local deployment failed with exit code $LASTEXITCODE" }
    }
} catch {
    Write-Output "Startup failed: $($_.Exception.Message)"
    exit 1
} finally {
    Stop-Transcript | Out-Null
}

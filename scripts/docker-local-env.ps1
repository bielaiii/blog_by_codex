# Shared helpers for native Windows deployment and login startup.
function Get-BlogDockerExecutable {
    $command = Get-Command docker.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'),
        (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw 'Docker Desktop CLI was not found. Install Docker Desktop for Windows.'
}

function Test-BlogDockerReady([string]$Executable) {
    try {
        & $Executable --context desktop-linux info --format '{{.OSType}}' 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

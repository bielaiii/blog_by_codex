param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$ProjectName = 'blog-by-codex-local'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'docker-local-env.ps1')
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
if ($projectDir -match '^\\\\(wsl\$|wsl\.localhost)\\') {
    throw 'Copy the full project (including .git and vendor/) to a Windows drive before using this script.'
}
$dockerExe = Get-BlogDockerExecutable
if (!(Test-BlogDockerReady $dockerExe)) {
    throw 'Start Docker Desktop with its Linux engine before deploying.'
}
$composeArgs = @('compose', '--project-directory', $projectDir, '-f', (Join-Path $projectDir 'compose.yaml'), '-p', $ProjectName)
$previousSource = $env:BLOG_PROJECT_DIR
$previousPort = $env:BLOG_PORT
$previousHttpBind = $env:BLOG_HTTP_BIND
$previousSshBind = $env:BLOG_SSH_BIND
$previousSshPort = $env:BLOG_SSH_PORT
try {
    $env:BLOG_PROJECT_DIR = $projectDir
    $env:BLOG_PORT = [string]$Port
    $env:BLOG_HTTP_BIND = '127.0.0.1'
    $lanPath = Join-Path $projectDir '.local\lan.json'
    if (Test-Path -LiteralPath $lanPath) {
        $lan = Get-Content -LiteralPath $lanPath -Raw | ConvertFrom-Json
        if ($lan.enabled) {
            $lanAddress = [System.Net.IPAddress]::Parse($lan.bindAddress)
            if ($lanAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
                throw 'LAN access requires an IPv4 bind address.'
            }
            $env:BLOG_HTTP_BIND = $lan.bindAddress
        }
    }
    $remotePath = Join-Path $projectDir '.local\remote.json'
    if (Test-Path -LiteralPath $remotePath) {
        $remote = Get-Content -LiteralPath $remotePath -Raw | ConvertFrom-Json
        if ($remote.enabled) {
            $remoteAddress = [System.Net.IPAddress]::Parse($remote.bindAddress)
            if ($remoteAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or $remote.port -lt 1 -or $remote.port -gt 65535) {
                throw 'Remote access requires an IPv4 bind address and a valid SSH port.'
            }
            $env:BLOG_SSH_BIND = $remote.bindAddress
            $env:BLOG_SSH_PORT = [string]$remote.port
            $composeArgs += @('-f', (Join-Path $projectDir 'compose.remote.yaml'))
        }
    }
    $configJson = & $dockerExe --context desktop-linux @composeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Failed to resolve the Compose configuration.' }
    $config = ($configJson -join "`n") | ConvertFrom-Json
    $image = $config.services.blog.image
    & $dockerExe --context desktop-linux image inspect $image --format '{{.Id}}' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Local image $image is missing. Run docker compose build blog, import it with docker load, or use the WSL offline image script. This script will not pull images."
    }
    & $dockerExe --context desktop-linux @composeArgs up -d --no-build --pull never --wait --wait-timeout 60
    if ($LASTEXITCODE -ne 0) { throw 'Local deployment failed. Review the Docker Compose output above.' }
    Write-Output "Blog ready: http://127.0.0.1:$Port"
    Write-Output "Project files: $projectDir"
    if ($env:BLOG_HTTP_BIND -ne '127.0.0.1') { Write-Output "LAN access enabled on port $Port; use this Windows computer's LAN IP." }
} finally {
    $env:BLOG_PROJECT_DIR = $previousSource
    $env:BLOG_PORT = $previousPort
    $env:BLOG_HTTP_BIND = $previousHttpBind
    $env:BLOG_SSH_BIND = $previousSshBind
    $env:BLOG_SSH_PORT = $previousSshPort
}

param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'docker-local-env.ps1')
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$dockerExe = Get-BlogDockerExecutable
if (!(Test-BlogDockerReady $dockerExe)) { throw 'Start Docker Desktop with its Linux engine before building.' }
& $dockerExe --context desktop-linux compose --project-directory $projectDir -f (Join-Path $projectDir 'compose.yaml') build blog
if ($LASTEXITCODE -ne 0) { throw 'Runtime image build failed.' }
Write-Output 'Runtime image built locally. Run scripts\deploy-local.ps1 to deploy.'

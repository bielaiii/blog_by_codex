param(
  [string]$Root = 'C:\Users\amino\Documents\New project',
  [int]$Port = 8000
)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Preview server running at http://127.0.0.1:$Port"
function Get-ContentType($path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.js' { 'text/javascript; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.md' { 'text/markdown; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.svg' { 'image/svg+xml' }
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    default { 'application/octet-stream' }
  }
}
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    while ($reader.ReadLine()) {}
    $parts = $requestLine.Split(' ')
    $requestPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
    $requestPath = [Uri]::UnescapeDataString(($requestPath -split '\?')[0])
    if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq '/') { $requestPath = '/index.html' }
    $relativePath = $requestPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $Root $relativePath))
    if (-not $fullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $body = [Text.Encoding]::UTF8.GetBytes('Forbidden')
      $header = "HTTP/1.1 403 Forbidden`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $client.Close()
      continue
    }
    if ((Test-Path $fullPath) -and (Get-Item $fullPath).PSIsContainer) {
      $fullPath = Join-Path $fullPath 'index.html'
    }
    if (-not (Test-Path $fullPath)) {
      $body = [Text.Encoding]::UTF8.GetBytes('Not Found')
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $client.Close()
      continue
    }
    $body = [IO.File]::ReadAllBytes($fullPath)
    $header = "HTTP/1.1 200 OK`r`nContent-Type: $(Get-ContentType $fullPath)`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
    $client.Close()
  } catch {
    try { $client.Close() } catch {}
  }
}

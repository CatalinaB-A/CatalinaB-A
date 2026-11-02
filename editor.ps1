param(
  [int]$Port = 8780,
  [string]$Root = $PSScriptRoot,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path
$prefix = "http://127.0.0.1:$Port/"
$baseUrl = "http://127.0.0.1:$Port"

function Send-Json($context, $value, [int]$status = 200) {
  $json = $value | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $context.Response.StatusCode = $status
  $context.Response.ContentType = 'application/json; charset=utf-8'
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.OutputStream.Close()
}

function Send-Text($context, [string]$text, [int]$status = 200) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $context.Response.StatusCode = $status
  $context.Response.ContentType = 'text/plain; charset=utf-8'
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.OutputStream.Close()
}

function Run-Git([string[]]$gitArgs) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & git -C $Root @gitArgs 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  $text = ($output | Out-String).Trim()
  if (-not $text) { $text = "(sin salida)" }
  return @{ code = $code; text = $text }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host ""
Write-Host "  Editor local del sitio" -ForegroundColor Yellow
Write-Host "  $baseUrl/editor.html"
Write-Host "  Ctrl+C para detener."
Write-Host ""

if (-not $NoBrowser) {
  try { Start-Process "$baseUrl/editor.html" | Out-Null } catch { }
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.pdf'  = 'application/pdf'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ico'  = 'image/x-icon'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
      $method = $context.Request.HttpMethod

      if ($path -eq '/api/ping') {
        $branch = (Run-Git @('rev-parse', '--abbrev-ref', 'HEAD')).text
        Send-Json $context @{ ok = $true; root = $Root; branch = $branch; port = $Port }
        continue
      }

      if ($path -eq '/api/status') {
        $status = Run-Git @('status', '--short', '--branch')
        $last = Run-Git @('log', '-1', '--oneline')
        $remote = Run-Git @('remote', 'get-url', 'origin')
        Send-Json $context @{
          ok = $true
          branch = (Run-Git @('rev-parse', '--abbrev-ref', 'HEAD')).text
          status = $status.text
          last = $last.text
          remote = $remote.text
        }
        continue
      }

      if ($path -eq '/api/publish' -and $method -eq 'POST') {
        $origin = $context.Request.Headers['Origin']
        if ($origin -and $origin.TrimEnd('/') -ne $baseUrl) {
          Send-Json $context @{ ok = $false; log = 'Origen no permitido.' } 403
          continue
        }

        $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
        $reader.Dispose()

        try {
          $data = $body | ConvertFrom-Json
        } catch {
          Send-Json $context @{ ok = $false; log = 'JSON no válido.' } 400
          continue
        }

        $message = [string]$data.message
        $message = ($message -replace "`r?`n", ' ' -replace '\s+', ' ').Trim()
        if ([string]::IsNullOrWhiteSpace($message)) {
          Send-Json $context @{ ok = $false; log = 'El mensaje del commit está vacío.' } 400
          continue
        }
        if ($message.Length -gt 200) {
          $message = $message.Substring(0, 200)
        }

        $payload = [ordered]@{
          content = [ordered]@{
            site = $data.content.site
            library = $data.content.library
          }
          style = $data.style
        }
        $json = $payload | ConvertTo-Json -Depth 40
        $published = "/* Ediciones publicadas. Generado desde el editor local. */`nwindow.EDICIONES = $json;`n"
        $publishedPath = Join-Path $Root 'ediciones-publicadas.js'
        [System.IO.File]::WriteAllText($publishedPath, $published, (New-Object System.Text.UTF8Encoding($false)))

        $env:GIT_TERMINAL_PROMPT = '0'
        $add = Run-Git @('-c', 'core.autocrlf=false', 'add', '--', 'ediciones-publicadas.js')
        $commit = Run-Git @('-c', 'core.autocrlf=false', 'commit', '-m', $message, '--', 'ediciones-publicadas.js')
        if ($commit.code -ne 0) {
          Send-Json $context @{
            ok = $false
            stage = 'commit'
            log = ($add.text + "`n" + $commit.text)
            message = $message
          }
          continue
        }

        $push = Run-Git @('push', 'origin', 'main')
        Send-Json $context @{
          ok = ($push.code -eq 0)
          stage = 'push'
          message = $message
          log = ($commit.text + "`n" + $push.text)
        }
        continue
      }

      if ($method -ne 'GET') {
        Send-Text $context 'Método no permitido.' 405
        continue
      }

      if ($path -eq '/') { $path = '/index.html' }
      $relative = $path.TrimStart('/').Replace('/', '\')

      if ($relative -match '(^|\\)\.' -or $relative -match '\.(ps1|cmd)$') {
        Send-Text $context 'No encontrado.' 404
        continue
      }

      $full = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
      if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text $context 'Acceso denegado.' 403
        continue
      }
      if (-not (Test-Path $full -PathType Leaf)) {
        Send-Text $context 'No encontrado.' 404
        continue
      }

      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $context.Response.StatusCode = 200
      $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $context.Response.OutputStream.Close()
    } catch {
      try { Send-Json $context @{ ok = $false; log = $_.Exception.Message } 500 } catch { }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

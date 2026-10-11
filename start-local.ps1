$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8123
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

function Get-PdfIndex {
  $pdfRoot = Join-Path $root "expedientes"
  if (-not (Test-Path -LiteralPath $pdfRoot -PathType Container)) {
    throw "No existe la carpeta de documentos: $pdfRoot"
  }

  $files = @(Get-ChildItem -LiteralPath $pdfRoot -File -Recurse -Filter "*.pdf" -ErrorAction Stop)
  $signature = ($files | ForEach-Object {
    "$($_.FullName)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
  }) -join "`n"
  $sha256 = [Security.Cryptography.SHA256]::Create()
  $hashBytes = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($signature))
  $sha256.Dispose()
  $fingerprint = [Convert]::ToBase64String($hashBytes)
  $cacheDirectory = Join-Path $root ".cache"
  $cachePath = Join-Path $cacheDirectory "pdf-index.json"

  if (Test-Path -LiteralPath $cachePath -PathType Leaf) {
    try {
      $cached = Get-Content -LiteralPath $cachePath -Raw | ConvertFrom-Json
      if ($cached.fingerprint -eq $fingerprint) {
        return $cached.index
      }
    }
    catch {
      [Console]::Error.WriteLine("La caché del índice PDF está dañada; se regenerará: $($_.Exception.Message)")
    }
  }

  $entries = @($files | Sort-Object FullName | ForEach-Object {
    $relative = $_.FullName.Substring($pdfRoot.Length).TrimStart("\").Replace("\", "/")
    $encodedPath = (($relative -split "/") | ForEach-Object { [Uri]::EscapeDataString($_) }) -join "/"
    [PSCustomObject]@{
      name = $_.Name
      path = $relative
      url = "/expedientes/$encodedPath"
      size = $_.Length
      lastModified = $_.LastWriteTimeUtc.ToString("o")
    }
  })
  $index = [PSCustomObject]@{
    generatedAt = [DateTime]::UtcNow.ToString("o")
    count = $entries.Count
    files = $entries
  }
  New-Item -ItemType Directory -Path $cacheDirectory -Force | Out-Null
  $cached = [PSCustomObject]@{ fingerprint = $fingerprint; index = $index }
  $json = ConvertTo-Json -InputObject $cached -Depth 8 -Compress
  $temporaryPath = $cachePath + ".tmp"
  [IO.File]::WriteAllText($temporaryPath, $json, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporaryPath -Destination $cachePath -Force
  return $index
}

function Send-Bytes($response, [byte[]]$bytes, [string]$contentType, [int]$status = 200) {
  $response.StatusCode = $status
  $response.ContentType = $contentType
  $response.ContentLength64 = $bytes.LongLength
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-Json($response, $value) {
  $json = ConvertTo-Json -InputObject $value -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $response.Headers["Cache-Control"] = "no-cache"
  Send-Bytes $response $bytes "application/json; charset=utf-8"
}

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".pdf" { return "application/pdf" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".svg" { return "image/svg+xml" }
    ".ico" { return "image/x-icon" }
    default { return "application/octet-stream" }
  }
}

function Serve-File($context, [string]$path) {
  $response = $context.Response
  $item = Get-Item -LiteralPath $path -ErrorAction Stop
  $etag = '"' + $item.Length + "-" + $item.LastWriteTimeUtc.Ticks + '"'
  $response.Headers["ETag"] = $etag
  $response.Headers["Last-Modified"] = $item.LastWriteTimeUtc.ToString("r")
  $response.Headers["Cache-Control"] = if ($item.Extension -ieq ".pdf") {
    "private, max-age=0, must-revalidate"
  } else {
    "no-cache"
  }

  if ($context.Request.Headers["If-None-Match"] -eq $etag) {
    $response.StatusCode = 304
    return
  }

  $stream = [IO.File]::OpenRead($path)
  try {
    $start = [long]0
    $end = $stream.Length - 1
    $range = $context.Request.Headers["Range"]
    if ($range) {
      if ($range -notmatch "^bytes=(\d*)-(\d*)$") {
        $response.StatusCode = 416
        $response.Headers["Content-Range"] = "bytes */$($stream.Length)"
        return
      }
      if ($Matches[1]) { $start = [long]$Matches[1] }
      if ($Matches[2]) { $end = [long]$Matches[2] }
      elseif ($Matches[1]) { $end = $stream.Length - 1 }
      if (-not $Matches[1] -and $Matches[2]) {
        $length = [long]$Matches[2]
        $start = [Math]::Max(0, $stream.Length - $length)
      }
      if ($start -gt $end -or $start -ge $stream.Length) {
        $response.StatusCode = 416
        $response.Headers["Content-Range"] = "bytes */$($stream.Length)"
        return
      }
      $response.StatusCode = 206
      $response.Headers["Content-Range"] = "bytes $start-$end/$($stream.Length)"
    }

    $response.Headers["Accept-Ranges"] = "bytes"
    $response.ContentType = Get-ContentType $path
    $response.ContentLength64 = $end - $start + 1
    if ($context.Request.HttpMethod -eq "HEAD") { return }

    $stream.Position = $start
    $buffer = New-Object byte[] 65536
    $remaining = $response.ContentLength64
    while ($remaining -gt 0) {
      $read = $stream.Read($buffer, 0, [int][Math]::Min($buffer.Length, $remaining))
      if ($read -eq 0) { break }
      $response.OutputStream.Write($buffer, 0, $read)
      $remaining -= $read
    }
  }
  finally {
    $stream.Dispose()
  }
}

$listener.Start()
Write-Host "Web local: $prefix"
Write-Host "PDF encontrados: $((Get-PdfIndex).count)"
Write-Host "Presiona Ctrl+C para detener el servidor."

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ($requestPath -eq "/api/pdf-index") {
      if ($context.Request.HttpMethod -ne "GET") {
        $context.Response.StatusCode = 405
      } else {
        Send-Json $context.Response (Get-PdfIndex)
      }
    } else {
      $relative = $requestPath.TrimStart([char]"/").Replace("/", "\")
      $segments = $relative -split "\\"
      if ($segments | Where-Object { $_ -eq ".." -or $_.StartsWith(".") }) {
        $context.Response.StatusCode = 404
      } else {
        if (-not $relative) { $relative = "index.html" }
        $fullPath = [IO.Path]::GetFullPath((Join-Path $root $relative))
        $rootPrefix = [IO.Path]::GetFullPath($root).TrimEnd("\") + "\"
        $pdfPrefix = [IO.Path]::GetFullPath((Join-Path $root "expedientes")).TrimEnd("\") + "\"
        if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
          $context.Response.StatusCode = 403
        } elseif ($fullPath.StartsWith($pdfPrefix, [StringComparison]::OrdinalIgnoreCase) -and
            [IO.Path]::GetExtension($fullPath) -ine ".pdf") {
          $context.Response.StatusCode = 403
        } elseif ((Split-Path -Leaf $fullPath) -ieq "start-local.ps1") {
          $context.Response.StatusCode = 404
        } elseif (Test-Path -LiteralPath $fullPath -PathType Leaf) {
          if ($context.Request.HttpMethod -in @("GET", "HEAD")) {
            Serve-File $context $fullPath
          } else {
            $context.Response.StatusCode = 405
          }
        } else {
          $context.Response.StatusCode = 404
        }
      }
    }
  }
  catch {
    [Console]::Error.WriteLine("Error en solicitud local: $($_.Exception.Message)")
    try {
      $context.Response.StatusCode = 500
    }
    catch {
      [Console]::Error.WriteLine("No se pudo responder al cliente: $($_.Exception.Message)")
    }
  }
  finally {
    $context.Response.Close()
  }
}

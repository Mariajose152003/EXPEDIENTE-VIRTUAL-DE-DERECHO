$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8123
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

function Test-PdfFile([string]$path) {
  $stream = [IO.File]::OpenRead($path)
  try {
    $buffer = New-Object byte[] 1024
    $read = $stream.Read($buffer, 0, $buffer.Length)
    $header = [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    return $header -match '%PDF-\d\.\d'
  }
  finally {
    $stream.Dispose()
  }
}

function Get-PdfIndex {
  $pdfRoot = Join-Path $root "expedientes"
  if (-not (Test-Path -LiteralPath $pdfRoot -PathType Container)) {
    throw "No existe la carpeta de documentos: $pdfRoot"
  }

  $allFiles = @(Get-ChildItem -LiteralPath $pdfRoot -File -Recurse -Filter "*.pdf" -ErrorAction Stop)
  $files = @($allFiles | Where-Object { Test-PdfFile $_.FullName })
  $signature = "pdf-signature-v1`n" + (($allFiles | ForEach-Object {
    "$($_.FullName)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
  }) -join "`n")
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

  $invalidCount = $allFiles.Count - $files.Count
  if ($invalidCount) {
    Write-Warning "$invalidCount archivo(s) con extensión PDF no tienen una firma PDF válida y se omitieron."
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

function Send-Json($response, $value, [int]$status = 200) {
  $json = ConvertTo-Json -InputObject $value -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $response.Headers["Cache-Control"] = "no-cache"
  Send-Bytes $response $bytes "application/json; charset=utf-8" $status
}

function Import-EnvFile([string]$path) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return }
  Get-Content -LiteralPath $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or $line -notmatch "^([^=]+)=(.*)$") { return }
    $name = $Matches[1].Trim()
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Invoke-ChatApi([System.Net.HttpListenerContext]$context) {
  $apiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Process")
  if (-not $apiKey) {
    Send-Json $context.Response ([PSCustomObject]@{
      error = "OPENAI_API_KEY no configurada. Crea un archivo .env en la raíz del proyecto."
    }) 503
    return
  }

  $reader = [IO.StreamReader]::new($context.Request.InputStream, $context.Request.ContentEncoding)
  $rawBody = $reader.ReadToEnd()
  $reader.Dispose()
  $payload = $rawBody | ConvertFrom-Json
  $model = [Environment]::GetEnvironmentVariable("OPENAI_MODEL", "Process")
  if (-not $model) { $model = "gpt-4o-mini" }
  $apiBase = [Environment]::GetEnvironmentVariable("OPENAI_API_BASE", "Process")
  if (-not $apiBase) { $apiBase = "https://api.openai.com/v1" }

  $languageNames = @{ es = "Español"; qu = "Quechua"; ay = "Aymara" }
  $language = [string]$payload.language
  if (-not $languageNames.ContainsKey($language)) { $language = "es" }
  $systemPrompt = "Eres el asistente oficial de un expediente judicial académico. Responde de forma clara, útil y segura en $($languageNames[$language]). Puedes calcular operaciones matemáticas, explicar temas generales y responder preguntas básicas. No afirmes que eres un funcionario real ni inventes datos verificables. Usa el contexto proporcionado solo cuando sea relevante."
  $messages = @([PSCustomObject]@{ role = "system"; content = $systemPrompt })
  $messages += [PSCustomObject]@{ role = "system"; content = "Contexto académico del expediente: $($payload.context)" }
  if ($payload.history) {
    foreach ($item in $payload.history) {
      $messages += [PSCustomObject]@{ role = [string]$item.role; content = [string]$item.content }
    }
  }
  $messages += [PSCustomObject]@{ role = "user"; content = [string]$payload.message }

  $requestBody = [PSCustomObject]@{
    model = $model
    messages = $messages
    temperature = 0.4
  } | ConvertTo-Json -Depth 8 -Compress

  try {
    $headers = @{ Authorization = "Bearer $apiKey" }
    $responseApi = Invoke-RestMethod -Uri "$apiBase/chat/completions" -Method Post -Headers $headers -ContentType "application/json" -Body $requestBody -TimeoutSec 60
    $reply = [string]$responseApi.choices[0].message.content
    Send-Json $context.Response ([PSCustomObject]@{ reply = $reply })
  }
  catch {
    $detail = $_.ErrorDetails.Message
    if (-not $detail) { $detail = $_.Exception.Message }
    Send-Json $context.Response ([PSCustomObject]@{ error = "No se pudo consultar la API: $detail" }) 502
  }
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

Import-EnvFile (Join-Path $root ".env")

$listener.Start()
Write-Host "Web local: $prefix"
Write-Host "PDF encontrados: $((Get-PdfIndex).count)"
if ([Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Process")) {
  Write-Host "Chatbot: API configurada"
} else {
  Write-Host "Chatbot: modo local (configura OPENAI_API_KEY para habilitar la API)"
}
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
    } elseif ($requestPath -eq "/api/chat") {
      if ($context.Request.HttpMethod -ne "POST") {
        $context.Response.StatusCode = 405
        Send-Json $context.Response ([PSCustomObject]@{ error = "Método no permitido." })
      } else {
        Invoke-ChatApi $context
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

$port = 3000
$path = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "DCSS Multiplayer - Servidor rodando em: http://localhost:$port" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Gray

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".json" = "application/json"
    ".txt"  = "text/plain"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }

        $urlPath = [System.Uri]::UnescapeDataString($urlPath)
        $filePath = Join-Path $path $urlPath.TrimStart("/")
        $filePath = [System.IO.Path]::GetFullPath($filePath)

        if (-not $filePath.StartsWith([System.IO.Path]::GetFullPath($path))) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mimeType = $mimeTypes[$ext]
            if (-not $mimeType) { $mimeType = "application/octet-stream" }

            $response.ContentType = $mimeType
            $response.StatusCode = 200
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "no-cache")

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }

        $response.Close()

        $status = $response.StatusCode
        $reqPath = $request.Url.LocalPath
        if ($status -eq 200) {
            Write-Host "  [200] $reqPath" -ForegroundColor Green
        } elseif ($status -eq 404) {
            Write-Host "  [404] $reqPath" -ForegroundColor Yellow
        }
    }
} finally {
    $listener.Stop()
    Write-Host "Servidor parado."
}

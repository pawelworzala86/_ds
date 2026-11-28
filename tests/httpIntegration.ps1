$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
Push-Location $repository

$stdoutPath = Join-Path $env:TEMP "ds-http-$PID.stdout.log"
$stderrPath = Join-Path $env:TEMP "ds-http-$PID.stderr.log"
$server = $null

function Send-HttpRequest([string[]]$chunks) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', 3000)
        $stream = $client.GetStream()
        foreach ($chunk in $chunks) {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($chunk)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush()
            if ($chunks.Length -gt 1) {
                Start-Sleep -Milliseconds 30
            }
        }
        $client.Client.Shutdown([System.Net.Sockets.SocketShutdown]::Send)
        $response = New-Object System.IO.MemoryStream
        $buffer = New-Object byte[] 4096
        while (($received = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $response.Write($buffer, 0, $received)
        }
        return [System.Text.Encoding]::UTF8.GetString($response.ToArray())
    } finally {
        if ($stream) {
            $stream.Dispose()
        }
        $client.Dispose()
    }
}

function Assert-Status([string]$response, [int]$statusCode) {
    $status = ($response -split "`r`n", 2)[0]
    if (-not $status.StartsWith("HTTP/1.1 $statusCode ")) {
        throw "Expected HTTP $statusCode, received '$status'."
    }
}

try {
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 3000 is already in use; stop its listener before running this test.'
    }

    npm run compile .\examples\testhttp.ts .\dist\testhttp.exe > $null
    if ($LASTEXITCODE -ne 0) {
        throw "HTTP example compilation failed with exit code $LASTEXITCODE."
    }

    $server = Start-Process -FilePath (Join-Path $repository 'dist\testhttp.exe') `
        -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath
    $ready = $false
    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        if ($server.HasExited) {
            throw "HTTP server exited during startup with code $($server.ExitCode)."
        }
        if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
            $ready = $true
            break
        }
        Start-Sleep -Milliseconds 100
    }
    if (-not $ready) {
        throw 'HTTP server did not start listening on port 3000.'
    }

    $get = Send-HttpRequest @(
        "GET /?user=Alice+Smith&tag=one&tag=two&empty=&flag&encoded=hello%20world HTTP/1.1`r`nHost: localhost`r`nX-Test-Header: echo`r`nConnection: close`r`n`r`n"
    )
    $emptyGet = Send-HttpRequest @(
        "GET / HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n"
    )

    $textBody = 'plain text body'
    $textLength = [System.Text.Encoding]::UTF8.GetByteCount($textBody)
    $textHeader = "POST /text HTTP/1.1`r`nHost: localhost`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $textLength`r`nConnection: close`r`n`r`n"
    $text = Send-HttpRequest @($textHeader, $textBody)

    $jsonBody = '{"profile":{"name":"Mia","values":[5,8]}}'
    $jsonLength = [System.Text.Encoding]::UTF8.GetByteCount($jsonBody)
    $jsonHeader = "POST /json HTTP/1.1`r`nHost: localhost`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $jsonLength`r`nConnection: close`r`n`r`n"
    $json = Send-HttpRequest @($jsonHeader, '{"profile":', '{"name":"Mia","values":[5,8]}}')
    $problemHeader = "POST /problem HTTP/1.1`r`nHost: localhost`r`nContent-Type: APPLICATION/PROBLEM+JSON; charset=UTF-8`r`nContent-Length: $jsonLength`r`nConnection: close`r`n`r`n"
    $problem = Send-HttpRequest @($problemHeader, $jsonBody)

    $put = Send-HttpRequest @("PUT /put HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n")
    $patch = Send-HttpRequest @("PATCH /patch HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n")
    $delete = Send-HttpRequest @("DELETE /delete HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n")

    $badJSONBody = '{"broken":'
    $badJSONLength = [System.Text.Encoding]::UTF8.GetByteCount($badJSONBody)
    $badJSONHeader = "POST /bad HTTP/1.1`r`nHost: localhost`r`nContent-Type: application/json`r`nContent-Length: $badJSONLength`r`nConnection: close`r`n`r`n"
    $badJSON = Send-HttpRequest @($badJSONHeader, $badJSONBody)
    $badLength = Send-HttpRequest @("POST /bad-length HTTP/1.1`r`nHost: localhost`r`nContent-Length: nope`r`nConnection: close`r`n`r`n")
    $repeatedLength = Send-HttpRequest @("POST /bad-length HTTP/1.1`r`nHost: localhost`r`nContent-Length: 1`r`nContent-Length: 1`r`nConnection: close`r`n`r`n")
    $large = Send-HttpRequest @("POST /large HTTP/1.1`r`nHost: localhost`r`nContent-Length: 70000`r`nConnection: close`r`n`r`n")
    $chunked = Send-HttpRequest @("POST /chunked HTTP/1.1`r`nHost: localhost`r`nTransfer-Encoding: chunked`r`nConnection: close`r`n`r`n0`r`n`r`n")
    $oversizedHeader = 'A' * 65536
    $oversizedHeaders = Send-HttpRequest @($oversizedHeader)

    $responses = @($get, $emptyGet, $text, $json, $problem, $put, $patch, $delete, $badJSON, $badLength, $repeatedLength, $large, $chunked, $oversizedHeaders)
    $expectedStatuses = @(200, 200, 200, 200, 200, 200, 200, 200, 400, 400, 400, 413, 501, 431)
    for ($index = 0; $index -lt $responses.Length; $index++) {
        Assert-Status $responses[$index] $expectedStatuses[$index]
    }
    if (-not $get.Contains('X-Echo-Header: echo')) {
        throw 'Response did not echo X-Test-Header.'
    }

    Start-Sleep -Milliseconds 100
    $log = Get-Content -Raw $stdoutPath
    foreach ($expected in @('Alice Smith', '["one","two"]', 'hello world', 'plain text body', 'Mia', 'JSON body array: 5')) {
        if (-not $log.Contains($expected)) {
            throw "Server log did not contain '$expected'."
        }
    }
    Write-Output 'HTTP integration checks passed (query, body, methods, framing, and limits).'
} finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id
        $server.WaitForExit()
    }
    Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    Pop-Location
}

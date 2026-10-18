$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$pythonPath = Join-Path (Get-Location) '.venv/Scripts/python.exe'
if (-not (Test-Path $pythonPath)) { throw 'Run ./scripts/setup.ps1 first.' }
$api = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','agentvora.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru -RedirectStandardOutput 'data/api.stdout.log' -RedirectStandardError 'data/api.stderr.log'
try { Write-Host 'Agentvora: http://localhost:3000 | API logs: data/api.stderr.log'; npm.cmd run dev --prefix apps/web }
finally { if (-not $api.HasExited) { Stop-Process -Id $api.Id } }

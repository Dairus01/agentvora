$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
& .venv/Scripts/python.exe -m compileall -q apps/api/agentvora
& .venv/Scripts/python.exe -m pytest apps/api/tests -q
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
npm.cmd run typecheck --prefix apps/web
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
npm.cmd run test --prefix apps/web
if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
npm.cmd run build --prefix apps/web
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
Write-Host 'For browser tests: activate .venv, then cd apps/web; npm run e2e'

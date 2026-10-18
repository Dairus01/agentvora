$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
Get-Command node -ErrorAction Stop | Out-Null
Get-Command npm.cmd -ErrorAction Stop | Out-Null
$workspacePath = (Get-Location).Path
$activeDev = Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$workspacePath*" -and $_.CommandLine -like '*vite*' }
if ($activeDev) { throw 'Stop the Agentvora development server before running setup; Windows locks its native CSS modules while it runs.' }
if (-not (Test-Path .venv/Scripts/python.exe)) {
    if (Get-Command uv -ErrorAction SilentlyContinue) { uv venv --python 3.12 .venv }
    else { py -3.12 -m venv .venv }
    if ($LASTEXITCODE -ne 0) { throw "Python 3.12 is required. Install it or install uv." }
}
$pythonPath = Join-Path (Get-Location) '.venv/Scripts/python.exe'
if (Get-Command uv -ErrorAction SilentlyContinue) { uv pip install --python $pythonPath -r requirements.lock }
else { & $pythonPath -m pip install -r requirements.lock }
if ($LASTEXITCODE -ne 0) { throw "Backend install failed" }
if (Get-Command uv -ErrorAction SilentlyContinue) { uv pip install --python $pythonPath --no-deps -e apps/api -e vendor/TradingAgents }
else { & $pythonPath -m pip install --no-deps -e apps/api -e vendor/TradingAgents }
if ($LASTEXITCODE -ne 0) { throw "Local package install failed" }
npm.cmd ci --prefix apps/web
if ($LASTEXITCODE -ne 0) { throw "Frontend install failed" }
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
& $pythonPath -m alembic -c apps/api/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw "Migration failed" }
& $pythonPath scripts/build_source_package.py
Write-Host 'Setup complete. Add the agent service key to .env, then run ./scripts/dev.ps1'

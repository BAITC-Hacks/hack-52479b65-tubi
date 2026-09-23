$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -m venv .venv }
    elseif (Get-Command python -ErrorAction SilentlyContinue) { & python -m venv .venv }
    else { throw 'Install Python 3.11+ and run this script again.' }
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python environment.' }
}
& $pythonPath -m pip install -r server/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Could not install backend dependencies.' }
Push-Location web
try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Could not install frontend dependencies.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
Write-Host 'Tubi: http://127.0.0.1:8000  |  API: http://127.0.0.1:8000/docs'
& $pythonPath -m uvicorn app.main:app --app-dir server --host 127.0.0.1 --port 8000

# revit-mcp — one-command install for a client machine (Windows).
#
#   Demo (no Revit needed):   powershell -ExecutionPolicy Bypass -File .\install.ps1
#   Live (real Revit model):  powershell -ExecutionPolicy Bypass -File .\install.ps1 -Mode live
#
# It installs uv if missing, then auto-configures Claude Desktop. That's it —
# restart Claude Desktop and start prompting about the Revit model.

param(
  [ValidateSet("demo", "live")][string]$Mode = "demo",
  [string]$RevitHost = "127.0.0.1",
  [string]$Port = "8765"
)

$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot
Write-Host "revit-mcp installer  ·  mode: $Mode" -ForegroundColor Cyan
Write-Host ""

# 1) Ensure uv (fast Python runner; installs the server + its deps on demand).
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "[1/2] Installing uv..." -ForegroundColor Yellow
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}
else {
  Write-Host "[1/2] uv already installed." -ForegroundColor Green
}

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "uv was installed but isn't on PATH yet. Close and reopen PowerShell, then rerun this script." -ForegroundColor Red
  exit 1
}

# 2) Configure Claude Desktop (writes the config for you; merges, keeps a backup).
Write-Host "[2/2] Configuring Claude Desktop..." -ForegroundColor Yellow
uvx --from "$dir" revit-mcp configure --mode $Mode --host $RevitHost --port $Port

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  1. Fully quit and reopen Claude Desktop."
if ($Mode -eq "live") {
  Write-Host "  2. Open your project in Revit and start the listener from the pyRevit console:"
  Write-Host "       exec(open(r'$dir\revit_listener.py').read())"
  Write-Host "  3. Ask Claude about your model."
}
else {
  Write-Host "  2. Ask Claude about the sample Revit model (demo data)."
}

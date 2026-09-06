$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
    Write-Error "Quorum requires Node.js 18 or later."
    exit 1
}

& $node.Source (Join-Path $scriptDirectory "installer/install.mjs") @args
exit $LASTEXITCODE

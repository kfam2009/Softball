$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$source = Join-Path $root "scripts\streamdeck"
$outputs = Join-Path $root "outputs"
$packageRoot = Join-Path $outputs "Softball-NDI-StreamDeck"
$zipPath = Join-Path $outputs "Softball-NDI-StreamDeck.zip"

New-Item -ItemType Directory -Path $outputs -Force | Out-Null

if (Test-Path $packageRoot) {
  Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $packageRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "actions-vbs") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "actions-exe") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "icons") | Out-Null

Copy-Item -LiteralPath (Join-Path $outputs "STREAMDECK_SCOREBUG_README.txt") -Destination (Join-Path $packageRoot "README.txt") -Force
Copy-Item -Path (Join-Path $source "*.vbs") -Destination (Join-Path $packageRoot "actions-vbs") -Force
Copy-Item -Path (Join-Path $source "shortcuts-exe\*.exe") -Destination (Join-Path $packageRoot "actions-exe") -Force
Copy-Item -Path (Join-Path $source "icons\*.png") -Destination (Join-Path $packageRoot "icons") -Force

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -Force

Get-Item -LiteralPath $zipPath | Select-Object FullName, Length, LastWriteTime

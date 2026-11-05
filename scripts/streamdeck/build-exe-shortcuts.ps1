$ErrorActionPreference = "Stop"

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $base "shortcuts-exe"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$launcher = Join-Path $out "ScorebugActionLauncher.exe"
$source = Join-Path $base "ScorebugActionLauncher.cs"

$names = @(
  "SCOREBUG_IN",
  "SCOREBUG_OUT",
  "AWAY_PLUS",
  "AWAY_MINUS",
  "HOME_PLUS",
  "HOME_MINUS",
  "OUT_PLUS",
  "OUT_MINUS",
  "OUTS_CLEAR",
  "BASE_1",
  "BASE_2",
  "BASE_3",
  "BASES_CLEAR",
  "INNING_PLUS",
  "INNING_MINUS",
  "SET_PLUS",
  "SET_MINUS",
  "HALF_TOGGLE"
)

New-Item -ItemType Directory -Path $out -Force | Out-Null

& $csc /nologo /target:winexe /out:$launcher $source
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

foreach ($name in $names) {
  Copy-Item -LiteralPath $launcher -Destination (Join-Path $out "$name.exe") -Force
}

Remove-Item -LiteralPath $launcher -Force
Get-ChildItem -Path $out -Filter "*.exe" | Sort-Object Name | Select-Object Name, Length

$ErrorActionPreference = "Stop"

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $base "shortcuts"
New-Item -ItemType Directory -Path $out -Force | Out-Null

$actions = [ordered]@{
  "SCOREBUG_IN" = "scorebug-in"
  "SCOREBUG_OUT" = "scorebug-out"
  "AWAY_PLUS" = "away-plus"
  "AWAY_MINUS" = "away-minus"
  "HOME_PLUS" = "home-plus"
  "HOME_MINUS" = "home-minus"
  "OUT_PLUS" = "out-plus"
  "OUT_MINUS" = "out-minus"
  "OUTS_CLEAR" = "outs-clear"
  "BASE_1" = "base-first"
  "BASE_2" = "base-second"
  "BASE_3" = "base-third"
  "BASES_CLEAR" = "bases-clear"
  "INNING_PLUS" = "inning-plus"
  "INNING_MINUS" = "inning-minus"
  "SET_PLUS" = "set-plus"
  "SET_MINUS" = "set-minus"
  "HALF_TOGGLE" = "half-toggle"
}

$shell = New-Object -ComObject WScript.Shell

foreach ($item in $actions.GetEnumerator()) {
  $shortcut = $shell.CreateShortcut((Join-Path $out "$($item.Key).lnk"))
  $shortcut.TargetPath = Join-Path $env:WINDIR "System32\wscript.exe"
  $shortcut.Arguments = "`"$base\_run-action.vbs`" `"$($item.Value)`""
  $shortcut.WorkingDirectory = $base
  $shortcut.WindowStyle = 7
  $shortcut.Description = "Softball NDI $($item.Key)"
  $shortcut.Save()
}

Write-Host "OK: $out"

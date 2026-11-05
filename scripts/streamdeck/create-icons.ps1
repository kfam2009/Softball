$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $base "icons"
New-Item -ItemType Directory -Path $out -Force | Out-Null

function New-Icon {
  param(
    [string]$FileName,
    [string]$TopText,
    [string]$MainText,
    [string]$AccentHex,
    [string]$Kind = "score"
  )

  $size = 144
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg = [System.Drawing.Color]::FromArgb(18, 24, 31)
  $panel = [System.Drawing.Color]::FromArgb(28, 38, 48)
  $ink = [System.Drawing.Color]::FromArgb(246, 242, 232)
  $muted = [System.Drawing.Color]::FromArgb(190, 202, 207)
  $accent = [System.Drawing.ColorTranslator]::FromHtml($AccentHex)

  $graphics.Clear($bg)

  $cardBrush = New-Object System.Drawing.SolidBrush $panel
  $accentBrush = New-Object System.Drawing.SolidBrush $accent
  $inkBrush = New-Object System.Drawing.SolidBrush $ink
  $mutedBrush = New-Object System.Drawing.SolidBrush $muted

  $card = New-Object System.Drawing.Rectangle 10, 10, 124, 124
  $graphics.FillRectangle($cardBrush, $card)
  $graphics.FillRectangle($accentBrush, (New-Object System.Drawing.Rectangle 10, 10, 124, 12))

  $topFont = New-Object System.Drawing.Font "Arial", 18, ([System.Drawing.FontStyle]::Bold)
  $mainFont = New-Object System.Drawing.Font "Arial", 56, ([System.Drawing.FontStyle]::Bold)
  $baseFont = New-Object System.Drawing.Font "Arial", 48, ([System.Drawing.FontStyle]::Bold)
  $plusFont = New-Object System.Drawing.Font "Arial", 64, ([System.Drawing.FontStyle]::Bold)

  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $center.LineAlignment = [System.Drawing.StringAlignment]::Center

  if ($Kind -eq "base") {
    $graphics.DrawString($TopText, $topFont, $mutedBrush, (New-Object System.Drawing.RectangleF 12, 28, 120, 28), $center)
    $diamondPen = New-Object System.Drawing.Pen $accent, 7
    $points = @(
      (New-Object System.Drawing.Point 72, 55),
      (New-Object System.Drawing.Point 108, 91),
      (New-Object System.Drawing.Point 72, 127),
      (New-Object System.Drawing.Point 36, 91)
    )
    $graphics.DrawPolygon($diamondPen, $points)
    $graphics.DrawString($MainText, $baseFont, $inkBrush, (New-Object System.Drawing.RectangleF 24, 64, 96, 58), $center)
    $diamondPen.Dispose()
  } elseif ($Kind -eq "clear") {
    $graphics.DrawString($TopText, $topFont, $mutedBrush, (New-Object System.Drawing.RectangleF 12, 28, 120, 28), $center)
    $diamondPen = New-Object System.Drawing.Pen $accent, 6
    $crossPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 79, 94)), 8
    $points = @(
      (New-Object System.Drawing.Point 72, 51),
      (New-Object System.Drawing.Point 101, 80),
      (New-Object System.Drawing.Point 72, 109),
      (New-Object System.Drawing.Point 43, 80)
    )
    $graphics.DrawPolygon($diamondPen, $points)
    $graphics.DrawLine($crossPen, 55, 63, 89, 97)
    $graphics.DrawLine($crossPen, 89, 63, 55, 97)
    $graphics.DrawString($MainText, (New-Object System.Drawing.Font "Arial", 18, ([System.Drawing.FontStyle]::Bold)), $inkBrush, (New-Object System.Drawing.RectangleF 18, 111, 108, 22), $center)
    $diamondPen.Dispose()
    $crossPen.Dispose()
  } elseif ($Kind -eq "outs") {
    $graphics.DrawString($TopText, $topFont, $mutedBrush, (New-Object System.Drawing.RectangleF 12, 28, 120, 28), $center)
    $dotBrush = New-Object System.Drawing.SolidBrush $accent
    $graphics.FillEllipse($dotBrush, 27, 70, 28, 28)
    $graphics.FillEllipse($dotBrush, 58, 70, 28, 28)
    $graphics.DrawString($MainText, (New-Object System.Drawing.Font "Arial", 36, ([System.Drawing.FontStyle]::Bold)), $inkBrush, (New-Object System.Drawing.RectangleF 84, 57, 42, 56), $center)
    $dotBrush.Dispose()
  } elseif ($Kind -eq "outs-clear") {
    $graphics.DrawString($TopText, $topFont, $mutedBrush, (New-Object System.Drawing.RectangleF 12, 28, 120, 28), $center)
    $dotBrush = New-Object System.Drawing.SolidBrush $accent
    $crossPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 79, 94)), 8
    $graphics.FillEllipse($dotBrush, 36, 66, 26, 26)
    $graphics.FillEllipse($dotBrush, 82, 66, 26, 26)
    $graphics.DrawLine($crossPen, 43, 103, 101, 122)
    $graphics.DrawLine($crossPen, 101, 103, 43, 122)
    $graphics.DrawString($MainText, (New-Object System.Drawing.Font "Arial", 18, ([System.Drawing.FontStyle]::Bold)), $inkBrush, (New-Object System.Drawing.RectangleF 18, 108, 108, 24), $center)
    $dotBrush.Dispose()
    $crossPen.Dispose()
  } else {
    $graphics.DrawString($TopText, $topFont, $mutedBrush, (New-Object System.Drawing.RectangleF 12, 30, 120, 28), $center)
    $graphics.DrawString($MainText, $plusFont, $inkBrush, (New-Object System.Drawing.RectangleF 12, 54, 120, 72), $center)
  }

  $path = Join-Path $out $FileName
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
  $cardBrush.Dispose()
  $accentBrush.Dispose()
  $inkBrush.Dispose()
  $mutedBrush.Dispose()
  $topFont.Dispose()
  $mainFont.Dispose()
  $baseFont.Dispose()
  $plusFont.Dispose()
}

New-Icon -FileName "AWAY_PLUS.png" -TopText "AWAY" -MainText "+" -AccentHex "#00c756"
New-Icon -FileName "AWAY_MINUS.png" -TopText "AWAY" -MainText "-" -AccentHex "#00c756"
New-Icon -FileName "HOME_PLUS.png" -TopText "HOME" -MainText "+" -AccentHex "#0191e4"
New-Icon -FileName "HOME_MINUS.png" -TopText "HOME" -MainText "-" -AccentHex "#0191e4"
New-Icon -FileName "BASE_1.png" -TopText "BASE" -MainText "1" -AccentHex "#ffc83d" -Kind "base"
New-Icon -FileName "BASE_2.png" -TopText "BASE" -MainText "2" -AccentHex "#ffc83d" -Kind "base"
New-Icon -FileName "BASE_3.png" -TopText "BASE" -MainText "3" -AccentHex "#ffc83d" -Kind "base"
New-Icon -FileName "BASES_CLEAR.png" -TopText "BASES" -MainText "CLEAR" -AccentHex "#ffc83d" -Kind "clear"
New-Icon -FileName "OUT_PLUS.png" -TopText "OUT" -MainText "+" -AccentHex "#ff4f5e" -Kind "outs"
New-Icon -FileName "OUTS_CLEAR.png" -TopText "OUTS" -MainText "CLEAR" -AccentHex "#ff4f5e" -Kind "outs-clear"

Get-ChildItem -Path $out -Filter "*.png" | Sort-Object Name | Select-Object Name, Length

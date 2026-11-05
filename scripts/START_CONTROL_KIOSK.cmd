@echo off
setlocal

cd /d "%~dp0\.."

set "ROOT=%CD%"
set "B5_NDI_PORT=8136"
set "URL=http://localhost:%B5_NDI_PORT%/control.html"

echo Abriendo panel Softball NDI en navegador normal...
echo Panel: %URL%
echo.

start "" "%URL%"

endlocal

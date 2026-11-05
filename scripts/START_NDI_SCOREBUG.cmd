@echo off
setlocal

cd /d "%~dp0\.."

set "ROOT=%CD%"
set "ELECTRON=%ROOT%\node_modules\electron\dist\electron.exe"
set "B5_NDI_ENABLED=1"
set "B5_NDI_PORT=8136"
set "B5_NDI_FPS=30"
set "PORT="

if not exist "%ELECTRON%" (
  echo No encuentro Electron en:
  echo %ELECTRON%
  echo.
  echo Ejecuta REPARAR_DEPENDENCIAS.cmd o "npm install" en esta carpeta.
  pause
  exit /b 1
)

echo Iniciando Softball Scorebug como fuente NDI...
echo Fuente NDI: B5 Scorebug
echo Panel: http://localhost:8136/control.html
echo.

start "Softball NDI Scorebug" /min "%ELECTRON%" .

endlocal

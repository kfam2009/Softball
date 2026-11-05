@echo off
setlocal

cd /d "%~dp0\.."

set "ROOT=%CD%"
set "PORT=8136"
set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "C:\Users\claud\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE=C:\Users\claud\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE (
  echo No encuentro Node.js. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)

echo Iniciando Softball NDI (solo panel, sin NDI)...
echo Panel:  http://localhost:%PORT%/control.html
echo.

start "Softball NDI Server" /min "%NODE%" "%ROOT%\src\server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/control.html"

endlocal

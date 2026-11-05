@echo off
rem Arranca Panel GO Softball (fuente NDI + panel de control). Funciona con cualquier nombre de carpeta.
cd /d "%~dp0"
if exist "node_modules\electron\dist\electron.exe" goto start

rem 1) node_modules copiado de otra PC (pnpm): intentar reparar los accesos
if exist "node_modules\.pnpm" call "REPARAR_DEPENDENCIAS.cmd" >nul 2>&1
if exist "node_modules\electron\dist\electron.exe" goto start

rem 2) Instalacion limpia con npm
where node >nul 2>nul || (echo Falta Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
echo Electron no esta instalado o quedo roto. Reinstalando (necesita internet, puede tardar unos minutos)...
if exist "node_modules" rmdir /s /q "node_modules"
call npm install
if not exist "node_modules\electron\dist\electron.exe" (
  echo Descargando el programa de Electron...
  node "node_modules\electron\install.js"
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo ERROR: no se pudo instalar Electron. Revisa la conexion a internet o el antivirus y volve a intentar.
  pause
  exit /b 1
)

:start
call "scripts\START_NDI_SCOREBUG.cmd"
timeout /t 5 /nobreak >nul
start "" "http://localhost:8136/control.html"

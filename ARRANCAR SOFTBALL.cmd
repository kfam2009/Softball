@echo off
rem Arranca Panel GO Softball (fuente NDI + panel de control). Funciona con cualquier nombre de carpeta.
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  if exist "node_modules\.pnpm" (call "REPARAR_DEPENDENCIAS.cmd") else (
    echo Falta instalar. Ejecuta INSTALAR.cmd primero.
    pause
    exit /b 1
  )
)
call "scripts\START_NDI_SCOREBUG.cmd"
timeout /t 5 /nobreak >nul
start "" "http://localhost:8136/control.html"

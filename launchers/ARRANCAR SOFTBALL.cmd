@echo off
rem Arranca Panel GO Softball (fuente NDI + panel de control)
set "APP=%~dp0softball-ndi"
if not exist "%APP%\node_modules\electron\dist\electron.exe" call "%APP%\REPARAR_DEPENDENCIAS.cmd"
cd /d "%APP%"
call "scripts\START_NDI_SCOREBUG.cmd"
timeout /t 5 /nobreak >nul
start "" "http://localhost:8136/control.html"

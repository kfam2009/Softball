@echo off
rem Instala lo necesario para Panel GO Softball en una PC nueva.
cd /d "%~dp0"
echo === Panel GO Softball - instalacion ===
where node >nul 2>nul || (echo Falta Node.js. Instalalo desde https://nodejs.org y volve a correr este archivo. & pause & exit /b 1)
echo Instalando Electron y NDI (npm install)...
call npm install
if errorlevel 1 (echo ERROR en npm install. & pause & exit /b 1)
where python >nul 2>nul && (echo Instalando openpyxl para leer el Excel... & python -m pip install --user openpyxl) || echo AVISO: no encontre Python. Sin Python no funciona "Sync Excel". Instalalo desde https://python.org
if not exist "..\ARRANCAR SOFTBALL.cmd" copy /y "launchers\ARRANCAR SOFTBALL.cmd" ".." >nul
if not exist "..\PARAR SOFTBALL.cmd" copy /y "launchers\PARAR SOFTBALL.cmd" ".." >nul
if not exist "..\Datos.xlsx" copy /y "Datos-ejemplo.xlsx" "..\Datos.xlsx" >nul
echo.
echo Listo. Arranca con "ARRANCAR SOFTBALL.cmd" en la carpeta de arriba.
pause

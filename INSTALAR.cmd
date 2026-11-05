@echo off
rem Instala lo necesario para Panel GO Softball en una PC nueva.
cd /d "%~dp0"
echo === Panel GO Softball - instalacion ===
where node >nul 2>nul || (echo Falta Node.js. Instalalo desde https://nodejs.org y volve a correr este archivo. & pause & exit /b 1)
echo Instalando Electron y NDI (npm install)...
if exist "node_modules\.pnpm" (echo Borrando node_modules copiado de otra PC... & rmdir /s /q "node_modules")
call npm install
if errorlevel 1 (echo ERROR en npm install. & pause & exit /b 1)if not exist "node_modules\electron\dist\electron.exe" (
  echo Descargando el programa de Electron...
  node "node_modules\electron\install.js"
)
if not exist "node_modules\electron\dist\electron.exe" (echo ERROR: no se pudo descargar Electron. Revisa internet o el antivirus. & pause & exit /b 1)
where python >nul 2>nul && (echo Instalando openpyxl para leer el Excel... & python -m pip install --user openpyxl) || echo AVISO: no encontre Python. Sin Python no funciona "Sync Excel". Instalalo desde https://python.org
if not exist "..\Datos.xlsx" if not exist "Datos.xlsx" copy /y "Datos-ejemplo.xlsx" "Datos.xlsx" >nul
echo.
echo Listo. Arranca con "ARRANCAR SOFTBALL.cmd" (en esta misma carpeta).
echo Para el celular, ejecuta una vez ABRIR_FIREWALL.cmd como administrador.
pause

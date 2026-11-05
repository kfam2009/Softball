@echo off
setlocal

cd /d "%~dp0\.."

set "NODE=C:\Users\claud\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE%" (
  echo No encuentro Node en:
  echo %NODE%
  pause
  exit /b 1
)

echo Iniciando patron de prueba NDI...
echo Fuente NDI: B5 NDI Test Pattern
echo Duracion: 120 segundos
echo.

"%NODE%" scripts\ndi-test-pattern.mjs

pause
endlocal

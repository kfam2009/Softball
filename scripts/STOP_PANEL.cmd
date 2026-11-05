@echo off
setlocal

set "PORT=8136"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  echo Cerrando proceso en puerto %PORT%: %%p
  taskkill /PID %%p /F
)

echo Listo.
pause

endlocal

@echo off
setlocal

echo Cerrando Softball NDI Scorebug...

for /f "tokens=2 delims=," %%p in ('wmic process where "name='electron.exe' and commandline like '%%softball-ndi%%'" get ProcessId /format:csv ^| findstr /r "[0-9]"') do (
  echo Cerrando electron.exe PID %%p
  taskkill /PID %%p /F >nul 2>nul
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8136" ^| findstr "LISTENING"') do (
  echo Cerrando proceso en puerto 8136 PID %%p
  taskkill /PID %%p /F >nul 2>nul
)

echo Listo.
pause

endlocal

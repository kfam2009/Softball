@echo off
rem Permite que el celular (WiFi o ZeroTier) se conecte al panel. Ejecutar como ADMINISTRADOR.
net session >nul 2>&1
if errorlevel 1 (
  echo Hace clic derecho en este archivo y elegi "Ejecutar como administrador".
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="Panel GO Softball (8136)" >nul 2>&1
netsh advfirewall firewall add rule name="Panel GO Softball (8136)" dir=in action=allow protocol=TCP localport=8136 profile=any
netsh advfirewall firewall delete rule name="Panel GO Baseball5 (8135)" >nul 2>&1
netsh advfirewall firewall add rule name="Panel GO Baseball5 (8135)" dir=in action=allow protocol=TCP localport=8135 profile=any
echo.
echo Listo. Puertos 8136 (Softball) y 8135 (Baseball5) abiertos para todas las redes (WiFi y ZeroTier).
pause

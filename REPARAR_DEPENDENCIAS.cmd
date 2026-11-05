@echo off
rem Rehace los accesos (junctions) de pnpm despues de copiar la carpeta.
setlocal
set "NM=%~dp0node_modules"
echo Reparando dependencias de Softball NDI...
if exist "%NM%\electron" rmdir "%NM%\electron" 2>nul
mklink /J "%NM%\electron" "%NM%\.pnpm\electron@43.2.0\node_modules\electron" >nul
if exist "%NM%\grandi" rmdir "%NM%\grandi" 2>nul
mklink /J "%NM%\grandi" "%NM%\.pnpm\grandi@2.0.0\node_modules\grandi" >nul
if exist "%NM%\.pnpm\node_modules\debug" rmdir "%NM%\.pnpm\node_modules\debug" 2>nul
mklink /J "%NM%\.pnpm\node_modules\debug" "%NM%\.pnpm\debug@4.4.3\node_modules\debug" >nul
if exist "%NM%\.pnpm\node_modules\env-paths" rmdir "%NM%\.pnpm\node_modules\env-paths" 2>nul
mklink /J "%NM%\.pnpm\node_modules\env-paths" "%NM%\.pnpm\env-paths@3.0.0\node_modules\env-paths" >nul
if exist "%NM%\.pnpm\node_modules\graceful-fs" rmdir "%NM%\.pnpm\node_modules\graceful-fs" 2>nul
mklink /J "%NM%\.pnpm\node_modules\graceful-fs" "%NM%\.pnpm\graceful-fs@4.2.11\node_modules\graceful-fs" >nul
if exist "%NM%\.pnpm\node_modules\ms" rmdir "%NM%\.pnpm\node_modules\ms" 2>nul
mklink /J "%NM%\.pnpm\node_modules\ms" "%NM%\.pnpm\ms@2.1.3\node_modules\ms" >nul
if exist "%NM%\.pnpm\node_modules\node-gyp-build" rmdir "%NM%\.pnpm\node_modules\node-gyp-build" 2>nul
mklink /J "%NM%\.pnpm\node_modules\node-gyp-build" "%NM%\.pnpm\node-gyp-build@4.8.4\node_modules\node-gyp-build" >nul
if exist "%NM%\.pnpm\node_modules\progress" rmdir "%NM%\.pnpm\node_modules\progress" 2>nul
mklink /J "%NM%\.pnpm\node_modules\progress" "%NM%\.pnpm\progress@2.0.3\node_modules\progress" >nul
if exist "%NM%\.pnpm\node_modules\semver" rmdir "%NM%\.pnpm\node_modules\semver" 2>nul
mklink /J "%NM%\.pnpm\node_modules\semver" "%NM%\.pnpm\semver@7.8.5\node_modules\semver" >nul
if exist "%NM%\.pnpm\node_modules\sumchecker" rmdir "%NM%\.pnpm\node_modules\sumchecker" 2>nul
mklink /J "%NM%\.pnpm\node_modules\sumchecker" "%NM%\.pnpm\sumchecker@3.0.1\node_modules\sumchecker" >nul
if exist "%NM%\.pnpm\node_modules\undici" rmdir "%NM%\.pnpm\node_modules\undici" 2>nul
mklink /J "%NM%\.pnpm\node_modules\undici" "%NM%\.pnpm\undici@7.29.0\node_modules\undici" >nul
if exist "%NM%\.pnpm\node_modules\undici-types" rmdir "%NM%\.pnpm\node_modules\undici-types" 2>nul
mklink /J "%NM%\.pnpm\node_modules\undici-types" "%NM%\.pnpm\undici-types@7.18.2\node_modules\undici-types" >nul
if exist "%NM%\.pnpm\node_modules\@electron\get" rmdir "%NM%\.pnpm\node_modules\@electron\get" 2>nul
mklink /J "%NM%\.pnpm\node_modules\@electron\get" "%NM%\.pnpm\@electron+get@5.0.0\node_modules\@electron\get" >nul
if exist "%NM%\.pnpm\node_modules\@electron-internal\extract-zip" rmdir "%NM%\.pnpm\node_modules\@electron-internal\extract-zip" 2>nul
mklink /J "%NM%\.pnpm\node_modules\@electron-internal\extract-zip" "%NM%\.pnpm\@electron-internal+extract-zip@1.0.4\node_modules\@electron-internal\extract-zip" >nul
if exist "%NM%\.pnpm\node_modules\@grandi\win32-x64" rmdir "%NM%\.pnpm\node_modules\@grandi\win32-x64" 2>nul
mklink /J "%NM%\.pnpm\node_modules\@grandi\win32-x64" "%NM%\.pnpm\@grandi+win32-x64@2.0.0\node_modules\@grandi\win32-x64" >nul
if exist "%NM%\.pnpm\node_modules\@types\node" rmdir "%NM%\.pnpm\node_modules\@types\node" 2>nul
mklink /J "%NM%\.pnpm\node_modules\@types\node" "%NM%\.pnpm\@types+node@24.13.3\node_modules\@types\node" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\debug" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\debug" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\debug" "%NM%\.pnpm\debug@4.4.3\node_modules\debug" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\env-paths" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\env-paths" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\env-paths" "%NM%\.pnpm\env-paths@3.0.0\node_modules\env-paths" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\graceful-fs" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\graceful-fs" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\graceful-fs" "%NM%\.pnpm\graceful-fs@4.2.11\node_modules\graceful-fs" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\progress" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\progress" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\progress" "%NM%\.pnpm\progress@2.0.3\node_modules\progress" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\semver" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\semver" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\semver" "%NM%\.pnpm\semver@7.8.5\node_modules\semver" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\sumchecker" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\sumchecker" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\sumchecker" "%NM%\.pnpm\sumchecker@3.0.1\node_modules\sumchecker" >nul
if exist "%NM%\.pnpm\@electron+get@5.0.0\node_modules\undici" rmdir "%NM%\.pnpm\@electron+get@5.0.0\node_modules\undici" 2>nul
mklink /J "%NM%\.pnpm\@electron+get@5.0.0\node_modules\undici" "%NM%\.pnpm\undici@7.29.0\node_modules\undici" >nul
if exist "%NM%\.pnpm\@types+node@24.13.3\node_modules\undici-types" rmdir "%NM%\.pnpm\@types+node@24.13.3\node_modules\undici-types" 2>nul
mklink /J "%NM%\.pnpm\@types+node@24.13.3\node_modules\undici-types" "%NM%\.pnpm\undici-types@7.18.2\node_modules\undici-types" >nul
if exist "%NM%\.pnpm\debug@4.4.3\node_modules\ms" rmdir "%NM%\.pnpm\debug@4.4.3\node_modules\ms" 2>nul
mklink /J "%NM%\.pnpm\debug@4.4.3\node_modules\ms" "%NM%\.pnpm\ms@2.1.3\node_modules\ms" >nul
if exist "%NM%\.pnpm\grandi@2.0.0\node_modules\node-gyp-build" rmdir "%NM%\.pnpm\grandi@2.0.0\node_modules\node-gyp-build" 2>nul
mklink /J "%NM%\.pnpm\grandi@2.0.0\node_modules\node-gyp-build" "%NM%\.pnpm\node-gyp-build@4.8.4\node_modules\node-gyp-build" >nul
if exist "%NM%\.pnpm\grandi@2.0.0\node_modules\@grandi\win32-x64" rmdir "%NM%\.pnpm\grandi@2.0.0\node_modules\@grandi\win32-x64" 2>nul
mklink /J "%NM%\.pnpm\grandi@2.0.0\node_modules\@grandi\win32-x64" "%NM%\.pnpm\@grandi+win32-x64@2.0.0\node_modules\@grandi\win32-x64" >nul
if exist "%NM%\.pnpm\sumchecker@3.0.1\node_modules\debug" rmdir "%NM%\.pnpm\sumchecker@3.0.1\node_modules\debug" 2>nul
mklink /J "%NM%\.pnpm\sumchecker@3.0.1\node_modules\debug" "%NM%\.pnpm\debug@4.4.3\node_modules\debug" >nul
if exist "%NM%\.pnpm\electron@43.2.0\node_modules\@electron\get" rmdir "%NM%\.pnpm\electron@43.2.0\node_modules\@electron\get" 2>nul
mklink /J "%NM%\.pnpm\electron@43.2.0\node_modules\@electron\get" "%NM%\.pnpm\@electron+get@5.0.0\node_modules\@electron\get" >nul
if exist "%NM%\.pnpm\electron@43.2.0\node_modules\@electron-internal\extract-zip" rmdir "%NM%\.pnpm\electron@43.2.0\node_modules\@electron-internal\extract-zip" 2>nul
mklink /J "%NM%\.pnpm\electron@43.2.0\node_modules\@electron-internal\extract-zip" "%NM%\.pnpm\@electron-internal+extract-zip@1.0.4\node_modules\@electron-internal\extract-zip" >nul
if exist "%NM%\.pnpm\electron@43.2.0\node_modules\@types\node" rmdir "%NM%\.pnpm\electron@43.2.0\node_modules\@types\node" 2>nul
mklink /J "%NM%\.pnpm\electron@43.2.0\node_modules\@types\node" "%NM%\.pnpm\@types+node@24.13.3\node_modules\@types\node" >nul
if exist "%NM%\electron\dist\electron.exe" (echo Dependencias OK.) else (echo ERROR: no se pudo reparar Electron. & pause & exit /b 1)
endlocal

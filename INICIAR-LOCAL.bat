@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Instala Node.js 22 o superior. & pause & exit /b 1)
if not exist node_modules (echo Instalando dependencias... & call npm ci || (pause & exit /b 1))
node --watch --watch-preserve-output index.js
pause

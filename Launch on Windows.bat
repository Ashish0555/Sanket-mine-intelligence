@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 LTS from https://nodejs.org and run this launcher again.
 pause
 exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13))process.exit(1)"
if errorlevel 1 (
 echo Node.js 22.13 or later is required. Install Node.js 24 LTS.
 pause
 exit /b 1
)
if not exist node_modules\.bin\vinext.cmd (
 echo Installing dependencies. Internet is required for this first step.
 call npm ci
 if errorlevel 1 (
  echo Installation failed. Check your connection and Node.js version.
  pause
  exit /b 1
 )
)
if not exist .env copy .env.example .env >nul
echo Starting SANKET. Open the Local address printed below. Keep this window open.
call npm run dev
pause

@echo off
setlocal EnableDelayedExpansion
title Setlist Dashboard - Server  [leave this window open]
cd /d "%~dp0companion"

if "%HTTP_PORT%"==""   set "HTTP_PORT=8080"
if "%OSC_IN_PORT%"=="" set "OSC_IN_PORT=8000"

echo ============================================================
echo   Setlist Dashboard - Server
echo ============================================================
echo.

REM ------------------------------------------------------------------
REM Is Node.js present?
REM ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo         Please run INSTALL.bat first.
  echo.
  pause
  exit /b 1
)

REM ------------------------------------------------------------------
REM Is a server already running here? Avoid a double start.
REM ------------------------------------------------------------------
REM Deliberately NOT netstat + find "LISTENING": the state column is localised
REM and reads "ABHOEREN" on German Windows. Get-NetTCPConnection is language-neutral.
set "PORTBUSY="
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %HTTP_PORT% -State Listen -ErrorAction SilentlyContinue) { 'BUSY' }"`) do set "PORTBUSY=%%s"
if /I "!PORTBUSY!"=="BUSY" (
  echo [ATTENTION] Something is already running on port %HTTP_PORT%.
  echo             The server is probably up in another window already.
  echo             Dashboard:  http://localhost:%HTTP_PORT%
  echo.
  choice /C YN /N /M "Try to start anyway? [Y/N] "
  if errorlevel 2 exit /b 0
)

REM ------------------------------------------------------------------
REM Is another program holding the OSC input? The most common trip-up.
REM ------------------------------------------------------------------
set "OSCOWNER="
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "$e = Get-NetUDPEndpoint -LocalPort %OSC_IN_PORT% -ErrorAction SilentlyContinue; if ($e) { $p = Get-Process -Id $e[0].OwningProcess -ErrorAction SilentlyContinue; $p.ProcessName + ' / PID ' + $e[0].OwningProcess }"`) do set "OSCOWNER=%%s"
if defined OSCOWNER (
  echo [NOTE]    UDP port %OSC_IN_PORT% is held by:  !OSCOWNER!
  echo           If that is not this server, no OSC data from Chataigne
  echo           will arrive.
  echo.
)

REM ------------------------------------------------------------------
REM Open the browser after a short delay, then run the server in front
REM ------------------------------------------------------------------
echo Dashboard:  http://localhost:%HTTP_PORT%
echo OSC in:     port %OSC_IN_PORT%   Chataigne sends here
echo.
echo Leave this window open - closing it stops the server.
echo Stop with Ctrl+C.
echo.

start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:%HTTP_PORT%"

node server.js

echo.
echo Server stopped.
pause
endlocal

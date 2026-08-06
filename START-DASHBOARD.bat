@echo off
setlocal EnableDelayedExpansion
title Setlist Dashboard - Server  [Fenster offen lassen]
cd /d "%~dp0companion"

if "%HTTP_PORT%"==""   set "HTTP_PORT=8080"
if "%OSC_IN_PORT%"=="" set "OSC_IN_PORT=8000"

echo ============================================================
echo   Setlist Dashboard - Server
echo ============================================================
echo.

REM ------------------------------------------------------------------
REM Node.js vorhanden?
REM ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Node.js wurde nicht gefunden.
  echo          Bitte erst INSTALL.bat ausfuehren.
  echo.
  pause
  exit /b 1
)

REM ------------------------------------------------------------------
REM Laeuft hier schon ein Server? Doppelstart vermeiden.
REM ------------------------------------------------------------------
REM Bewusst NICHT ueber netstat + find "LISTENING": die Statusspalte ist lokalisiert
REM und heisst auf deutschem Windows "ABHOEREN". Get-NetTCPConnection ist sprachneutral.
set "PORTBUSY="
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %HTTP_PORT% -State Listen -ErrorAction SilentlyContinue) { 'BUSY' }"`) do set "PORTBUSY=%%s"
if /I "!PORTBUSY!"=="BUSY" (
  echo [ACHTUNG] Auf Port %HTTP_PORT% laeuft bereits etwas.
  echo           Vermutlich laeuft der Server schon in einem anderen Fenster.
  echo           Dashboard:  http://localhost:%HTTP_PORT%
  echo.
  choice /C JN /N /M "Trotzdem versuchen zu starten? [J/N] "
  if errorlevel 2 exit /b 0
)

REM ------------------------------------------------------------------
REM Belegt ein anderes Programm den OSC-Eingang? Haeufigster Stolperstein.
REM ------------------------------------------------------------------
set "OSCOWNER="
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "$e = Get-NetUDPEndpoint -LocalPort %OSC_IN_PORT% -ErrorAction SilentlyContinue; if ($e) { $p = Get-Process -Id $e[0].OwningProcess -ErrorAction SilentlyContinue; $p.ProcessName + ' / PID ' + $e[0].OwningProcess }"`) do set "OSCOWNER=%%s"
if defined OSCOWNER (
  echo [HINWEIS] UDP-Port %OSC_IN_PORT% ist belegt von:  !OSCOWNER!
  echo           Ist das nicht dieser Server, kommen keine OSC-Daten aus
  echo           Chataigne an.
  echo.
)

REM ------------------------------------------------------------------
REM Browser kurz verzoegert oeffnen, danach Server im Vordergrund
REM ------------------------------------------------------------------
echo Dashboard:  http://localhost:%HTTP_PORT%
echo OSC-In:     Port %OSC_IN_PORT%   Chataigne sendet hierher
echo.
echo Dieses Fenster offen lassen - Schliessen beendet den Server.
echo Beenden mit Strg+C.
echo.

start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:%HTTP_PORT%"

node server.js

echo.
echo Server beendet.
pause
endlocal

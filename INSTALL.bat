@echo off
setlocal EnableDelayedExpansion
title Setlist Dashboard - Installation
cd /d "%~dp0"

echo ============================================================
echo   Setlist Dashboard fuer Chataigne - Installation
echo ============================================================
echo.

set "FAIL=0"

REM ------------------------------------------------------------------
REM 1. Node.js vorhanden?
REM ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Node.js wurde nicht gefunden.
  echo.
  echo    Bitte die LTS-Version von https://nodejs.org installieren,
  echo    danach diese Datei erneut ausfuehren.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do set "NODEVER=%%v"
set "NODENUM=!NODEVER:v=!"
for /f "tokens=1 delims=." %%a in ("!NODENUM!") do set "NODEMAJOR=%%a"
if !NODEMAJOR! LSS 16 (
  echo [WARNUNG] Node !NODEVER! ist aelter als Version 16. Bitte aktualisieren.
  set "FAIL=1"
) else (
  echo [OK]      Node.js !NODEVER!
)

REM ------------------------------------------------------------------
REM 2. Chataigne-Modulordner ermitteln - OneDrive-sicher ueber die Shell
REM ------------------------------------------------------------------
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCS=%%d"
if not defined DOCS (
  echo [FEHLER] Der Dokumente-Ordner konnte nicht ermittelt werden.
  pause
  exit /b 1
)
set "MODDIR=!DOCS!\Chataigne\modules"

if not exist "!DOCS!\Chataigne" (
  echo [HINWEIS] "!DOCS!\Chataigne" existiert noch nicht.
  echo           Das ist normal, wenn Chataigne hier noch nie gestartet wurde -
  echo           der Ordner wird jetzt angelegt.
)

REM ------------------------------------------------------------------
REM 3. Modul kopieren
REM ------------------------------------------------------------------
echo.
echo Kopiere Modul "Setlist Index" nach:
echo    !MODDIR!\Setlist Index
xcopy "chataigne-module\Setlist Index\*" "!MODDIR!\Setlist Index\" /E /I /Y >nul
if errorlevel 1 (
  echo [FEHLER] Kopieren fehlgeschlagen. Laeuft Chataigne noch und sperrt die Datei?
  pause
  exit /b 1
)

if not exist "!MODDIR!\Setlist Index\module.json"     set "FAIL=1"
if not exist "!MODDIR!\Setlist Index\setlistIndex.js" set "FAIL=1"
if "!FAIL!"=="1" (
  echo [FEHLER] Nach dem Kopieren fehlen Dateien im Zielordner.
  pause
  exit /b 1
)
echo [OK]      module.json + setlistIndex.js liegen am Ziel.

REM ------------------------------------------------------------------
REM 4. Selbsttest der Logik
REM ------------------------------------------------------------------
echo.
if exist "test\engine.test.js" (
  echo Selbsttest:
  node "test\engine.test.js"
  if errorlevel 1 echo [WARNUNG] Der Selbsttest ist fehlgeschlagen. Installation trotzdem abgeschlossen.
) else (
  echo [INFO]    Kein Selbsttest in dieser Kopie enthalten - wird uebersprungen.
)

REM ------------------------------------------------------------------
REM 5. Laeuft Chataigne? Dann ist ein Neustart noetig.
REM ------------------------------------------------------------------
echo.
tasklist /FI "IMAGENAME eq Chataigne.exe" 2>nul | find /I "Chataigne.exe" >nul
if not errorlevel 1 (
  echo [ACHTUNG] Chataigne laeuft gerade.
  echo           Neue Module werden erst beim Start eingelesen - Chataigne
  echo           bitte einmal komplett schliessen und neu oeffnen.
) else (
  echo [OK]      Chataigne laeuft nicht - das Modul wird beim naechsten Start gefunden.
)

REM ------------------------------------------------------------------
REM 6. Optional: Verknuepfung auf den Desktop
REM ------------------------------------------------------------------
echo.
choice /C JN /N /M "Verknuepfung 'Setlist Dashboard' auf dem Desktop anlegen? [J/N] "
if errorlevel 2 goto :nolink
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut((Join-Path $d 'Setlist Dashboard.lnk')); $s.TargetPath='%~dp0START-DASHBOARD.bat'; $s.WorkingDirectory='%~dp0'; $s.Description='Setlist Dashboard Server starten'; $s.Save()"
if errorlevel 1 (
  echo [WARNUNG] Verknuepfung konnte nicht erstellt werden.
) else (
  echo [OK]      Verknuepfung liegt auf dem Desktop.
)
:nolink

REM ------------------------------------------------------------------
echo.
echo ============================================================
echo   Installation abgeschlossen
echo ============================================================
echo.
echo Naechste Schritte:
echo.
echo   1. Chataigne neu starten, dann:  Modules  ^>  +  ^>  Custom  ^>  Setlist Index
echo   2. Am Modul den OSC Output pruefen:  Local = an,
echo      Remote Host = 127.0.0.1,  Remote Port = 8000
echo   3. An jeden Song-State eine Consequence haengen:
echo         Command  ^>  Setlist Index  ^>  Set Current Song  ^>  Index = Songnummer
echo   4. Server starten mit  START-DASHBOARD.bat
echo.
pause
endlocal

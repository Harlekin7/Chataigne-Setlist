@echo off
setlocal EnableDelayedExpansion
title Setlist Dashboard - Install
cd /d "%~dp0"

echo ============================================================
echo   Setlist Dashboard for Chataigne - Install
echo ============================================================
echo.

set "FAIL=0"

REM ------------------------------------------------------------------
REM 1. Is Node.js present?
REM ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo.
  echo    Please install the LTS build from https://nodejs.org
  echo    and run this file again.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do set "NODEVER=%%v"
set "NODENUM=!NODEVER:v=!"
for /f "tokens=1 delims=." %%a in ("!NODENUM!") do set "NODEMAJOR=%%a"
if !NODEMAJOR! LSS 16 (
  echo [WARNING] Node !NODEVER! is older than version 16. Please update.
  set "FAIL=1"
) else (
  echo [OK]      Node.js !NODEVER!
)

REM ------------------------------------------------------------------
REM 2. Find the Chataigne module folder - OneDrive-safe, via the shell
REM ------------------------------------------------------------------
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCS=%%d"
if not defined DOCS (
  echo [ERROR] Could not determine your Documents folder.
  pause
  exit /b 1
)
set "MODDIR=!DOCS!\Chataigne\modules"

if not exist "!DOCS!\Chataigne" (
  echo [NOTE]    "!DOCS!\Chataigne" does not exist yet.
  echo           That is normal if Chataigne has never run here -
  echo           the folder will be created now.
)

REM ------------------------------------------------------------------
REM 3. Copy the module
REM ------------------------------------------------------------------
echo.
echo Copying the module "Setlist Index" to:
echo    !MODDIR!\Setlist Index
xcopy "chataigne-module\Setlist Index\*" "!MODDIR!\Setlist Index\" /E /I /Y >nul
if errorlevel 1 (
  echo [ERROR] Copying failed. Is Chataigne still running and locking the file?
  pause
  exit /b 1
)

if not exist "!MODDIR!\Setlist Index\module.json"     set "FAIL=1"
if not exist "!MODDIR!\Setlist Index\setlistIndex.js" set "FAIL=1"
if "!FAIL!"=="1" (
  echo [ERROR] Files are missing in the target folder after the copy.
  pause
  exit /b 1
)
echo [OK]      module.json + setlistIndex.js are in place.

REM ------------------------------------------------------------------
REM 4. Self-test of the logic
REM ------------------------------------------------------------------
echo.
if exist "test\engine.test.js" (
  echo Self-test:
  node "test\engine.test.js"
  if errorlevel 1 echo [WARNING] The self-test failed. Install completed anyway.
) else (
  echo [INFO]    No self-test bundled in this copy - skipping.
)

REM ------------------------------------------------------------------
REM 5. Is Chataigne running? Then it needs a restart.
REM ------------------------------------------------------------------
echo.
tasklist /FI "IMAGENAME eq Chataigne.exe" 2>nul | find /I "Chataigne.exe" >nul
if not errorlevel 1 (
  echo [ATTENTION] Chataigne is running right now.
  echo             New modules are only read at startup - please close
  echo             Chataigne completely and open it again.
) else (
  echo [OK]      Chataigne is not running - the module will be found on next start.
)

REM ------------------------------------------------------------------
REM 6. Optional: shortcut on the desktop
REM ------------------------------------------------------------------
echo.
choice /C YN /N /M "Create a 'Setlist Dashboard' shortcut on the desktop? [Y/N] "
if errorlevel 2 goto :nolink
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut((Join-Path $d 'Setlist Dashboard.lnk')); $s.TargetPath='%~dp0START-DASHBOARD.bat'; $s.WorkingDirectory='%~dp0'; $s.Description='Start the Setlist Dashboard server'; $s.Save()"
if errorlevel 1 (
  echo [WARNING] The shortcut could not be created.
) else (
  echo [OK]      The shortcut is on your desktop.
)
:nolink

REM ------------------------------------------------------------------
echo.
echo ============================================================
echo   Install complete
echo ============================================================
echo.
echo Next steps:
echo.
echo   1. Restart Chataigne, then:  Modules  ^>  +  ^>  Custom  ^>  Setlist Index
echo   2. Check the OSC output on the module:  Local = on,
echo      Remote Host = 127.0.0.1,  Remote Port = 8000
echo   3. Attach one consequence to every song state:
echo         Command  ^>  Setlist Index  ^>  Set Current Song  ^>  Index = song number
echo   4. Start the server with  START-DASHBOARD.bat
echo.
pause
endlocal

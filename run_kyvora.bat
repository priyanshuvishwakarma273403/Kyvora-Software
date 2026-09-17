@echo off
title Kyvora Studio Launcher
echo ===================================================
echo   Launching Kyvora Studio IDE...
echo ===================================================
echo.

cd /d "%~dp0kyvora"

set VSCODE_SKIP_PRELAUNCH=1
call scripts\code.bat %*

exit

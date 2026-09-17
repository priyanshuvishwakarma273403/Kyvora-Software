@echo off
title Kyvora Platform Starter
echo ===================================================
echo   Starting Kyvora Collaborative Platform...
echo ===================================================

echo.
echo [1/3] Loading environment variables from .env...
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%i in (".env") do (
        set "%%i=%%j"
    )
    echo [SUCCESS] Environment variables loaded!
) else (
    echo [WARNING] .env file not found. Make sure it is in the root directory!
)

echo.
echo [2/3] Starting Spring Boot Backend (Port 8080) in new window...
start "Kyvora Backend Server" cmd /k "cd kyvora-backend && mvnw.cmd spring-boot:run"

echo.
echo [3/3] Starting Next.js Frontend (Port 3000) in new window...
start "Kyvora Frontend Dev Server" cmd /k "cd Kyvora-Frontend && npm run dev"

echo [4/4] Starting Kyvora Studio IDE...
start "Kyvora Studio IDE" cmd /c "cd /d %~dp0kyvora && set VSCODE_SKIP_PRELAUNCH=1 && scripts\code.bat"

echo.
echo ===================================================
echo   Kyvora Services ^& Studio IDE Launched!
echo   Opening browser in 3 seconds...
echo ===================================================
timeout /t 3 /nobreak > nul
start http://localhost:3000

exit

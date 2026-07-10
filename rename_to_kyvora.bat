@echo off
title Kyvora Folder Renamer
echo ===================================================
echo             KYVORA FOLDER RENAMER
echo ===================================================
echo.
echo IMPORTANT: Please CLOSE your IDE (Cursor / VS Code) 
echo and any open terminals before proceeding. 
echo If the IDE is open, Windows will lock the folder
echo and prevent renaming.
echo.
echo Press any key when you have closed the IDE to start renaming...
pause > nul

echo.
echo [1/3] Renaming folder 'vscode' to 'kyvora'...
rename vscode kyvora

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not rename the folder. 
    echo Please make sure all files and folders inside 'vscode' are closed,
    echo and no terminal/editor is open in that directory, then try again.
    echo.
    pause
    exit /b %errorlevel%
)

echo SUCCESS: Folder renamed to 'kyvora'.
echo.
echo [2/3] Removing old git tracking reference for 'vscode'...
git rm --cached vscode

echo.
echo [3/3] Adding new git tracking reference for 'kyvora'...
git add kyvora

echo.
echo ===================================================
echo   Process completed successfully!
echo   You can now reopen your IDE/workspace.
echo ===================================================
echo.
pause

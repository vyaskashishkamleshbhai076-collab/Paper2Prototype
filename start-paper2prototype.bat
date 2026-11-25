@echo off
setlocal
title Paper2Prototype Launcher

set "ROOT=%~dp0"
set "FRONTEND_DIR=%ROOT%frontend"
set "SANDBOX_DIR=%ROOT%sandbox-runner"

echo ==================================================
echo   Paper2Prototype - One-Click Launcher
echo ==================================================
echo.

if not exist "%FRONTEND_DIR%\node_modules" (
  echo [1/3] Installing frontend dependencies...
  pushd "%FRONTEND_DIR%"
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed. Make sure Node.js is installed.
    popd
    pause
    exit /b 1
  )
  popd
) else (
  echo [1/3] Frontend dependencies already installed.
)

echo [2/3] Starting Local Sandbox Runner on port 8080...
where python >nul 2>nul
if errorlevel 1 (
  echo       Python not found on PATH - skipping Local Sandbox Runner.
  echo       Browser Sandbox ^(Pyodide^) will still work in the app!
) else (
  start "Paper2Prototype Local Sandbox (Port 8080)" /D "%SANDBOX_DIR%" cmd /k "python -m uvicorn server:app --host 127.0.0.1 --port 8080"
)

echo [3/3] Starting Frontend Dev Server on port 5173...
start "Paper2Prototype Frontend (Port 5173)" /D "%FRONTEND_DIR%" cmd /k "npx vite --port 5173 --host"

echo.
echo Waiting 3 seconds before opening browser...
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/"

echo.
echo Paper2Prototype is running!
echo   Frontend URL:      http://localhost:5173/
echo   Local Sandbox URL: http://localhost:8080/health
echo.
echo Close the two server windows ^(or run stop-paper2prototype.bat^) to stop.
endlocal

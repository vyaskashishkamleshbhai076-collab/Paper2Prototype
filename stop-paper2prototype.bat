@echo off
setlocal
title Stop Paper2Prototype

echo Stopping Paper2Prototype servers on ports 5173 and 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R ":5173 .*LISTENING :8080 .*LISTENING"') do (
  taskkill /F /PID %%a >nul 2>nul
)

echo Done. Ports 5173 and 8080 have been stopped.
timeout /t 2 /nobreak >nul
endlocal

@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python 3 nao foi encontrado. Instale Python 3 para Windows e tente novamente.
  pause
  exit /b 1
)
py -3 "%~dp0bridge.py" --config "%~dp0config.json"
if errorlevel 1 pause
endlocal

@echo off
setlocal

rem Configura ports e origem CORS
set PORT=3001
set ADAPTER_PORT=3002
set CORS_ORIGIN=http://localhost:8083

echo Iniciando todos os serviços...

rem Backend
start "Backend" cmd /k "npm run backend"
timeout /t 3 /nobreak >nul

rem Adapter
start "Adapter" cmd /k "npm run adapter"
timeout /t 3 /nobreak >nul

rem Frontend
start "Frontend" cmd /k "npm run dev"

echo Serviços sendo iniciados em janelas separadas.
echo Backend: http://localhost:%PORT%/
echo Adapter: http://localhost:%ADAPTER_PORT%/
echo Frontend: http://localhost:8083/

endlocal
exit /b 0
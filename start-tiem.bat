@echo off
REM Mo he thong Tiem giat la tren may Windows tai tiem (CACH 3 - khong Docker).
REM Dat file nay vao Task Scheduler (At log on) de tu bat khi mo may.
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" ( echo Chua co file .env - hay sao chep .env.example thanh .env roi dien thong tin. & pause & exit /b 1 )
if not exist "node_modules" ( echo Dang cai thu vien lan dau... & call npm install --omit=dev )
set NODE_ENV=production
:loop
node src/index.js
echo.
echo [%date% %time%] Server da dung, tu khoi dong lai sau 5 giay... (dong cua so de thoat)
timeout /t 5 >nul
goto loop

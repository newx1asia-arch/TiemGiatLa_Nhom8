@echo off
REM Sao luu database ra thu muc backups\ (dat vao Task Scheduler chay moi dem)
chcp 65001 >nul
cd /d "%~dp0"
call npm run backup

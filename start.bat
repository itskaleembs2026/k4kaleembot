@echo off
cd /d "%~dp0"
title WhatsApp Super Bot Pro - Owner: Kaleem Khan (923267004137)
color 0A
cls
echo ===================================================================
echo 👑 WHATSAPP SUPER BOT PRO - 1-CLICK INSTANT LAUNCHER
echo 👤 Owner: Kaleem Khan (923267004137)
echo 📥 k4_kaleem Downloader + Islamic Suite + AI Tools
echo 🌐 Web Dashboard: http://localhost:3000
echo ===================================================================
echo.

echo [1/3] 🧹 Cleaning up old processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/3] 🌐 Opening Web Dashboard in Browser...
start "" "http://localhost:3000"

echo [3/3] 🚀 Starting WhatsApp Bot Engine...
echo.

:LOOP
echo 🟢 [BOT ENGINE RUNNING] - Press Ctrl+C to stop
node index.js
echo.
echo ⚠️ [AUTO-RECOVERY] Bot stopped or restarted. Re-launching in 2 seconds...
timeout /t 2 /nobreak >nul
goto LOOP

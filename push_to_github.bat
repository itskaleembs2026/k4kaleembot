@echo off
title Push WhatsApp Bot to GitHub
color 0a
echo =========================================================
echo    Pushing WhatsApp Bot to GitHub: itskaleembs2026/k4kaleembot
echo =========================================================
echo.
cd /d "C:\Users\kaleem khan\Desktop\Whatsapp"

git branch -M main
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo =========================================================
    echo  SUCCESS! Tamam files GitHub par kamyabi se upload ho gayi hain!
    echo =========================================================
) else (
    echo.
    echo =========================================================
    echo  Agar Login ka browser window khula hai to "Sign in" karein.
    echo =========================================================
)
echo.
pause

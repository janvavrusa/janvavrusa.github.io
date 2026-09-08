@echo off
setlocal
cd /d "%~dp0"

echo [1/5] Kontrola repozitare...
git init || goto :error
git remote set-url origin https://github.com/janvavrusa/janvavrusa.github.io.git 2>nul || git remote add origin https://github.com/janvavrusa/janvavrusa.github.io.git

echo [2/5] Pridavani souboru do indexu...
git add . || goto :error

git diff --cached --quiet
if %errorlevel%==0 goto :empty_commit

echo [3/5] Vytvareni commitu se zmenami...
git commit -m "Update portfolio" || goto :error
goto :push

:empty_commit
echo [3/5] Repo je ciste, vytvarim retry commit pro GitHub Pages...
git commit --allow-empty -m "Retry GitHub Pages deployment" || goto :error

:push
echo [4/5] Odesilani na GitHub...
git push --set-upstream origin master || goto :error

echo [5/5] Hotovo. GitHub Pages deployment byl spusten.
pause
exit /b 0

:error
echo.
echo CHYBA: Deploy se nepodaril. Zkontrolujte vystup vyse.
pause
exit /b 1

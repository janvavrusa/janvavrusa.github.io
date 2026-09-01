@echo off
:: Tento skript zautomatizuje celou sekvenci Gitu, kterou jste provedli rucne.

echo [1/5] Inicializace repozitare...
git init

echo [2/5] Pridavani souboru do indexu...
git add .

echo [3/5] Vytvareni commitu...
git commit -m "my second big steps"

echo [4/5] Nastaveni spravne adresy vzdaleneho repozitare (origin)...
:: Pouzijeme set-url pro pripad, ze origin uz existuje, stejne jako ve vasem logu
git remote set-url origin https://github.com/vavjarch-lab/portfolio.git 2>nul || git remote add origin https://github.com/vavjarch-lab/portfolio.git

echo [5/5] Vynucene odesilani zmen na GitHub (master)...
git push --force-with-lease origin master

echo Hotovo!
pause

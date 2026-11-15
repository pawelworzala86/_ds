@echo off

npm run compile .\examples\%1.ts .\dist\%1.exe

if %errorlevel% neq 0 goto koniec

echo Wynik dzialania EXE:

cd dist
.\%1.exe
cd ..

@echo on

:koniec
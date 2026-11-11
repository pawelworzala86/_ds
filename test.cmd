@echo off

npm run test .\examples\test.ts .\dist\test.exe

if %errorlevel% neq 0 goto koniec

echo Wynik dzialania EXE:

cd dist
.\test.exe
cd ..

@echo on

:koniec
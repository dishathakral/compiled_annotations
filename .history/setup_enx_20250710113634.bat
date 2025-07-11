@echo off

REM Check if python exists
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python not found. Downloading Python 3.10.12 installer...

    REM Download Python 3.10.12 installer
    powershell -Command "Invoke-WebRequest -Uri https://www.python.org/ftp/python/3.10.12/python-3.10.12-amd64.exe -OutFile python-installer.exe"

    REM Install Python silently
    start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

    REM Clean up installer
    del python-installer.exe
) else (
    echo Python found.
)

REM Verify python version
python --version

REM Create virtual environment
python -m venv venv

REM Activate virtual environment
call venv\Scripts\activate

REM Upgrade pip
python -m pip install --upgrade pip

REM Install dependencies
pip install -r requirements.txt

echo.
echo ✅ Setup complete. Activate your virtual environment with:
echo call venv\Scripts\activate
pause

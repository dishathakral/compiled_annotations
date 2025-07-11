@echo off
setlocal EnableDelayedExpansion

REM ===========================================
REM Check if Python is installed
REM ===========================================
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Python not found. Downloading Python 3.10.12 installer...

    REM Download Python 3.10.12 installer
    powershell -Command "Invoke-WebRequest -Uri https://www.python.org/ftp/python/3.10.12/python-3.10.12-amd64.exe -OutFile python-installer.exe"

    REM Install Python silently
    start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

    REM Clean up installer
    del python-installer.exe

) else (
    REM ===========================================
    REM Check Python version
    REM ===========================================
    for /f "tokens=2 delims= " %%A in ('python --version') do (
        set PY_VERSION=%%A
    )

    REM Extract major and minor version numbers
    for /f "tokens=1,2 delims=." %%B in ("!PY_VERSION!") do (
        set PY_MAJOR=%%B
        set PY_MINOR=%%C
    )

    REM ===========================================
    REM If Python version not between 3.10 and 3.12, install 3.10.12
    REM ===========================================
    set NEED_INSTALL=0
    if !PY_MAJOR! LSS 3 (
        set NEED_INSTALL=1
    ) else if !PY_MAJOR! GTR 3 (
        set NEED_INSTALL=1
    ) else if !PY_MINOR! LSS 10 (
        set NEED_INSTALL=1
    ) else if !PY_MINOR! GEQ 12 (
        set NEED_INSTALL=1
    )

    if !NEED_INSTALL! EQU 1 (
        echo ❌ Incompatible Python version !PY_VERSION! detected. Installing Python 3.10.12...

        REM Download Python 3.10.12 installer
        powershell -Command "Invoke-WebRequest -Uri https://www.python.org/ftp/python/3.10.12/python-3.10.12-amd64.exe -OutFile python-installer.exe"

        REM Install Python silently
        start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

        REM Clean up installer
        del python-installer.exe
    ) else (
        echo ✅ Compatible Python version !PY_VERSION! found.
    )
)

REM ===========================================
REM Verify final Python version
REM ===========================================
python --version

REM ===========================================
REM Create virtual environment
REM ===========================================
python -m venv venv

REM Activate virtual environment
call venv\Scripts\activate

REM Upgrade pip
python -m pip install --upgrade pip

REM Install dependencies
pip install -r requirements.txt

echo.
echo ✅ All setup complete. Virtual environment ready.
echo To activate, run:
echo call venv\Scripts\activate
pause

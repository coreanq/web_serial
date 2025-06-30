@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM Windows Installation script for stdio-proxy Native Host
REM This script installs the native messaging host for Chrome extension

echo [INFO] Installing stdio-proxy Native Host for Windows...

REM Get the directory where this script is located
set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

REM Get Chrome Extension ID
set "EXTENSION_ID="
if exist "%DIR%\extension-id.txt" (
    set /p EXTENSION_ID=<"%DIR%\extension-id.txt"
    echo [INFO] Using Extension ID from file: !EXTENSION_ID!
) else (
    echo [WARNING] Extension ID file not found. Please create 'extension-id.txt' with your Chrome extension ID.
    echo    You can find your extension ID at chrome://extensions
    set /p "EXTENSION_ID=   Enter your Extension ID: "
    if not defined EXTENSION_ID (
        echo [ERROR] Extension ID cannot be empty. Installation aborted.
        pause
        exit /b 1
    )
    echo !EXTENSION_ID!>"%DIR%\extension-id.txt"
)

if not defined EXTENSION_ID (
    echo [ERROR] Extension ID is required. Installation aborted.
    pause
    exit /b 1
)

REM Create manifest content
set "EXECUTABLE_PATH=%DIR%\stdio-proxy-windows-x64.exe"

REM Native messaging host directories for different browsers
set "CHROME_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts"
set "CHROME_BETA_DIR=%LOCALAPPDATA%\Google\Chrome Beta\User Data\NativeMessagingHosts"
set "CHROME_DEV_DIR=%LOCALAPPDATA%\Google\Chrome Dev\User Data\NativeMessagingHosts"
set "CHROME_CANARY_DIR=%LOCALAPPDATA%\Google\Chrome SxS\User Data\NativeMessagingHosts"
set "EDGE_DIR=%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts"
set "BRAVE_DIR=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts"
set "OPERA_DIR=%APPDATA%\Opera Software\Opera Stable\NativeMessagingHosts"
set "VIVALDI_DIR=%LOCALAPPDATA%\Vivaldi\User Data\NativeMessagingHosts"
set "CHROMIUM_DIR=%LOCALAPPDATA%\Chromium\User Data\NativeMessagingHosts"

set INSTALLED_COUNT=0

REM Function to install manifest for a browser
call :InstallForBrowser "%CHROME_DIR%" "Chrome"
call :InstallForBrowser "%CHROME_BETA_DIR%" "Chrome Beta"
call :InstallForBrowser "%CHROME_DEV_DIR%" "Chrome Dev"
call :InstallForBrowser "%CHROME_CANARY_DIR%" "Chrome Canary"
call :InstallForBrowser "%EDGE_DIR%" "Microsoft Edge"
call :InstallForBrowser "%BRAVE_DIR%" "Brave Browser"
call :InstallForBrowser "%OPERA_DIR%" "Opera"
call :InstallForBrowser "%VIVALDI_DIR%" "Vivaldi"
call :InstallForBrowser "%CHROMIUM_DIR%" "Chromium"

if !INSTALLED_COUNT! equ 0 (
    echo [WARNING] No compatible browsers found. Installing for Chrome ^(default^)...
    mkdir "%CHROME_DIR%" 2>nul
    call :WriteManifest "%CHROME_DIR%\com.my_company.stdio_proxy.json"
    set /a INSTALLED_COUNT+=1
)

goto :SkipFunction

:InstallForBrowser
set "TARGET_DIR=%~1"
set "BROWSER_NAME=%~2"
set "BROWSER_BASE_DIR=%TARGET_DIR:\NativeMessagingHosts=%"

if exist "%BROWSER_BASE_DIR%" (
    mkdir "%TARGET_DIR%" 2>nul
    call :WriteManifest "%TARGET_DIR%\com.my_company.stdio_proxy.json"
    echo [OK] Installed for: %BROWSER_NAME%
    set /a INSTALLED_COUNT+=1
)
goto :eof

:WriteManifest
set "MANIFEST_FILE=%~1"
(
echo {
echo   "name": "com.my_company.stdio_proxy",
echo   "description": "stdio-proxy Native Messaging Host",
echo   "path": "!EXECUTABLE_PATH:\=\\!",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://!EXTENSION_ID!/"
echo   ]
echo }
) > "%MANIFEST_FILE%"
goto :eof

:SkipFunction

echo [SUCCESS] Installation completed!
echo.
echo [INFO] Files installed:
echo    • Executable: !EXECUTABLE_PATH!
echo    • Manifests installed for !INSTALLED_COUNT! browser^(s^).
echo.
echo [INFO] Supported browsers:
echo    • Chrome, Chrome Beta/Dev/Canary
echo    • Microsoft Edge
echo    • Brave Browser
echo    • Opera
echo    • Vivaldi
echo    • Chromium
echo.
echo [INFO] Next steps:
echo    1. Restart your browser completely
echo    2. Reload your extension
echo    3. Try connecting via TCP Native tab
echo.
echo [INFO] Troubleshooting:
echo    • Check Windows Event Viewer for errors
echo    • Verify Extension ID: !EXTENSION_ID!
echo.
pause
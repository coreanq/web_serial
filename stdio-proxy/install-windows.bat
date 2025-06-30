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

REM Register in Windows Registry for Chrome and Edge
echo [INFO] Registering in Windows Registry...
call :RegisterInRegistry

goto :SkipFunction

:RegisterInRegistry
set "MANIFEST_PATH=%DIR%\com.my_company.stdio_proxy.json"

REM Create manifest file for registry
call :WriteManifest "%MANIFEST_PATH%"

set REG_SUCCESS_COUNT=0

REM Register for all Chromium-based browsers
call :RegisterBrowserInRegistry "Google\Chrome" "Chrome"
call :RegisterBrowserInRegistry "Microsoft\Edge" "Edge"
call :RegisterBrowserInRegistry "BraveSoftware\Brave-Browser" "Brave"
call :RegisterBrowserInRegistry "Opera Software\Opera Stable" "Opera"
call :RegisterBrowserInRegistry "Vivaldi" "Vivaldi"
call :RegisterBrowserInRegistry "Chromium" "Chromium"

if !REG_SUCCESS_COUNT! equ 0 (
    echo [WARNING] No registry entries were created successfully
    echo [INFO] Attempting system-wide registration...
    call :RegisterSystemWide
) else (
    echo [OK] Successfully registered for !REG_SUCCESS_COUNT! browser^(s^) in registry
)

goto :eof

:RegisterBrowserInRegistry
set "BROWSER_PATH=%~1"
set "BROWSER_NAME=%~2"
set "REG_PATH=HKEY_CURRENT_USER\Software\%BROWSER_PATH%\NativeMessagingHosts\com.my_company.stdio_proxy"

reg add "%REG_PATH%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Registered in %BROWSER_NAME% registry
    set /a REG_SUCCESS_COUNT+=1
) else (
    echo [WARNING] Failed to register in %BROWSER_NAME% registry
)
goto :eof

:RegisterSystemWide
REM Try system-wide registration for main browsers
set "CHROME_SYSTEM_REG=HKEY_LOCAL_MACHINE\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.my_company.stdio_proxy"
reg add "%CHROME_SYSTEM_REG%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Registered in Chrome system registry
)

set "EDGE_SYSTEM_REG=HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Edge\NativeMessagingHosts\com.my_company.stdio_proxy"
reg add "%EDGE_SYSTEM_REG%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Registered in Edge system registry
)

set "BRAVE_SYSTEM_REG=HKEY_LOCAL_MACHINE\SOFTWARE\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.my_company.stdio_proxy"
reg add "%BRAVE_SYSTEM_REG%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Registered in Brave system registry
)

goto :eof

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
echo    • Manifests installed for !INSTALLED_COUNT! browser^(s^)
echo    • Registry entries created for all supported browsers
echo    • Main manifest: !MANIFEST_PATH!
echo.
echo [INFO] Supported browsers:
echo    • Chrome, Chrome Beta/Dev/Canary
echo    • Microsoft Edge
echo    • Brave Browser
echo    • Opera
echo    • Vivaldi
echo    • Chromium
echo.
echo [INFO] Installation methods used:
echo    • Native Messaging Host manifest files
echo    • Windows Registry entries ^(recommended^)
echo.
echo [INFO] Next steps:
echo    1. Restart your browser completely
echo    2. Reload your extension
echo    3. Try connecting via TCP Native tab
echo.
echo [INFO] Troubleshooting:
echo    • Check Windows Event Viewer for errors
echo    • Verify Extension ID: !EXTENSION_ID!
echo    • Registry entries: HKCU\Software\Google\Chrome\NativeMessagingHosts\
echo    • If issues persist, run as Administrator
echo.
pause
@echo off
chcp 65001 >nul
echo [FitMirror] 최신 코드 받는 중...
git pull origin master
if %errorlevel% neq 0 (
    echo [오류] git pull 실패. 위 오류 메시지를 확인하세요.
    pause
    exit /b 1
)

echo.
echo [FitMirror] 패키지 설치 중...
cd fitmirror
npm install
if %errorlevel% neq 0 (
    echo [오류] npm install 실패.
    pause
    exit /b 1
)

echo.
echo [FitMirror] 서버 시작 중... 브라우저에서 http://localhost:5173 열어주세요.
npm run dev

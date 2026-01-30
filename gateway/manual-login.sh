#!/bin/bash

# Chrome Remote Desktop에서 실행할 수동 로그인 스크립트

MASTER_PROFILE="/home/jhkim/00.Projects/ChinaSearch/gateway/.playwright-master-profile"

echo "======================================"
echo "ChatGPT 수동 로그인 스크립트"
echo "======================================"
echo ""
echo "1. Chrome 브라우저가 열립니다"
echo "2. ChatGPT에 로그인하세요"
echo "3. 로그인 후 브라우저를 닫으세요"
echo "4. 완료!"
echo ""
echo "시작합니다..."
sleep 2

# Chromium 또는 Google Chrome으로 마스터 프로필 열기
if [ -f "/usr/bin/chromium" ]; then
    chromium --user-data-dir="$MASTER_PROFILE" "https://chatgpt.com" &
elif [ -f "/opt/google/chrome/chrome" ]; then
    /opt/google/chrome/chrome --user-data-dir="$MASTER_PROFILE" "https://chatgpt.com" &
elif [ -f "/usr/bin/google-chrome" ]; then
    google-chrome --user-data-dir="$MASTER_PROFILE" "https://chatgpt.com" &
else
    echo "ERROR: Chrome 또는 Chromium을 찾을 수 없습니다"
    exit 1
fi

echo ""
echo "✅ 브라우저가 열렸습니다!"
echo "✅ ChatGPT에 로그인한 후 브라우저를 닫으세요"
echo ""
echo "로그인 후 이 스크립트는 자동으로 종료됩니다."

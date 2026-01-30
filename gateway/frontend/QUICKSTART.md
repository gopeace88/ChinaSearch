# Quick Start Guide

Gateway Frontend를 빠르게 실행하는 방법입니다.

## 1분 시작 가이드

### 1. 개발 서버 실행

```bash
cd /home/jhkim/00.Projects/ChinaSearch/gateway/frontend
npm run dev
```

브라우저에서 http://localhost:3003 접속

### 2. 백엔드 서버 확인

Gateway 백엔드가 http://localhost:3001 에서 실행 중인지 확인하세요.

```bash
# 다른 터미널에서
cd /home/jhkim/00.Projects/ChinaSearch/gateway
npm start
```

## 화면 구성

### 1. 세션 목록 (`/`)

- 모든 세션을 카드 형태로 표시
- 상태별 필터링 (전체/진행중/완료/실패)
- 새 세션 시작 버튼

### 2. 새 세션 시작 (`/new`)

1. 연구 주제 입력 (최소 10자)
2. 반복 횟수 선택 (3/5/10)
3. "세션 시작" 버튼 클릭

### 3. 세션 상세 (`/sessions/:id`)

**진행 중인 세션:**
- 실시간 로그 (3초마다 자동 업데이트)
- 진행률 표시
- 일시정지/재개/취소 버튼

**완료된 세션:**
- 최종 보고서
- 전체 분석 과정
- 다운로드 버튼

## 주요 기능

### 세션 제어

```
일시정지: 진행 중인 세션을 일시 중단
재개: 일시정지된 세션을 다시 시작
취소: 세션을 완전히 중단
```

### 실시간 모니터링

- 3초 간격으로 자동 폴링
- 새로운 로그가 추가되면 자동 표시
- 진행률 바 실시간 업데이트

### 보고서 다운로드

완료된 세션의 "다운로드" 버튼을 클릭하면 JSON 형식의 보고서를 저장할 수 있습니다.

## 모바일 테스트

### Chrome DevTools

1. F12 (개발자 도구 열기)
2. Ctrl+Shift+M (디바이스 툴바 토글)
3. 디바이스 선택 (iPhone 14, Galaxy S21 등)

### 실제 모바일 기기

1. 같은 네트워크에 연결
2. PC의 로컬 IP 주소 확인 (예: 192.168.1.100)
3. 모바일 브라우저에서 http://192.168.1.100:3003 접속

## 문제 해결

### API 연결 실패

```bash
# 백엔드 서버가 실행 중인지 확인
curl http://localhost:3001/api/sessions

# 프록시 설정 확인
cat vite.config.ts
```

### 빌드 오류

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 포트 충돌

```bash
# vite.config.ts에서 포트 변경
server: {
  port: 3004,  // 다른 포트로 변경 (예시)
  ...
}
```

## 다음 단계

- [README.md](./README.md) - 전체 문서
- [MOBILE_DESIGN.md](./MOBILE_DESIGN.md) - 디자인 가이드
- 백엔드 API 문서 - `/home/jhkim/00.Projects/ChinaSearch/gateway/README.md`

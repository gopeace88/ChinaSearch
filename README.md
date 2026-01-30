# ChinaSearch

ChatGPT 심층리서치를 자동화하는 Chrome Extension + Gateway 시스템.

사람이 GPT 심층리서치를 반복 활용하는 패턴(질문 → 보고서 확인 → 후속 질문 → 반복)을 자동화합니다.

## 아키텍처

```
┌─────────────┐     WebSocket      ┌─────────────┐     HTTP      ┌─────────────┐
│   Chrome     │◄──────────────────►│   Gateway    │◄────────────►│  모바일 웹   │
│  Extension   │    ws://3004/ws    │  (Node.js)   │  :3003 Vite  │    UI        │
└──────┬───────┘                    └──────┬───────┘              └─────────────┘
       │                                   │
       │ Content Script                    │ SQLite
       ▼                                   ▼
┌─────────────┐                    ┌─────────────┐
│   ChatGPT   │                    │  세션 DB +   │
│   웹페이지   │                    │  파일 저장   │
└─────────────┘                    └─────────────┘
```

## 리서치 파이프라인 (라운드당)

1. **ChatGPT 응답 대기** — ChatGPT가 심층리서치 보고서 생성
2. **보고서 읽기** — Content Script가 DOM에서 보고서 텍스트 추출
3. **GLM 핵심 사실 추출** — GLM-4.7이 보고서에서 검증 가능한 사실 추출
4. **Brave 웹 검색** — 추출된 사실에 대해 독립적 소스 검색
5. **Claude 종합 분석** — Claude Sonnet이 보고서 + 검색 결과 종합 분석, 후속 질문 생성
6. **후속 질문 입력** — ChatGPT에 다음 질문 자동 입력 및 제출
7. **반복** — 설정된 라운드 수만큼 반복

## 구성 요소

### Chrome Extension (`src/`)

- **Service Worker** (`background/`) — 세션 상태 관리, LLM 호출, 폴링 루프
- **Content Script** (`content/`) — ChatGPT 페이지 DOM 읽기/쓰기
- **Side Panel** (`sidepanel/`) — 진행 상황 표시, 설정, 세션 제어

### Gateway (`gateway/`)

- **Express + WebSocket** 서버 (포트 3004)
- Extension과 양방향 통신 (세션 시작/취소/진행 상황)
- SQLite 세션 저장, 파일 업로드, 보고서 관리
- **모바일 웹 UI** (Vite + React, 포트 3003) — Extension과 동일한 실시간 진행 표시

### Claude Proxy

- `claude-max-api-proxy` (포트 3456)
- Claude CLI를 OpenAI-호환 API로 래핑
- 세션 기반 대화 지원 (`--resume`)

## 사용하는 API

| API | 용도 |
|-----|------|
| GLM-4.7 (z.ai) | 핵심 사실 추출 |
| Brave Search | 독립적 소스 검색 |
| Claude Sonnet (로컬 프록시) | 종합 분석 + 후속 질문 생성 |
| ChatGPT (웹 자동화) | 심층리서치 보고서 생성 |

## 설치 및 실행

### 1. Extension 빌드

```bash
npm install
npm run build
```

Chrome에서 `chrome://extensions` → 개발자 모드 → `dist/` 폴더 로드

### 2. Gateway 실행

```bash
cd gateway
npm install
npm run build
node dist/index.js
```

### 3. 모바일 UI 실행

```bash
cd gateway/frontend
npm install
npm run dev
```

### 4. Claude 프록시 실행

```bash
node ~/.nvm/versions/node/v22.22.0/lib/node_modules/claude-max-api-proxy/dist/server/standalone.js 3456
```

### 5. Extension 설정

Side Panel → Settings에서 GLM API Key 입력

## 포트 정리

| 포트 | 서비스 |
|------|--------|
| 3003 | 모바일 웹 UI (Vite dev) |
| 3004 | Gateway (Express + WebSocket) |
| 3456 | Claude 프록시 |

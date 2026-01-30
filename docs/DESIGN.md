# ChinaSearch 설계 문서

**버전**: 1.0.0
**최종 업데이트**: 2026년 1월
**언어**: 한국어

---

## 1. 프로젝트 개요

### 1.1 목적

ChinaSearch는 ChatGPT의 **Deep Research** 기능을 자동화하고 검증하는 Chrome Extension + Gateway 시스템입니다. 사용자가 수동으로 반복하는 "질문 → 보고서 검토 → 후속 질문 → 반복" 패턴을 완전히 자동화합니다.

### 1.2 핵심 아이디어

1. **자동화**: ChatGPT Deep Research의 반복 프로세스를 완전 자동화
2. **검증**: GLM + Brave Search로 ChatGPT 보고서의 사실 검증
3. **종합 분석**: Claude Sonnet이 ChatGPT 보고서 + 검색 결과를 종합 분석하여 지능형 후속 질문 생성
4. **진행 추적**: 브라우저 확장 프로그램과 모바일 웹 UI 양쪽에서 실시간 진행 상황 모니터링

### 1.3 주요 특징

- **Chrome Extension** (Manifest V3): ChatGPT 자동화, 상태 관리, LLM 통합
- **Gateway Server** (Node.js + Express): 세션 관리, WebSocket 통신, SQLite 저장
- **모바일 웹 UI**: 데스크톱 브라우저에서 세션 모니터링 및 제어
- **다중 LLM 파이프라인**: GLM (사실 추출) → Brave (검증) → Claude (종합 분석)
- **세션 기반 대화**: Claude 프록시를 통한 세션별 독립적인 컨텍스트 유지

---

## 2. 시스템 아키텍처

### 2.1 전체 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │   Chrome Extension   │         │   ChatGPT 웹페이지   │     │
│  ├──────────────────────┤         └──────────────────────┘     │
│  │ • Service Worker     │◄────────► DOM 읽기/쓰기              │
│  │ • Content Script     │                                     │
│  │ • Side Panel UI      │                                     │
│  └──────────┬───────────┘                                     │
│             │ WebSocket ws://localhost:3004/ws                 │
│             │                                                  │
└─────────────┼──────────────────────────────────────────────────┘
              │
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                   Gateway Server (Node.js)                      │
│                      포트: 3004 (Express)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ WebSocket Server (/ws)                                  │  │
│  │ • Extension 메시지 수신 (START_SESSION, PROGRESS_UPDATE) │  │
│  │ • 세션 제어 명령 송신                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ REST API (/api/sessions)                                │  │
│  │ • POST /  — 세션 생성                                     │  │
│  │ • GET /   — 세션 목록                                     │  │
│  │ • GET /:id — 세션 상세                                    │  │
│  │ • POST /:id/pause, /resume, /cancel, /stop              │  │
│  │ • GET /:id/progress — 실시간 진행 상황                   │  │
│  │ • GET /:id/report — 최종 보고서 다운로드                  │  │
│  │ • POST /:id/files, GET /:id/files — 파일 관리             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Database (SQLite)                                       │  │
│  │ • sessions table                                        │  │
│  │ • gateway.db                                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Session Manager                                         │  │
│  │ • Playwright Controller (Extension 기반)                 │  │
│  │ • 세션 디렉토리 (uploads/, reports/)                      │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────┬──────────────────────────────────────────────────┘
              │ HTTP :3003
              │
┌─────────────▼──────────────────────────────────────────────────┐
│           모바일 웹 UI (React + Vite)                           │
│                포트: 3003 (Vite dev)                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  • SessionList — 모든 세션 목록                                │
│  • SessionDetail — 선택된 세션 모니터링                          │
│  • NewSession — 새 세션 생성 폼                                │
│  • 실시간 진행 로그 및 분석 결과 표시                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘

                        외부 API 호출
                        ───────────

┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  GLM-4.7         │  │  Brave Search      │  │  Claude Sonnet   │
│  (z.ai API)      │  │  (api.search.brave)│  │  (로컬 프록시)    │
│                  │  │                    │  │  localhost:3456  │
│ • 사실 추출       │  │ • 웹 검색          │  │ • 종합 분석      │
│ • 키워드 추출    │  │ • 검증             │  │ • 후속 질문 생성 │
└──────────────────┘  └────────────────────┘  └──────────────────┘
```

### 2.2 컴포넌트 관계

| 컴포넌트 | 역할 | 통신 방식 |
|---------|------|----------|
| **Service Worker** | 세션 상태 머신, LLM 호출, 폴링 루프 관리 | 내부 함수, 타이머 |
| **Content Script** | ChatGPT DOM 조작, 보고서 추출 | chrome.tabs.sendMessage |
| **Side Panel** | 확장 프로그램 UI, 사용자 제어 | chrome.runtime.sendMessage |
| **Gateway Server** | 세션 저장, REST API, WebSocket 중개 | HTTP, WebSocket |
| **모바일 웹 UI** | 세션 모니터링, 제어 | REST API (Axios) |
| **Claude 프록시** | Claude CLI 래핑 (OpenAI 호환 API) | HTTP POST |

### 2.3 통신 흐름

#### 2.3.1 세션 시작 (사용자가 Side Panel에서)

```
사용자
  ↓ Start Research 클릭
Side Panel (SettingsPanel)
  ↓ "START_SESSION" 메시지
Service Worker (상태 머신)
  ↓ 1. ChatGPT 탭 찾기
  ↓ 2. Content Script 주입/확인
  ↓ 3. 세션 객체 생성 (WAITING_RESEARCH 상태)
  ↓ 4. 폴링 시작
Content Script
  ↓ 주제 입력 및 제출
ChatGPT (웹페이지)
  ↓ Deep Research 시작
```

#### 2.3.2 라운드별 분석 흐름

```
Polling Loop (5초 간격)
  ↓ CHECK_RESEARCH_STATUS → Content Script → ChatGPT DOM
  ↓ (스트리밍 중이면 다시 대기)
  ↓ CHECK_NEW_MESSAGE → Content Script → ChatGPT DOM에서 보고서 추출
  ↓ (새 메시지 없으면 다시 대기)
  ↓ 상태 전환: ANALYZING
LLM Pipeline
  ├─ callGLM() — 보고서 → 핵심 사실 추출
  ├─ braveSearch() — 각 사실마다 웹 검색 (3개 사실 한정)
  └─ callClaude() — ChatGPT 보고서 + 검색 결과 → 종합 분석 + 후속 질문
  ↓ 상태 전환: INSERTING_QUESTION
Content Script
  ↓ 후속 질문 입력
  ↓ autoMode=true이면 자동 제출, 아니면 사용자 대기
  ↓ 상태 전환: WAITING_RESEARCH (다음 라운드)
```

---

## 3. Chrome Extension 상세 설계

### 3.1 Manifest V3 구성

**manifest.json 주요 필드:**

```json
{
  "manifest_version": 3,
  "name": "CS Deep Research",
  "version": "1.0.0",
  "permissions": [
    "sidePanel",      // Side Panel 사용
    "storage",        // Chrome Storage API
    "activeTab",      // 활성 탭 접근
    "scripting",      // Content Script 주입
    "tabs"            // 탭 정보 조회
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://api.z.ai/*",           // GLM API
    "https://api.search.brave.com/*", // Brave Search
    "http://127.0.0.1:3456/*"        // Claude Proxy
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    "js": ["src/content/index.ts"]
  }],
  "externally_connectable": {
    "matches": ["http://localhost:*/*", "http://127.0.0.1:*/*"]
  }
}
```

**핵심 요소:**
- **Manifest V3** 준수: Service Worker 기반 (백그라운드 스크립트 제거)
- **host_permissions**: 외부 API 및 로컬 서버 접근 허용
- **externally_connectable**: localhost만 외부 메시지 허용 (보안)

### 3.2 Service Worker (background/index.ts)

#### 역할

1. **세션 상태 관리**: 글로벌 `currentSession` 객체 유지
2. **폴링 루프 관리**: 5초 간격으로 ChatGPT 상태 확인
3. **LLM 호출 조율**: GLM, Brave, Claude 순차 호출
4. **Keep-alive**: MV3 30초 타임아웃 방지 (25초마다 ping)
5. **메시지 처리**: Side Panel, Content Script, 외부 메시지 수신
6. **WebSocket 통신**: Gateway와 양방향 통신

#### 주요 함수

**`startSession(topic, settings, sessionId?)`**
- 새 세션 시작
- ChatGPT 탭 찾기 → Content Script 주입 확인 → 주제 입력 → 폴링 시작
- Gateway에서 호출할 때: sessionId, autoMode=true 전달

**`startPolling(settings)`**
- 5초마다 `CHECK_RESEARCH_STATUS` → `CHECK_NEW_MESSAGE` 실행
- 상태 머신 전이: `WAITING_RESEARCH` → `ANALYZING` → `INSERTING_QUESTION` → `WAITING_RESEARCH`

**`analyzeReport(report, settings)`**
- 세 단계 LLM 파이프라인 실행:
  1. **GLM 호출**: 보고서에서 3-5개 핵심 사실 추출
  2. **Brave 검색**: 추출된 사실마다 웹 검색 (3개 한정)
  3. **Claude 호출**: 보고서 + 검색 결과 종합 분석
- 반환: `AnalysisEntry` 객체 (추출 사실, 검색 결과, 분석, 후속 질문)

**`cancelSession()`**
- 세션 즉시 중단 (최종 보고서 없음)
- ChatGPT에 새 채팅 시작 명령

**`stopSession()`**
- 현재까지의 데이터로 ChatGPT에 최종 요약 요청
- 상태: `WAITING_FINAL_REPORT`로 전이
- 최종 보고서 수신 후 세션 종료

#### WebSocket 통신 (Gateway와)

**Service Worker ← Gateway 수신:**

```javascript
message.type === 'START_SESSION'
  payload: { sessionId, topic, maxRounds }
  → startSession(topic, settings, sessionId)

message.type === 'STOP_SESSION'
  → stopSession()

message.type === 'CANCEL_SESSION'
  → cancelSession()
```

**Service Worker → Gateway 송신:**

```javascript
{ type: 'EXTENSION_READY' }  // 초기화 완료

{ type: 'PROGRESS_UPDATE', payload: {
    sessionId,
    state,
    round,
    maxRounds,
    topic,
    progressLog,      // 진행 로그 배열
    analyses          // 분석 결과 배열
  }}
```

#### Keep-alive 메커니즘

MV3 Service Worker는 30초 유휴 상태에서 자동 종료됨.
연속 작업 중에는 25초마다 `chrome.runtime.getPlatformInfo()` 호출으로 활성 유지.

```typescript
function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      console.log("[CS-BG] keep-alive ping");
    });
  }, 25000);
}
```

### 3.3 Content Script (content/index.ts)

#### 역할

ChatGPT 웹페이지의 DOM 조작 및 정보 추출. Service Worker의 명령에 응답.

#### 메시지 처리

| 메시지 타입 | 역할 | 응답 |
|-----------|------|------|
| `PING` | 활성 확인 | `{ pong: true }` |
| `CHECK_RESEARCH_STATUS` | 스트리밍 중인지 확인 | `{ inProgress: boolean }` |
| `CHECK_NEW_MESSAGE` | 새 assistant 메시지 추출 | `{ content: string }` |
| `INSERT_QUESTION` | 질문 입력 + 선택적 제출 | `{ success: boolean }` |
| `SUBMIT_QUESTION` | 질문 제출 | `{ success: boolean }` |
| `MARK_SEEN` | 현재 메시지 개수 저장 | `{ success: true }` |
| `NEW_CHAT` | 새 채팅 시작 | `{ success: boolean }` |
| `EXTRACT_REPORT` | 최신 메시지 추출 | `{ content: string }` |

### 3.4 Content Script 상세: DOM 읽기/쓰기

#### chatgpt-reader.ts

**`extractLatestReport(): string | null`**
- 최신 assistant 메시지 텍스트 추출
- 셀렉터: `[data-message-author-role="assistant"]` 또는 `.agent-turn .markdown`

**`checkForNewMessage(): string | null`**
- 메시지 개수로 신규 메시지 감지 (텍스트 비교 X)
- 창 단계 상태 `WIN.__csExtLastCount`로 추적
- 신규 메시지 있으면 내용 반환, 없으면 null

**`markCurrentAsSeen(): void`**
- 현재 메시지 개수를 "본" 상태로 저장
- 다음 폴링에서 신규 메시지만 감지

**`isStreaming(): boolean`**
- "Stop streaming" 버튼 또는 thinking indicator 감지
- ChatGPT 응답 생성 중인지 판단

#### chatgpt-writer.ts

**`insertText(text: string): boolean`**
- 텍스트를 입력란에 삽입
- `#prompt-textarea` 또는 `[contenteditable="true"]` 대상
- React 호환: `document.execCommand('insertText', false, text)`

**`submitInput(): boolean`**
- Send 버튼 클릭 또는 Enter 키 이벤트
- 셀렉터: `[data-testid="send-button"]`, `[aria-label="Send prompt"]` 등

**`startNewChat(): boolean`**
- 새 채팅 시작 버튼 클릭
- 다양한 셀렉터 시도 후 실패 시 루트 URL 네비게이션

### 3.5 Side Panel (sidepanel/)

#### UI 레이아웃

```
┌────────────────────────────┐
│ Research | Settings         │  ← 탭 전환
├────────────────────────────┤
│ [상태 바]                    │
│ • 현재 상태 + Round 표시     │
│ • GLM/Claude 호출 횟수       │
│ • 진행 로그 (최근 8줄)       │
├────────────────────────────┤
│ [시작 컨트롤] 또는 [액션]     │
│ • 세션 미시작: 주제 입력      │
│   - 반복 횟수 선택 (3/5/10)  │
│   - Start Research 버튼      │
│ • 세션 진행: Cancel 버튼     │
│ • 완료 후: 보고서 다운로드   │
├────────────────────────────┤
│ [분석 결과]                  │
│ • 각 라운드별 접힘           │
│ • GLM 추출 사실              │
│ • Brave 검색 결과            │
│ • Claude 전략 자가진단        │
│ • Claude 종합 분석            │
│ • 후속 질문                  │
└────────────────────────────┘
```

#### 핵심 컴포넌트

**`App.tsx`**
- 탭 전환 (Research / Settings)
- `useResearchSession` 훅 호출

**`useResearchSession.ts`**
- Side Panel ↔ Service Worker 메시지 통신
- 상태 리스닝: `GET_SESSION` 메시지로 초기화 및 주기적 갱신
- 함수:
  - `start(topic)` — START_SESSION 전송
  - `cancel()` — CANCEL_SESSION 전송
  - `confirm()` — MANUAL_CONFIRM 전송
  - `downloadReport()` — GENERATE_REPORT 요청 후 마크다운 다운로드

**`StatusBar.tsx`**
- 세션 상태 표시 (배경색으로 상태 구분)
- 진행 로그 표시 (최근 8개, 자동 스크롤)
- LLM 호출 횟수 표시

**`AnalysisView.tsx`**
- 각 라운드별 분석 결과 (역순 표시)
- 세부 항목 접힘: GLM 사실, Brave 검색, Claude 분석 등
- ChatGPT 최종 보고서 (별도 강조 표시)

**`SettingsPanel.tsx`**
- GLM API Key 입력 (비밀번호 필드)
- Claude API Key 입력 (미사용, 향후 확장)
- Max Rounds 설정 (1-50)
- Auto-submit 토글
- Save 버튼 → chrome.storage.local에 저장

### 3.6 빌드 설정 (Vite)

**vite.config.ts**

```typescript
plugins: [react(), crx({ manifest })]
```

- **@crxjs/vite-plugin**: Chrome Extension 번들링
- **react**: JSX 변환
- **TypeScript**: 타입 안전성

**빌드 타임 변수 주입:**

```typescript
define: {
  __CLAUDE_OAUTH_TOKEN__: JSON.stringify(tokens.CLAUDE_OAUTH_TOKEN),
  __GLM_API_KEY__: JSON.stringify(glmApiKey),
  __BRAVE_API_KEY__: JSON.stringify(braveApiKey),
}
```

- `~/.clawdbot/agents/main/agent/auth-profiles.json`에서 Claude 토큰 읽기
- GLM/Brave API 키는 기본값 또는 환경 변수로 설정
- 빌드 결과: `dist/` 폴더에 Chrome Extension 번들

---

## 4. LLM 파이프라인 상세

### 4.1 개요

```
ChatGPT 보고서 (라운드별)
  ↓
┌─────────────────────────────────────────┐
│         GLM-4.7 (z.ai API)              │
│ 역할: 보고서에서 검증 가능한 사실 추출   │
│ 입력: 보고서 텍스트 (4000자 한정)        │
│ 출력: 핵심 사실 3-5개                    │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│     Brave Web Search API                │
│ 역할: 추출된 사실 검증                   │
│ 입력: 각 사실마다 검색 쿼리               │
│ 출력: 상위 2개 결과 (최대 3개 사실)       │
│ 레이트 리미팅: 500ms 간격                │
└─────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────┐
│   Claude Sonnet 4 (로컬 프록시)          │
│ 역할: 보고서 + 검색 결과 종합 분석        │
│ 입력: 시스템 프롬프트 + 보고서 + 검색    │
│ 출력: 메타-평가 + 종합 분석 + 후속 질문  │
│ 세션: 라운드 히스토리 유지                │
└──────────────────────────────────────────┘
  ↓
후속 질문 + 외부 검증 정보 → ChatGPT에 입력
```

### 4.2 GLM-4.7 호출 (사실 추출)

**URL**: `https://api.z.ai/api/coding/paas/v4/chat/completions`

**구현**: `llm-client.ts::callGLM()`

```typescript
export async function callGLM(prompt: string, apiKey: string): Promise<LLMResponse>
```

**요청:**

```json
{
  "model": "glm-4.7",
  "messages": [
    {
      "role": "user",
      "content": "从以下报告中提取3-5个最关键的可验证事实声明，每行一个，仅输出声明文本：\n[보고서 텍스트]"
    }
  ]
}
```

**응답 처리:**

```typescript
const text = data.choices?.[0]?.message?.content || "";
```

**특징:**
- 중국어 프롬프트 사용 (보고서 언어와 무관)
- 타임아웃: 120초
- 실패 시: `{ text: "", error: "..." }` 반환
- 진행 로그: `"🔍 핵심 사실 추출 중"`

### 4.3 Brave Web Search (검증)

**URL**: `https://api.search.brave.com/res/v1/web/search`

**구현**: `llm-client.ts::braveSearch()`

```typescript
export async function braveSearch(query: string, count = 5): Promise<SearchResult[]>
```

**요청 파라미터:**

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `q` | `query.slice(0, 200)` | 검색어 (200자 한정) |
| `count` | `2` | 결과 개수 (각 사실마다) |

**응답 처리:**

```typescript
const results = data.web?.results ?? [];
// { title, url, description } 객체 배열
```

**특징:**
- 헤더: `X-Subscription-Token: ${apiKey}`
- 레이트 리미팅: 각 검색 후 500ms 대기
- 사실당 1개 검색 (최대 3개 사실 → 최대 3회 검색)
- 응답 형식: 마크다운 목록으로 변환
  ```markdown
  - [제목](url): 설명
  ```

**진행 로그:**
- 시작: `"🌐 웹 검색 중: N개 사실에 대해..."`
- 완료: `"🌐 웹 검색 완료: M건의 검색 결과"`

### 4.4 Claude Sonnet 종합 분석

**URL**: `http://127.0.0.1:3456/v1/chat/completions`

**구현**: `llm-client.ts::callClaude()`

```typescript
export async function callClaude(
  prompt: string,
  _apiKey: string,
  systemPrompt?: string,
  sessionId?: string
): Promise<LLMResponse>
```

**요청:**

```json
{
  "model": "claude-sonnet-4",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 4096,
  "user": "cs-{sessionId}"  // 세션별 컨텍스트
}
```

**시스템 프롬프트 구조:**

```text
## CORE TOPIC
"[사용자 주제]"

## Your Role
- ChatGPT 보고서 + 외부 증거 종합
- 확인된 사실 vs 불확실한 정보 구분
- 핵심 주제 깊화 질문 생성

## Research Phase Strategy
[라운드별 가이드]
- Early Phase (1/5): 기초 수집 — 핵심 변수와 현황 탐색
- Mid Phase (2-3/5): 심화 분석 — 인과관계와 메커니즘
- Late Phase (4/5): 검증·비교 — 반대 의견, 리스크, 대안
- Final Phase (5/5): 통합·실전 — 판단 프레임 구성

## Quality Rules for Follow-up Questions
- 핵심 주제와의 직접 연관성 필수
- 깊이 있는 재방문 가능 (다른 관점, 더 깊이)
- 동일 깊이의 반복 금지
- "HOW", "WHY" 우선
- 메커니즘, 인과 경로, 트레이드오프
```

**프롬프트 구조:**

```text
## Round X/Y
[이전 라운드 후속 질문 히스토리]

## ChatGPT Report (this round)
[보고서 텍스트, 6000자 한정]

## External Evidence (Brave Search)
[검색 결과 또는 "(No search results available)"]

Produce your synthesis and follow-up question now.
```

**출력 형식 (고정):**

```text
### Meta-Assessment
[자체 평가: 탐색 축, 남은 갭, 자기진단, 전략 조정]

### Synthesis
[보고서 + 검색 결과 종합 분석]

### Follow-up Question
[질문 텍스트]
```

**응답 파싱:**

```typescript
// Meta-Assessment 추출
const metaMatch = text.match(/### Meta-Assessment\s*\n([\s\S]*?)(?=\n### Synthesis)/);
const metaAssessment = metaMatch?.[1]?.trim() || "";

// Synthesis 추출 (Meta-Assessment 제거)
const synthesisOnward = text.replace(/### Meta-Assessment[\s\S]*?(?=\n### Synthesis)/, "");

// Follow-up Question 추출 (첫 번째 실질적 문장)
const questionMatch = synthesisOnward.match(/### Follow-up Question\s*\n([\s\S]*?)(?:\n###|$)/);
```

**특징:**
- 세션 ID: `cs-{sessionId}` — Claude 프록시에서 대화 컨텍스트 유지
- 타임아웃: 120초
- 실패 시: GLM으로 대체 (fallback)
- 진행 로그:
  - 시작: `"🧠 Claude 종합 분석 중..."`
  - 완료: `"🧠 종합 분석 완료: N자 분석 결과"`

**향상된 질문 생성:**

추출된 후속 질문에 검색 결과/분석 요약을 첨부:

```text
[후속 질문]

[참고: 외부 검증 결과]
[검색 결과 요약]

[분석 요약]

위 외부 검증 정보를 참고하여 더 정확하고 깊이 있는 연구를 진행해주세요.
```

---

## 5. Gateway 서버 상세 설계

### 5.1 Express REST API

#### 엔드포인트 목록

| 메서드 | 경로 | 역할 | 응답 |
|--------|------|------|------|
| **POST** | `/api/sessions` | 새 세션 생성 | `Session` |
| **GET** | `/api/sessions` | 세션 목록 조회 | `Session[]` |
| **GET** | `/api/sessions/:id` | 세션 상세 조회 | `Session` |
| **POST** | `/api/sessions/:id/pause` | 세션 일시정지 | `{ success: true }` |
| **POST** | `/api/sessions/:id/resume` | 세션 재개 | `{ success: true }` |
| **POST** | `/api/sessions/:id/cancel` | 세션 취소 (즉시) | `{ success: true }` |
| **POST** | `/api/sessions/:id/stop` | 세션 종료 (최종 보고서 생성) | `{ success: true }` |
| **GET** | `/api/sessions/:id/progress` | 실시간 진행 상황 | `SessionProgress` |
| **GET** | `/api/sessions/:id/report` | 최종 보고서 다운로드 | Markdown 파일 |
| **POST** | `/api/sessions/:id/files` | 파일 업로드 | `{ success, files }` |
| **GET** | `/api/sessions/:id/files` | 업로드 파일 목록 | `{ files }` |
| **GET** | `/health` | 헬스 체크 | `{ status, timestamp }` |

#### 세션 생성 (POST /api/sessions)

**요청:**

```json
{
  "topic": "China's AI development strategy",
  "maxRounds": 5,
  "files": []
}
```

**응답:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "topic": "China's AI development strategy",
  "maxRounds": 5,
  "status": "running",
  "currentRound": 0,
  "createdAt": 1704067200000,
  "updatedAt": 1704067200000
}
```

**내부 처리:**
1. UUID 생성
2. 세션 디렉토리 생성 (`./gateway/sessions/{id}/uploads/`, `reports/`)
3. DB에 저장 (상태: `running`)
4. PlaywrightController 생성 및 실행
5. Extension에 `START_SESSION` WebSocket 메시지 송신

#### 실시간 진행 상황 (GET /api/sessions/:id/progress)

**응답:**

```json
{
  "state": "ANALYZING",
  "round": 2,
  "maxRounds": 5,
  "logs": [
    { "timestamp": 1704067300000, "message": "🔍 핵심 사실 추출 중...", "level": "info" },
    { "timestamp": 1704067400000, "message": "🌐 웹 검색 중: 3개 사실에 대해...", "level": "info" }
  ],
  "rounds": [
    {
      "round": 1,
      "question": "China's AI strategy focus",
      "search_results": ["..."],
      "analysis": "...",
      "completed": true
    }
  ],
  "session": { /* Session 객체 */ }
}
```

**데이터 소스:**
- WebSocket에서 수신한 `PROGRESS_UPDATE` (실시간)
- PlaywrightController의 `getProgress()` (폴백)

### 5.2 WebSocket 프로토콜

**연결:** `ws://localhost:3004/ws`

#### Extension ← Gateway 수신

**START_SESSION**

```json
{
  "type": "START_SESSION",
  "messageId": "1704067200123",
  "payload": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "topic": "China's AI development",
    "maxRounds": 5
  }
}
```

Service Worker가 이 메시지를 받으면:
- `startSession(topic, settings, sessionId)`로 세션 시작
- Extension이 로그인된 유저의 ChatGPT에서 연구 실행

**STOP_SESSION / CANCEL_SESSION**

```json
{
  "type": "STOP_SESSION",
  "messageId": "1704067200124",
  "payload": { "sessionId": "..." }
}
```

#### Extension → Gateway 송신

**EXTENSION_READY**

```json
{
  "type": "EXTENSION_READY"
}
```

Connection 직후 전송. Gateway가 ACK 응답.

**PROGRESS_UPDATE**

```json
{
  "type": "PROGRESS_UPDATE",
  "payload": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "state": "ANALYZING",
    "round": 2,
    "maxRounds": 5,
    "topic": "China's AI development",
    "progressLog": [
      { "time": 1704067300000, "step": "🔍 핵심 사실 추출 중", "detail": "GLM으로 보고서에서 검증 가능한 사실 추출..." }
    ],
    "analyses": [
      {
        "round": 1,
        "glmClaims": "...",
        "searchResults": "...",
        "claudeAnalysis": "...",
        "metaAssessment": "...",
        "followUpQuestion": "..."
      }
    ]
  }
}
```

**응답 메시지**

```json
{
  "type": "SESSION_STARTED",
  "messageId": "1704067200123",
  "success": true
}
```

### 5.3 SQLite 데이터 모델

**테이블: sessions**

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  max_rounds INTEGER NOT NULL,
  status TEXT NOT NULL,               -- running, paused, completed, failed
  current_round INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,        -- Unix timestamp
  updated_at INTEGER NOT NULL,
  final_report TEXT,                  -- 최종 보고서 마크다운
  error TEXT                          -- 에러 메시지 (실패 시)
);
```

**인덱싱:** `created_at DESC` (목록 조회용)

**특징:**
- WAL (Write-Ahead Logging) 활성화: 동시성 개선
- 세션 디렉토리: `./gateway/sessions/{id}/`
  - `metadata.json` — 세션 메타데이터
  - `uploads/` — 업로드된 파일
  - `reports/` — 생성된 보고서
  - `final_report.md` — 최종 보고서

### 5.4 세션 관리 로직 (SessionManager)

#### 클래스 구조

```typescript
export class SessionManager {
  private controllers: Map<string, PlaywrightController> = new Map();

  async createSession(data: CreateSessionRequest): Promise<SessionRecord>
  getSession(id: string): SessionRecord | null
  listSessions(filter?: { status?: string }): SessionRecord[]
  updateSessionStatus(id: string, status: SessionRecord['status'], error?: string): void
  saveReport(id: string, report: string): void
  updateRound(id: string, round: number): void

  async pauseSession(id: string): Promise<void>
  async resumeSession(id: string): Promise<void>
  async cancelSession(id: string): Promise<void>
  async getSessionProgress(id: string): Promise<any>
  async closeSession(id: string): Promise<void>
  async cleanup(): Promise<void>

  listSessionFiles(sessionId: string): string[]
  getSessionFilePaths(sessionId: string): string[]
  saveSessionReport(sessionId: string, reportType: 'detailed' | 'chatgpt', content: string): void
}
```

#### 주요 흐름

**세션 생성:**

```typescript
async createSession(data: CreateSessionRequest) {
  1. UUID 생성
  2. 세션 디렉토리 생성 (uploads/, reports/)
  3. DB에 저장 (status: running)
  4. PlaywrightController 생성
  5. controller.launch()
  6. controller.startResearch(topic, maxRounds, filePaths)
  7. controllers Map에 저장
  8. return SessionRecord
}
```

**진행 상황 조회:**

```typescript
async getSessionProgress(id: string) {
  1. WebSocket PROGRESS_UPDATE에서 가져온 데이터 확인
  2. 없으면 PlaywrightController.getProgress() 호출
  3. 없으면 기본값 반환
  4. UI 포맷으로 변환
}
```

### 5.5 Playwright Controller

**목적:** Extension이 없는 경우를 위한 브라우저 자동화 (현재는 미사용, 향후 확장)

**현재 구현:**
- Extension 기반 모드: `extensionId = 'websocket-extension'`
- 실제 브라우저 제어는 Extension이 수행
- Gateway ← WebSocket → Extension → ChatGPT

**메서드:**

```typescript
async launch(): Promise<void>  // 초기화 (실제 작업 없음)
async startResearch(topic, maxRounds, files?): Promise<void>  // START_SESSION 전송
async pause(): Promise<void>  // PAUSE_SESSION 전송
async resume(): Promise<void>  // RESUME_SESSION 전송
async cancel(): Promise<void>  // CANCEL_SESSION 전송
async getProgress(): Promise<ProgressData>  // GET_PROGRESS 전송
async close(): Promise<void>  // 정리
```

---

## 6. 모바일 웹 UI 상세

### 6.1 페이지 구성

#### SessionList (/)

**목적:** 모든 세션 조회 및 선택

**기능:**
- 세션 목록 조회 (`GET /api/sessions`)
- 상태별 색상 구분 (running: blue, paused: amber, completed: green, failed: red)
- 진행률 바 표시 (currentRound / maxRounds)
- 시간 전 표시 (e.g., "5분 전", "2시간 전")
- 클릭 → SessionDetail로 네비게이션

**디자인:**
- 다크 테마 (배경: #0a0a0a, 텍스트: #e5e5e5)
- 카드 레이아웃
- 모바일 최적화 (500px 최대 너비)

#### NewSession (/new)

**목적:** 새 세션 생성

**폼:**
- Topic 입력 (텍스트 영역)
- maxRounds 선택 (3 / 5 / 10 / 커스텀)
- 파일 업로드 (선택 사항)

**동작:**
- Create 클릭 → `POST /api/sessions`
- 성공 → SessionDetail로 네비게이션

#### SessionDetail (/:id)

**목적:** 선택된 세션 모니터링 및 제어

**표시:**
- 상태 바 (현재 상태 + Round 표시)
- 주제
- 액션 버튼 (Cancel/Stop)
- 진행 로그 (최근 10개, 자동 스크롤)
- 분석 라운드 (역순 표시, 접힘)
- 최종 보고서 (완료 시)

**실시간 업데이트:**
- 세션 상태가 `running` 또는 `paused`일 때 3초마다 `GET /api/sessions/:id/progress` 호출
- `completed`일 때 한 번만 `GET /api/sessions/:id/report` 호출

### 6.2 실시간 진행 표시 방식

**폴링 (Polling) 방식:**

```typescript
useEffect(() => {
  if (!session || !id) return;
  if (session.status === 'running' || session.status === 'paused') {
    loadProgress();
    const interval = setInterval(loadProgress, 3000);
    return () => clearInterval(interval);
  }
}, [id, session?.status]);

const loadProgress = async () => {
  const response = await getProgress(id);
  setProgress(response.data);
  if (response.data.session) setSession(response.data.session);
};
```

**장점:**
- 구현 간단
- HTTP 표준 기반

**간격:** 3초 (충분한 빈도 + 서버 부하 고려)

### 6.3 Extension과의 데이터 동기화

**동기 흐름:**

```
Extension (WebSocket)
  ↓ PROGRESS_UPDATE
Gateway (sessionProgress Map)
  ↓ REST API GET /api/sessions/:id/progress
모바일 웹 (Polling 3초)
  ↓ 표시
사용자
```

**특징:**
- WebSocket: Extension → Gateway (거의 실시간)
- REST API: 폴링 (3초 지연)
- 최종 보고서: 세션 완료 후 DB에서 읽음

---

## 7. 데이터 흐름

### 7.1 세션 시작부터 완료까지 (시퀀스)

```
사용자 (Side Panel)
  │ 주제 입력, 반복 횟수 선택
  ├─ [Start Research] 클릭
  │
Service Worker
  │ startSession(topic, settings)
  ├─ 1. ChatGPT 탭 찾기 (chrome.tabs.query)
  ├─ 2. Content Script 주입/확인 (PING)
  ├─ 3. 세션 객체 생성 (state: WAITING_RESEARCH, round: 1)
  ├─ 4. 상태 알림 → Side Panel (STATE_UPDATE)
  ├─ 4a. 상태 알림 → Gateway (WebSocket: PROGRESS_UPDATE)
  ├─ 5. 주제를 ChatGPT 입력란에 삽입 (INSERT_QUESTION)
  ├─ 6. autoMode=true이면 자동 제출, 아니면 사용자가 Enter 누름
  ├─ 7. startPolling 시작 (5초 간격)
  │
Content Script
  │ INSERT_QUESTION 수신
  ├─ 입력란 찾기
  ├─ 텍스트 삽입 (execCommand + dispatchEvent)
  ├─ autoSubmit=true면 Send 버튼 클릭
  │
ChatGPT (웹페이지)
  │ Deep Research 시작 (스트리밍)
  │ [진행 중...]
  │
Polling Loop (5초마다)
  │ CHECK_RESEARCH_STATUS
  ├─ isStreaming() 호출 → Stop 버튼 또는 thinking indicator 확인
  ├─ (스트리밍 중이면 대기, 다시 대기)
  │
  │ CHECK_NEW_MESSAGE
  ├─ 메시지 개수 비교 (WIN.__csExtLastCount)
  ├─ (새 메시지 없으면 대기, 다시 대기)
  │
  │ 새 메시지 감지됨
  ├─ 상태 전환: ANALYZING
  ├─ progressLog 추가: "📥 보고서 수신 (N자)"
  ├─ progressLog 추가: "🔍 핵심 사실 추출 중"
  │
  │ analyzeReport() 호출 (3단계 파이프라인)
  ├─ callGLM() — 보고서 → 핵심 사실 추출 (4000자 한정)
  ├─ braveSearch() × 최대 3개 사실
  │  ├─ 사실1 검색
  │  ├─ 500ms 대기
  │  ├─ 사실2 검색
  │  ├─ 500ms 대기
  │  ├─ 사실3 검색
  │  └─ progressLog: "🌐 웹 검색 완료 (M건)"
  │
  ├─ callClaude() — 보고서 + 검색 결과 → 종합 분석
  │  ├─ 시스템 프롬프트 (라운드별 가이드 포함)
  │  ├─ 세션 ID로 대화 컨텍스트 유지
  │  ├─ 응답 파싱: Meta-Assessment + Synthesis + Follow-up Question
  │  └─ progressLog: "🧠 종합 분석 완료 (N자)"
  │
  │ 분석 결과를 analyses 배열에 추가
  │
  │ 상태 전환: INSERTING_QUESTION
  ├─ 후속 질문에 외부 검증 정보 첨부
  ├─ progressLog: "후속 질문 입력 중"
  │
  │ INSERT_QUESTION 전송 (augmented question, autoMode=true)
  │
Content Script
  │ INSERT_QUESTION 수신 (augmented question)
  ├─ 입력란에 삽입
  ├─ autoMode=true → Send 버튼 클릭
  │
ChatGPT
  │ Deep Research 재개 (Round 2)
  │ [진행 중...]
  │
Service Worker (Polling)
  │ 반복: Round 2, 3, 4, ...
  │
  │ maxRound 도달 확인
  ├─ round > maxRounds이면 stopSession() 호출
  │
stopSession()
  │ 1. ChatGPT에 최종 요약 요청
  │ 2. 상태: WAITING_FINAL_REPORT
  │ 3. 폴링 계속
  │
ChatGPT
  │ 최종 요약 생성
  │
Polling Loop
  │ 상태가 WAITING_FINAL_REPORT일 때
  ├─ isStreaming() 확인
  ├─ 스트리밍 끝나면 CHECK_NEW_MESSAGE
  ├─ 최종 보고서 텍스트 추출
  ├─ currentSession.finalReport에 저장
  ├─ 상태: IDLE
  ├─ progressLog: "📋 최종 보고서 수신"
  ├─ 폴링 중지
  │
Gateway (WebSocket)
  │ PROGRESS_UPDATE 수신 (state: IDLE, finalReport 포함)
  ├─ sessionProgress Map 업데이트
  ├─ DB에 저장 (status: completed)
  │
모바일 웹 (Polling)
  │ GET /api/sessions/:id/progress
  ├─ state: IDLE, 최종 보고서 표시
  └─ 완료 상태로 업데이트

사용자 (Side Panel)
  │ 완료 화면 표시
  ├─ 📄 내부 기록 다운로드 버튼
  └─ 재시작 가능
```

### 7.2 상태 전이 다이어그램

```
                    ┌─────────────────────────────────────────┐
                    │   IDLE (초기 상태)                        │
                    └────────────┬────────────────────────────┘
                                 │ startSession()
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ WAITING_RESEARCH (ChatGPT 응답 대기)      │
                    └──┬──────────────────────────────────────┘
                       │ CHECK_NEW_MESSAGE (타임아웃 후)
                       ▼
                    ┌─────────────────────────────────────────┐
                    │ ANALYZING (LLM 분석 중)                   │
                    └──┬──────────────────────────────────────┘
                       │ analyzeReport() 완료
                       ▼
                    ┌─────────────────────────────────────────┐
                    │ INSERTING_QUESTION (후속 질문 입력 중)    │
                    └──┬──────────────────────────────────────┘
                       │ 후속 질문 제출
                       │ round++
                       ├─ (round <= maxRounds) → WAITING_RESEARCH (다음 라운드)
                       └─ (round > maxRounds) → stopSession() 호출
                                                      │
                                                      ▼
                    ┌─────────────────────────────────────────┐
                    │ WAITING_FINAL_REPORT (최종 요약 대기)    │
                    └──┬──────────────────────────────────────┘
                       │ 최종 보고서 수신
                       ▼
                    ┌─────────────────────────────────────────┐
                    │ IDLE (완료)                               │
                    └─────────────────────────────────────────┘

    (특수) cancelSession()
           ├─ 어느 상태든 가능
           ├─ finalReport 없음
           └─ IDLE로 즉시 전이
```

---

## 8. 상태 머신

### 8.1 상태 정의

**SessionState 타입:**

```typescript
type SessionState =
  | "IDLE"                    // 유휴 (시작 전 또는 완료)
  | "WAITING_RESEARCH"        // ChatGPT Deep Research 응답 대기
  | "READING_RESULT"          // 보고서 읽는 중 (미사용)
  | "ANALYZING"               // LLM 분석 진행 (GLM + Brave + Claude)
  | "INSERTING_QUESTION"      // 후속 질문 입력 중
  | "WAITING_CONFIRM"         // 사용자 확인 대기 (미사용)
  | "AUTO_SUBMIT"             // 자동 제출 중 (미사용)
  | "WAITING_FINAL_REPORT";   // 최종 요약 대기
```

### 8.2 상태별 설명

| 상태 | 설명 | 진입 조건 | 퇴출 조건 |
|------|------|----------|----------|
| **IDLE** | 유휴 상태 | 초기 / 세션 완료 | startSession() |
| **WAITING_RESEARCH** | ChatGPT 응답 대기 | startSession() 후 또는 라운드 진행 | CHECK_NEW_MESSAGE 성공 |
| **ANALYZING** | LLM 분석 진행 | 새 보고서 감지 | analyzeReport() 완료 |
| **INSERTING_QUESTION** | 후속 질문 입력 | ANALYZING 완료 | INSERT_QUESTION 전송 |
| **WAITING_FINAL_REPORT** | 최종 요약 대기 | stopSession() 호출 | 최종 보고서 수신 |
| **WAITING_CONFIRM** | 사용자 확인 대기 | (현재 미구현) | confirmAndProceed() |
| **AUTO_SUBMIT** | 자동 제출 중 | (현재 미구현) | 제출 완료 |

### 8.3 상태 전이 트리거

```typescript
function transition(state: SessionState) {
  if (!currentSession) return;
  currentSession.state = state;
  notify();  // 리스너에게 알림 (Side Panel, Gateway)
}
```

---

## 9. 메시지 프로토콜

### 9.1 Extension 내부 메시지 (chrome.runtime.sendMessage)

#### Content Script ← Service Worker

| 메시지 타입 | Payload | 응답 | 설명 |
|-----------|---------|------|------|
| `PING` | - | `{ pong: true }` | 활성 확인 |
| `CHECK_RESEARCH_STATUS` | - | `{ inProgress: boolean }` | 스트리밍 여부 |
| `CHECK_NEW_MESSAGE` | - | `{ content: string \| null }` | 새 메시지 추출 |
| `INSERT_QUESTION` | `{ question, autoSubmit }` | `{ success: boolean }` | 질문 입력 + 제출 |
| `SUBMIT_QUESTION` | - | `{ success: boolean }` | 질문 제출 |
| `MARK_SEEN` | - | `{ success: true }` | 현재 상태 저장 |
| `NEW_CHAT` | - | `{ success: boolean }` | 새 채팅 시작 |
| `EXTRACT_REPORT` | - | `{ content: string \| null }` | 보고서 추출 |

#### Side Panel ← Service Worker

| 메시지 타입 | Payload | 설명 |
|-----------|---------|------|
| `STATE_UPDATE` | `{ sessionId, state, round, maxRounds }` | 상태 변경 알림 |
| `ANALYSIS_RESULT` | `{ analyses }` | 분석 결과 업데이트 |

#### Side Panel → Service Worker

| 메시지 타입 | Payload | 설명 |
|-----------|---------|------|
| `START_SESSION` | `{ topic }` | 세션 시작 |
| `STOP_SESSION` | - | 최종 요약 생성 후 종료 |
| `CANCEL_SESSION` | - | 즉시 중단 |
| `SET_AUTO_MODE` | `{ autoMode }` | 자동 제출 토글 |
| `UPDATE_SETTINGS` | `{ glmApiKey, maxRounds, ... }` | 설정 저장 |
| `MANUAL_CONFIRM` | - | 사용자 확인 (미구현) |
| `GENERATE_REPORT` | - | 최종 보고서 생성 |
| `GET_SESSION` | - | 현재 세션 조회 |

### 9.2 WebSocket 메시지 (Extension ↔ Gateway)

#### Gateway → Extension

```typescript
{
  type: 'START_SESSION',
  messageId: string,
  payload: {
    sessionId: string,
    topic: string,
    maxRounds: number
  }
}

{
  type: 'STOP_SESSION',
  messageId: string,
  payload: { sessionId: string }
}

{
  type: 'CANCEL_SESSION',
  messageId: string,
  payload: { sessionId: string }
}
```

#### Extension → Gateway

```typescript
{
  type: 'EXTENSION_READY'
}

{
  type: 'PROGRESS_UPDATE',
  payload: {
    sessionId: string,
    state: SessionState,
    round: number,
    maxRounds: number,
    topic: string,
    progressLog: ProgressEntry[],
    analyses: AnalysisEntry[]
  }
}

{
  type: 'SESSION_STARTED',
  messageId: string,
  success: boolean
}

{
  type: 'SESSION_STOPPED',
  messageId: string,
  success: boolean
}

{
  type: 'SESSION_CANCELLED',
  messageId: string,
  success: boolean
}
```

---

## 10. 파일 구조

### 10.1 디렉토리 트리

```
ChinaSearch/
├── src/                           # Chrome Extension 소스
│   ├── background/
│   │   ├── index.ts               # Service Worker 진입점
│   │   ├── state-machine.ts        # 세션 상태 머신 & 폴링 루프
│   │   └── llm-client.ts           # GLM, Brave, Claude API 호출
│   │
│   ├── content/
│   │   ├── index.ts               # Content Script 진입점
│   │   ├── chatgpt-reader.ts       # DOM 읽기 (보고서 추출)
│   │   └── chatgpt-writer.ts       # DOM 쓰기 (입력/제출)
│   │
│   ├── sidepanel/
│   │   ├── App.tsx                # Side Panel 메인 UI
│   │   ├── main.tsx               # React 진입점
│   │   ├── index.css              # 스타일
│   │   │
│   │   ├── hooks/
│   │   │   └── useResearchSession.ts  # 세션 상태 리스너
│   │   │
│   │   └── components/
│   │       ├── StatusBar.tsx       # 상태 표시 & 진행 로그
│   │       ├── AnalysisView.tsx    # 분석 결과 표시
│   │       ├── SettingsPanel.tsx   # 설정 패널
│   │       └── SessionList.tsx     # (미사용 또는 향후)
│   │
│   └── shared/
│       ├── types.ts               # SessionState, ResearchSession 등
│       ├── messages.ts            # 메시지 타입 & 함수
│       └── constants.ts           # 기본값, 폴링 간격 등
│
├── gateway/                       # Gateway 서버 (Node.js)
│   ├── src/
│   │   ├── index.ts               # Express 진입점, WebSocket 설정
│   │   ├── db.ts                  # SQLite 초기화
│   │   ├── types.ts               # SessionRecord 등
│   │   │
│   │   ├── routes/
│   │   │   └── sessions.ts        # /api/sessions/* 엔드포인트
│   │   │
│   │   └── services/
│   │       ├── session-manager.ts # 세션 CRUD, 상태 관리
│   │       └── playwright-controller.ts  # 브라우저 제어 (Extension 기반)
│   │
│   ├── frontend/                  # 모바일 웹 UI (React + Vite)
│   │   ├── src/
│   │   │   ├── App.tsx            # Router 진입점
│   │   │   ├── api.ts             # Axios 클라이언트
│   │   │   ├── types.ts           # Session, SessionProgress 등
│   │   │   │
│   │   │   ├── pages/
│   │   │   │   ├── SessionList.tsx    # 세션 목록
│   │   │   │   ├── SessionDetail.tsx  # 세션 상세 & 모니터링
│   │   │   │   └── NewSession.tsx     # 세션 생성
│   │   │   │
│   │   │   └── main.tsx           # React-DOM 진입점
│   │   │
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── dist/                      # 빌드 결과
│   └── gateway.db                 # SQLite 데이터베이스 (런타임)
│
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── docs/
│   ├── DESIGN.md                  # 본 문서
│   ├── PRD.md                     # 제품 요구사항
│   ├── IMPLEMENTATION_PLAN.md     # 구현 계획
│   └── WORKFLOW.md                # 워크플로우
│
├── manifest.json                  # Chrome Extension 매니페스트
├── vite.config.ts                 # Extension 빌드 설정
├── tsconfig.json
├── package.json
└── dist/                          # 빌드 결과 (Extension)
```

### 10.2 주요 파일 역할

| 파일 | 역할 |
|------|------|
| `src/background/state-machine.ts` | 세션 상태 관리, 폴링 루프, LLM 호출 조율 |
| `src/background/index.ts` | Service Worker 진입, 메시지/WebSocket 처리 |
| `src/background/llm-client.ts` | GLM, Brave, Claude API 호출 래퍼 |
| `src/content/chatgpt-reader.ts` | DOM에서 ChatGPT 응답 추출 |
| `src/content/chatgpt-writer.ts` | ChatGPT DOM 조작 (입력/제출) |
| `src/sidepanel/hooks/useResearchSession.ts` | Side Panel ↔ Service Worker 통신 |
| `gateway/src/services/session-manager.ts` | 세션 생명 주기 관리 |
| `gateway/src/routes/sessions.ts` | REST API 엔드포인트 |
| `gateway/frontend/src/pages/SessionDetail.tsx` | 실시간 진행 모니터링 |

---

## 11. 설정 및 환경변수

### 11.1 Chrome Extension 설정

**Side Panel 설정 저장 위치:**
- `chrome.storage.local` 키: `settings`
- 데이터 구조:
  ```typescript
  {
    glmApiKey: string,       // Vite 빌드 시 기본값 주입 또는 사용자 입력
    claudeApiKey: string,    // 현재 미사용
    maxRounds: number,       // 기본값: 5
    autoMode: boolean        // 기본값: false
  }
  ```

### 11.2 Vite 빌드 타임 변수 주입

**vite.config.ts**

```typescript
define: {
  __CLAUDE_OAUTH_TOKEN__: JSON.stringify(tokens.CLAUDE_OAUTH_TOKEN),
  __GLM_API_KEY__: JSON.stringify(glmApiKey || "edb1d1b..."),
  __BRAVE_API_KEY__: JSON.stringify("BSAU6sCCMUrVLTw..."),
}
```

**소스에서 사용:**

```typescript
declare const __GLM_API_KEY__: string;
declare const __BRAVE_API_KEY__: string;

const apiKey = typeof __GLM_API_KEY__ !== "undefined" ? __GLM_API_KEY__ : "";
```

### 11.3 Gateway 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3004` | Express 서버 포트 |
| `NODE_ENV` | `development` | 환경 모드 |

**실행:**

```bash
node dist/index.js
# 또는
PORT=3004 node dist/index.js
```

### 11.4 API 키 관리

**GLM API Key:**
- Vite 빌드 시: `vite.config.ts`에 기본값 포함
- 런타임 오버라이드: Side Panel Settings에서 입력 가능

**Brave API Key:**
- Vite 빌드 시: 하드코딩 (public)
- 변경 필요 시: `vite.config.ts` 수정 후 재빌드

**Claude API:**
- 로컬 프록시 (localhost:3456)를 통해 간접 호출
- 프록시가 `claude` CLI 인증 처리

### 11.5 Claude Proxy 실행

```bash
node ~/.nvm/versions/node/v22.22.0/lib/node_modules/claude-max-api-proxy/dist/server/standalone.js 3456
```

또는

```bash
npm install -g claude-max-api-proxy
claude-max-api-proxy 3456
```

---

## 12. 알려진 제약사항 및 향후 개선 방향

### 12.1 알려진 제약사항

#### 기술적 제약

1. **Manifest V3 Service Worker 타임아웃**
   - MV3 Service Worker는 30초 유휴 후 자동 종료
   - 해결: 25초마다 `chrome.runtime.getPlatformInfo()` ping
   - 문제: 장시간 LLM 호출(120초)은 타임아웃 위험
   - 현재: Keep-alive로 완화하지만 완벽하지 않음

2. **Content Script DOM 셀렉터 취약성**
   - ChatGPT UI 변경 시 셀렉터 깨질 수 있음
   - 현재: 다중 셀렉터로 호환성 확보
   - 필요: 정기적 유지보수

3. **Brave Search Rate Limiting**
   - API 호출 간 500ms 지연 필수
   - 한 라운드당 3개 사실 × 500ms = 1.5초
   - 제약: 3개 사실 한정

4. **Claude 프록시 세션 관리**
   - 로컬 프록시는 단일 머신에서만 동작
   - 확장성 제약
   - 향후: 원격 프록시 또는 공식 API 전환 필요

#### 기능 제약

1. **Pause/Resume 미구현**
   - 메시지 타입은 정의하나 Service Worker에서 미구현
   - 상태: IDLE, ANALYZING 중 일시정지 시 복구 불가능

2. **File Upload 제약**
   - Gateway에서 파일 업로드 인프라는 있으나 Extension과 미연동
   - 향후: Extension에서 파일 선택 → Gateway 업로드

3. **ChatGPT 새 대화 시작 신뢰도**
   - `startNewChat()` 셀렉터가 여러 개 필요
   - 가끔 작동 실패 → 네비게이션 폴백

4. **최종 보고서 포맷 고정**
   - ChatGPT의 응답 형식에 의존
   - 마크다운 구조 보장 안 됨

### 12.2 성능 고려사항

1. **LLM 호출 비용**
   - GLM: 사용량 기반 요금
   - Claude (로컬): 무료 (CLI 기반)
   - Brave: 무료 (API 키 기반)

2. **폴링 간격 (5초)**
   - 충분한 빈도 + 서버 부하 고려
   - ChatGPT 응답 시간 (보통 20-60초)에 비추면 적절

3. **WebSocket 연결 유지**
   - Extension과 Gateway 간 단일 WebSocket
   - 여러 세션 공유 가능
   - 재연결 로직: 3초 간격 자동 재시도

### 12.3 보안 고려사항

1. **API 키 관리**
   - GLM API Key: vite.config.ts에 기본값 포함 (보안 취약)
   - 해결: 환경 변수 또는 Side Panel 입력
   - Brave API Key: 공개 가능 (공개 API)

2. **Chrome Extension 퍼미션**
   - `host_permissions`: ChatGPT 및 API 서버만 허용
   - `externally_connectable`: localhost만 허용

3. **WebSocket 통신 암호화**
   - 현재: 평문 ws://
   - 향후: wss:// (SSL/TLS) 필수

### 12.4 향후 개선 방향

#### 단기 (1개월)

- [ ] Pause/Resume 구현
- [ ] ChatGPT UI 변경 대응 (셀렉터 검증)
- [ ] 오류 처리 개선 (GLM/Claude 실패 시 재시도)
- [ ] 최종 보고서 마크다운 검증

#### 중기 (3개월)

- [ ] 파일 업로드 기능 Extension과 연동
- [ ] Claude 프록시 → 공식 API 전환
- [ ] wss:// WebSocket 보안 적용
- [ ] 데이터베이스 마이그레이션 (MySQL 등)

#### 장기 (6개월)

- [ ] 분산 아키텍처 (로드 밸런싱, 클러스터링)
- [ ] 사용자 인증 및 계정 관리
- [ ] 세션 공유 및 협업 기능
- [ ] 고급 분석: 그래프, 타임라인, 비교 분석
- [ ] 모바일 앱 (iOS/Android)
- [ ] 다중 언어 지원

#### 기술 부채

1. **타입 안정성 강화**
   - ExtMessage 타입 정확성 개선
   - PlaywrightController 제네릭화

2. **에러 처리**
   - 네트워크 오류 재시도 로직
   - Timeout 공통 처리

3. **테스트 커버리지**
   - Service Worker 단위 테스트
   - Content Script E2E 테스트
   - Gateway API 통합 테스트

4. **모니터링 및 로깅**
   - Extension 크래시 리포팅
   - Gateway 성능 모니터링
   - 사용자 이벤트 트래킹

---

## 부록 A: 용어 정의

| 용어 | 정의 |
|------|------|
| **세션 (Session)** | 하나의 리서치 주제에 대한 전체 분석 사이클 (1 이상 N 라운드) |
| **라운드 (Round)** | 한 번의 ChatGPT Deep Research + 분석 사이클 |
| **Deep Research** | ChatGPT의 웹 검색 기반 심층 조사 기능 |
| **보고서 (Report)** | ChatGPT가 한 라운드에서 생성한 분석 결과 |
| **분석 (Analysis)** | GLM + Brave + Claude의 3단계 검증 및 종합 |
| **후속 질문** | Claude가 생성한 다음 라운드용 질문 |
| **Manifest V3 (MV3)** | Chrome Extension의 최신 표준 (Service Worker 기반) |
| **Content Script** | 웹페이지 DOM에 주입되는 스크립트 |
| **Service Worker** | Extension의 백그라운드 프로세스 |
| **Side Panel** | Chrome Extension의 우측 패널 UI |
| **Gateway** | Extension과 모바일 웹 UI 간의 중개 서버 |
| **WebSocket** | Extension과 Gateway 간의 양방향 통신 |
| **Keep-alive** | Service Worker 타임아웃 방지 메커니즘 |
| **Polling** | 일정 간격으로 상태 확인 |
| **Fallback** | 주요 방법 실패 시 대체 방법 |

---

## 부록 B: 참고 자료

### B.1 외부 API 문서

- **GLM-4.7 API**: https://z.ai/api/coding/paas/v4/chat/completions
- **Brave Search API**: https://api.search.brave.com/res/v1/web/search
- **Claude Proxy**: https://github.com/anthropics/anthropic-sdk-python (claude-max-api-proxy)
- **Chrome Extension API**: https://developer.chrome.com/docs/extensions/

### B.2 사용 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| React | ^18.3.1 | UI 라이브러리 |
| TypeScript | ^5.7.2 | 타입 안전성 |
| Vite | ^6.0.7 | 번들러 |
| @crxjs/vite-plugin | ^2.3.0 | Chrome Extension 번들링 |
| Express | ^4.18.2 | 웹 서버 |
| ws | ^8.19.0 | WebSocket |
| better-sqlite3 | ^9.2.2 | SQLite ORM |
| Playwright | ^1.40.1 | 브라우저 자동화 (미사용) |
| Axios | 최신 | HTTP 클라이언트 |

---

## 부록 C: 트러블슈팅

### C.1 일반적인 문제

**문제**: Content Script가 주입되지 않음
- **원인**: ChatGPT 탭이 닫혀있거나 권한 부족
- **해결**:
  1. ChatGPT 탭 열기
  2. Extension 다시로드 (`chrome://extensions` 새로고침)
  3. PING 테스트로 활성 확인

**문제**: GLM API 호출 실패
- **원인**: API Key 미설정 또는 할당량 초과
- **해결**:
  1. Settings에서 GLM API Key 확인
  2. 요청 트래픽 (가끔 `WAITING_CONFIRM` 상태로 전이)

**문제**: Claude Proxy 연결 안 됨
- **원인**: 프록시 미실행 또는 포트 변경
- **해결**:
  1. `localhost:3456/v1/chat/completions` 테스트
  2. 프록시 로그 확인

**문제**: WebSocket 재연결 반복
- **원인**: Gateway 다운 또는 네트워크 오류
- **해결**:
  1. Gateway 상태 확인 (`/health` 엔드포인트)
  2. 방화벽 규칙 확인
  3. 포트 충돌 확인

### C.2 로그 확인

**Chrome Extension:**
- `chrome://extensions` → "CS Deep Research" → "Service Worker" 클릭
- 또는 `chrome://extensions` → "서비스 워커" 항목 우클릭 → "기타 로그 검사"

**Content Script:**
- ChatGPT 페이지에서 `Ctrl+Shift+I` → Console 탭
- `[CS-Extension]` 또는 `[CS-BG]` 필터

**Gateway Server:**
```bash
node dist/index.js
# 콘솔에 모든 요청 로그 출력
```

---

## 문서 이력

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0 | 2026-01-31 | 초안 작성 |

---

**작성자**: ChinaSearch 개발팀
**최종 검토**: 2026-01-31
**다음 검토 예정**: 2026-03-31

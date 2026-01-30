# CS-Extension: Deep Research Automation Chrome Extension

## 개요
ChatGPT 심층리서치 웹사이트를 그대로 사용하면서, 사이드패널에서 AI Agent가 결과를 읽어와 분석하고 후속 질문을 자동 생성하는 Chrome Extension.

## 핵심 플로우
```
1. 사용자가 ChatGPT 사이트에서 심층리서치 주제 입력 & 실행
2. 심층리서치 완료 대기 (10분+)
3. Agent가 결과 레포트를 DOM에서 읽어옴
4. GLM으로 세부 검증 리서치 (중국어 웹검색)
5. Claude Sonnet이 종합 분석 & 후속 질문 생성
6. 후속 질문을 ChatGPT 입력창에 자동 입력
7. 사용자가 수동 엔터 (또는 자동진행 모드)
8. 2-7 반복
```

## 아키텍처
```
Chrome Extension (Manifest V3)
├── sidepanel/          # 사이드패널 UI (React)
│   ├── 리서치 상태 대시보드
│   ├── 분석 결과 표시
│   ├── 수동/자동 모드 토글
│   └── 세션 히스토리
├── content-script/     # ChatGPT 페이지 DOM 조작
│   ├── 레포트 텍스트 추출
│   ├── 입력창에 텍스트 삽입
│   └── 심층리서치 완료 감지
├── background/         # Service Worker
│   ├── 세션 관리
│   ├── LLM API 호출 (GLM, Claude)
│   └── 상태 머신 (대기→읽기→분석→입력→대기)
└── shared/             # 공통 타입, 유틸
```

## 기술 스택
- **Chrome Extension**: Manifest V3
- **UI**: React + TypeScript (Vite 빌드)
- **LLM**:
  - GLM (zhipuai SDK → REST API): 중국어 웹검색 & 세부 검증
  - Claude (Anthropic REST API): 종합 분석 & 후속 질문 생성
- **상태관리**: chrome.storage.local
- **빌드**: Vite + CRXJS or 수동 빌드

## Content Script: ChatGPT DOM 인터랙션

### 레포트 읽기
- ChatGPT 심층리서치 결과는 마크다운 렌더링된 HTML
- `document.querySelector` 로 최신 assistant 메시지 추출
- MutationObserver로 새 메시지 감지

### 입력창 삽입
- ChatGPT 입력창: `textarea` 또는 `div[contenteditable]`
- 텍스트 삽입 후 input event dispatch
- 자동모드: 엔터키 이벤트도 dispatch

### 심층리서치 완료 감지
- "Deep research" 버튼 상태 변화 감지
- 또는 streaming 완료 감지 (typing indicator 소멸)

## 사이드패널 UI

### 상태 표시
- 현재 단계: 대기중 / 리서치중 / 읽는중 / 분석중 / 입력완료
- 라운드 카운터 (1/5, 2/5...)
- 모델별 사용량 (GLM calls, Claude calls)

### 분석 결과
- GLM 검증 결과 요약
- Claude 종합 분석
- 생성된 후속 질문 (편집 가능)

### 설정
- 자동/수동 모드 토글
- 최대 라운드 수 (기본 5)
- GLM API Key 입력
- Claude API Key 입력 (또는 Max 플랜 OAuth)

## 상태 머신
```
IDLE → WAITING_RESEARCH → READING_RESULT → ANALYZING →
INSERTING_QUESTION → WAITING_CONFIRM → WAITING_RESEARCH → ...
                                    ↓ (자동모드)
                              AUTO_SUBMIT → WAITING_RESEARCH
```

## API 키 관리
- GLM: 사용자가 직접 입력 (zhipuai API key)
- Claude: Anthropic API key 직접 입력
  - 또는 백엔드 프록시를 통한 호출 (CORS 회피)

## 파일 구조
```
CS-extension/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── background/
│   │   ├── index.ts          # Service Worker entry
│   │   ├── state-machine.ts  # 리서치 루프 상태머신
│   │   └── llm-client.ts     # GLM & Claude API 클라이언트
│   ├── content/
│   │   ├── index.ts          # Content script entry
│   │   ├── chatgpt-reader.ts # ChatGPT DOM 읽기
│   │   └── chatgpt-writer.ts # ChatGPT 입력창 쓰기
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── index.tsx         # React entry
│   │   ├── App.tsx           # 메인 앱
│   │   ├── components/
│   │   │   ├── StatusBar.tsx
│   │   │   ├── AnalysisView.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── SessionHistory.tsx
│   │   └── hooks/
│   │       └── useResearchSession.ts
│   └── shared/
│       ├── types.ts
│       ├── messages.ts       # Extension 메시지 타입
│       └── constants.ts
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── PRD.md
```

## 구현 우선순위
1. **Phase 1**: 프로젝트 셋업 (manifest, vite, typescript)
2. **Phase 2**: Content Script (ChatGPT DOM 읽기/쓰기)
3. **Phase 3**: Background (LLM 클라이언트, 상태머신)
4. **Phase 4**: Side Panel UI (React)
5. **Phase 5**: 통합 테스트 & 배포

## 제약사항
- ChatGPT DOM 구조는 변경될 수 있음 → selector를 상수로 관리
- CORS: Extension background에서는 fetch 가능 (host_permissions)
- 심층리서치 시간: 10분+ → 폴링 간격 조절 필요
- Claude Max 플랜: API key 방식 대신 OAuth 고려

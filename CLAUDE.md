# ChinaSearch - Claude Code 개발 가이드

## systemd 서비스 (필수)

코드 수정 후 반드시 관련 서비스를 재시작해야 합니다.

### 서비스 목록

| 서비스 | 포트 | 경로 |
|--------|------|------|
| `china-search-gateway` | 3004 | `gateway/dist/index.js` |
| `china-search-frontend` | 3003 | `gateway/frontend/` (Vite) |
| `china-search-claude-proxy` | 3456 | Claude Max API Proxy |

### 재시작 규칙 (코드 수정 시 반드시 따를 것)

- `gateway/src/` 수정 → `cd /home/nvme1/jhkim/00.Projects/ChinaSearch/gateway && npx tsc && systemctl --user restart china-search-gateway`
- `gateway/frontend/src/` 수정 → Vite HMR 자동 반영 (재시작 불필요)
- Extension(`src/`) 수정 → `cd /home/nvme1/jhkim/00.Projects/ChinaSearch && npm run build` (Extension 리로드 필요)
- claude-proxy는 설정 변경 시만 → `systemctl --user restart china-search-claude-proxy`

### 자주 쓰는 명령

```bash
# 상태 확인
systemctl --user status china-search-gateway china-search-frontend china-search-claude-proxy

# 전체 재시작
systemctl --user restart china-search-gateway china-search-frontend china-search-claude-proxy

# 개발 시 서비스 중지
systemctl --user stop china-search-gateway

# 로그 확인
journalctl --user -u china-search-gateway -f
journalctl --user -u china-search-claude-proxy -f
```

## 프로젝트 구조

- `src/` — Chrome Extension (MV3): content script, background service worker, sidepanel
- `gateway/` — Express + WebSocket 서버 (port 3004)
- `gateway/frontend/` — 모바일 웹 UI (Vite + React, port 3003)
- `dist/` — Extension 빌드 결과물

## 주요 포트

- 3003: 모바일 Frontend
- 3004: Gateway (API + WebSocket)
- 3456: Claude Proxy (claude-max-api-proxy)

## Git

- Remote: `git@github.com:gopeace88/ChinaSearch.git` (SSH)
- Branch: master

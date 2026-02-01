import type { ResearchSession, SessionState, AnalysisEntry, LLMUsage } from "../shared/types";
import { callGLM, callClaude, braveSearch } from "./llm-client";
import { POLL_INTERVAL_MS } from "../shared/constants";

let currentSession: ResearchSession | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let keepAlivePort: chrome.runtime.Port | null = null;
let chatGptTabId: number | null = null;
const usage: LLMUsage = { glmCalls: 0, claudeCalls: 0 };

type StateListener = (session: ResearchSession) => void;
const listeners: StateListener[] = [];

export function onStateChange(fn: StateListener) {
  listeners.push(fn);
}

function notify() {
  if (currentSession) listeners.forEach((fn) => fn(currentSession!));
}

function transition(state: SessionState) {
  if (!currentSession) return;
  currentSession.state = state;
  notify();
}

function logProgress(step: string, detail: string) {
  if (!currentSession) return;
  currentSession.progressLog.push({ time: Date.now(), step, detail });
  notify();
}

export function getSession(): ResearchSession | null {
  return currentSession;
}

export function getUsage(): LLMUsage {
  return { ...usage };
}

// Keep MV3 service worker alive during long operations
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
function startKeepAlive() {
  if (keepAliveInterval) return;
  // Ping self every 25s to prevent 30s idle timeout
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      console.log("[CS-BG] keep-alive ping");
    });
  }, 25000);
  console.log("[CS-BG] keep-alive started");
}
function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log("[CS-BG] keep-alive stopped");
  }
}

async function sendToTab(msg: { type: string; payload?: unknown }): Promise<any> {
  if (!chatGptTabId) throw new Error("No ChatGPT tab");
  return chrome.tabs.sendMessage(chatGptTabId, msg);
}

/**
 * Ensure content script is loaded on the target tab.
 * Manifest-declared content scripts only inject on NEW page loads after extension install.
 * For already-open tabs, we must inject programmatically.
 */
async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (res?.pong) {
      console.log("[CS-BG] Content script already active");
      return;
    }
  } catch {
    // Content script not loaded - inject it
  }

  console.log("[CS-BG] Injecting content script programmatically...");
  const manifest = chrome.runtime.getManifest();
  const files = manifest.content_scripts?.[0]?.js;
  if (!files || files.length === 0) {
    throw new Error("No content script files in manifest");
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  });
  // Wait for script to initialize
  await new Promise((r) => setTimeout(r, 500));

  // Verify
  const verify = await chrome.tabs.sendMessage(tabId, { type: "PING" });
  if (!verify?.pong) {
    throw new Error("Content script injection failed");
  }
  console.log("[CS-BG] Content script injected and verified");
}

export async function startSession(
  topic: string,
  settings: { glmApiKey: string; claudeApiKey: string; maxRounds: number; autoMode: boolean },
  sessionId?: string
) {
  // Check if there's already an active session
  if (currentSession) {
    throw new Error(`이미 실행 중인 세션이 있습니다: "${currentSession.topic}". 먼저 현재 세션을 종료해주세요.`);
  }

  // Find ChatGPT tab
  const tabs = await chrome.tabs.query({ url: ["*://chatgpt.com/*", "*://chat.openai.com/*"] });
  if (tabs.length === 0 || !tabs[0].id) {
    throw new Error("No ChatGPT tab found. Please open ChatGPT first.");
  }
  chatGptTabId = tabs[0].id;

  // Ensure content script is loaded on the tab
  await ensureContentScript(chatGptTabId);

  // Mark existing messages as seen so we don't process old ones
  await sendToTab({ type: "MARK_SEEN" });

  // Insert topic into ChatGPT input
  console.log("[CS-BG] Inserting topic into ChatGPT...");
  const autoSubmit = settings.autoMode;
  await sendToTab({
    type: "INSERT_QUESTION",
    payload: { question: topic, autoSubmit },
  });
  console.log(`[CS-BG] Topic inserted. ${autoSubmit ? 'Auto-submitting...' : 'User can review and press Enter.'}`);

  // Use provided sessionId from Gateway, or generate one if not provided
  const id = sessionId || Date.now().toString();
  console.log(`[CS-BG] Using session ID: ${id}`);

  currentSession = {
    id,
    topic,
    state: "WAITING_RESEARCH",
    round: 1,
    maxRounds: settings.maxRounds,
    autoMode: settings.autoMode,
    reports: [],
    analyses: [],
    progressLog: [],
    createdAt: Date.now(),
  };
  usage.glmCalls = 0;
  usage.claudeCalls = 0;

  logProgress("❓ ChatGPT에 연구 질문 전송", topic.slice(0, 200));
  notify();
  startPolling(settings);
}

export function cancelSession() {
  console.log("[CS-BG] Canceling session - generating internal report before clearing");

  // 폴링 중지
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  stopKeepAlive();

  // 현재 상태만 저장하고 세션 종료
  if (currentSession) {
    logProgress("🛑 세션 취소됨", "사용자가 세션을 취소했습니다. 내부 보고서 생성 중...");

    // Generate internal report before clearing session
    const internalReport = generateFinalReport();
    console.log("[CS-BG] Internal report generated, length:", internalReport.length);

    // Store report in session before transition
    currentSession.finalReport = internalReport;

    transition("IDLE");
    notify(); // UI 업데이트를 위해 마지막 상태 전달
  }

  // GPT에서 새 채팅 시작
  const tabId = chatGptTabId;
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: "NEW_CHAT" }).catch(() => {
      console.warn("[CS-BG] Failed to start new chat (tab may be closed)");
    });
  }

  // currentSession을 null로 설정하여 다음 세션 시작 가능
  currentSession = null;
  chatGptTabId = null;
  console.log("[CS-BG] Session cancelled, ready for new session");
}

export async function stopSession() {
  if (!currentSession || !chatGptTabId) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    stopKeepAlive();
    return;
  }

  // Ask ChatGPT to summarize the entire conversation
  const summaryPrompt = `지금까지의 모든 연구 내용을 종합하여 최종 보고서를 작성하고, 마크다운(.md) 파일로 다운로드할 수 있게 제공해주세요.

보고서 형식:

# 최종 연구 보고서: ${currentSession.topic}

## 핵심 발견사항
(가장 중요한 발견 3-5개)

## 상세 분석
(각 주제별 심층 분석)

## 확인된 사실 vs 불확실한 정보
(신뢰도 구분)

## 결론 및 제언
(최종 결론과 향후 연구 방향)

반드시 마크다운 파일(.md)로 다운로드할 수 있도록 제공해주세요.`;

  try {
    await sendToTab({
      type: "INSERT_QUESTION",
      payload: { question: summaryPrompt, autoSubmit: true },
    });
    logProgress("📝 최종 요약 요청", "ChatGPT에 전체 대화 기반 최종 보고서 작성 요청");

    // Mark current messages as seen so we detect the final report as a NEW message
    await sendToTab({ type: "MARK_SEEN" });

    // Keep service worker alive while waiting for final report
    startKeepAlive();

    // Transition to WAITING_FINAL_REPORT state instead of IDLE
    transition("WAITING_FINAL_REPORT");
    // Keep polling to capture the final report
  } catch (e) {
    console.error("[CS-BG] Failed to insert summary request:", e);
    // If failed to send request, go to IDLE directly
    transition("IDLE");
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    stopKeepAlive();
  }
}

function startPolling(settings: { glmApiKey: string; claudeApiKey: string; maxRounds: number; autoMode: boolean }) {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    if (!currentSession || !chatGptTabId) return;

    try {
      // Handle WAITING_FINAL_REPORT state
      if (currentSession.state === "WAITING_FINAL_REPORT") {
        // Timeout: if waiting too long (3 min), fall back to internal report
        const waitStart = (currentSession as any)._waitFinalReportSince || Date.now();
        if (!(currentSession as any)._waitFinalReportSince) {
          (currentSession as any)._waitFinalReportSince = Date.now();
        }
        const elapsed = Date.now() - waitStart;
        if (elapsed > 180_000) {
          console.log("[CS-Extension] Final report timeout, using internal report");
          logProgress("⚠️ 최종 보고서 시간 초과", "내부 보고서로 대체합니다");
          const internalReport = generateFinalReport();
          currentSession.finalReport = internalReport;
          transition("IDLE");
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          stopKeepAlive();
          notify();
          currentSession = null;
          chatGptTabId = null;
          return;
        }

        // Check if ChatGPT is still streaming
        const statusRes = await sendToTab({ type: "CHECK_RESEARCH_STATUS" });
        if (statusRes?.inProgress) {
          console.log("[CS-Extension] ChatGPT still generating final report, waiting...");
          return;
        }

        // Check for new message (final report)
        const msgRes = await sendToTab({ type: "CHECK_NEW_MESSAGE" });
        if (!msgRes?.content) return; // No new message yet

        const finalReportContent = msgRes.content as string;
        console.log("[CS-Extension] Final report received, length:", finalReportContent.length);
        logProgress("📋 최종 보고서 수신", `${finalReportContent.length}자 최종 보고서 저장 완료`);

        // Save final report
        currentSession.finalReport = finalReportContent;

        // Complete session
        transition("IDLE");
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        stopKeepAlive();
        notify();

        // Start new chat for next session
        const tabId = chatGptTabId;
        if (tabId) {
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { type: "NEW_CHAT" }).catch(() => {
              console.warn("[CS-BG] Failed to start new chat after final report");
            });
          }, 1000); // Wait 1 second for report to be fully displayed
        }

        // Clear session to allow new sessions
        currentSession = null;
        chatGptTabId = null;
        console.log("[CS-BG] Session completed, ready for new session");
        return;
      }

      // Handle WAITING_RESEARCH state
      if (currentSession.state !== "WAITING_RESEARCH") return;

      // If waiting for content growth (deep research mode), check if content has grown
      if (currentSession.waitingForGrowth) {
        const statusRes = await sendToTab({ type: "CHECK_RESEARCH_STATUS" });
        if (statusRes?.inProgress) {
          console.log("[CS-Extension] Deep research still in progress, waiting...");
          return;
        }
        const growthRes = await sendToTab({ type: "CHECK_CONTENT_GROWTH", payload: { minLength: 200 } });
        if (!growthRes?.content) return; // Not grown enough yet
        const grownContent = growthRes.content as string;
        console.log("[CS-Extension] Content growth detected, length:", grownContent.length);
        currentSession.waitingForGrowth = false;
        await processReport(grownContent, "심층리서치", settings);
        return;
      }

      // Check if ChatGPT is still streaming
      const statusRes = await sendToTab({ type: "CHECK_RESEARCH_STATUS" });
      if (statusRes?.inProgress) {
        console.log("[CS-Extension] ChatGPT still streaming, waiting...");
        return;
      }

      // Check for new message
      const msgRes = await sendToTab({ type: "CHECK_NEW_MESSAGE" });
      if (!msgRes?.content) return; // No new message yet

      const reportContent = msgRes.content as string;
      console.log("[CS-Extension] New message detected, length:", reportContent.length);

      // Skip very short responses — likely deep research initial acknowledgment
      // (e.g. "I'll research this for you" before actual research starts)
      const MIN_REPORT_LENGTH = 200;
      if (reportContent.length < MIN_REPORT_LENGTH) {
        console.log("[CS-Extension] Response too short (" + reportContent.length + " chars), likely not a real report. Will monitor for content growth.");
        logProgress("⏳ 짧은 응답 감지", `${reportContent.length}자 — 심층리서치 진행 중일 수 있음, 내용 증가 대기`);
        // Switch to content-growth monitoring mode
        if (!currentSession) return;
        currentSession.waitingForGrowth = true;
        return;
      }

      await processReport(reportContent, "", settings);
    } catch (err) {
      console.error("[CS-Extension] Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Common logic after receiving a report: save → analyze → build enriched question → insert → advance round.
 */
async function processReport(
  reportContent: string,
  logLabel: string,
  settings: { glmApiKey: string; claudeApiKey: string; maxRounds: number; autoMode: boolean }
): Promise<void> {
  if (!currentSession) return;

  logProgress("📥 보고서 수신" + (logLabel ? ` (${logLabel})` : ""), `${reportContent.length}자 수신 완료`);

  currentSession.reports.push({
    round: currentSession.round,
    content: reportContent,
    extractedAt: Date.now(),
  });

  transition("ANALYZING");
  startKeepAlive();
  let analysis: AnalysisEntry;
  try {
    analysis = await analyzeReport(reportContent, settings);
  } finally {
    stopKeepAlive();
  }
  if (!currentSession) return;
  currentSession.analyses.push(analysis);

  transition("INSERTING_QUESTION");
  const synthesisSummary = analysis.claudeAnalysis
    .replace(/### Follow-up Question[\s\S]*$/, "")
    .trim()
    .slice(0, 2000);
  const searchSummary = analysis.searchResults.slice(0, 1000);

  let enrichedQuestion = analysis.followUpQuestion;
  if (synthesisSummary || searchSummary) {
    enrichedQuestion += `\n\n[참고: 외부 검증 결과]\n`;
    if (searchSummary && searchSummary !== "(검색 결과 없음)") {
      enrichedQuestion += `${searchSummary}\n\n`;
    }
    if (synthesisSummary) {
      enrichedQuestion += `[분석 요약]\n${synthesisSummary}\n\n`;
    }
    enrichedQuestion += `위 외부 검증 정보를 참고하여 더 정확하고 깊이 있는 연구를 진행해주세요.`;
  }

  analysis.enrichedQuestion = enrichedQuestion;

  logProgress("❓ ChatGPT에 후속 질문 전송", analysis.followUpQuestion.slice(0, 200));

  await sendToTab({
    type: "INSERT_QUESTION",
    payload: { question: enrichedQuestion, autoSubmit: currentSession.autoMode },
  });

  currentSession.round++;
  if (currentSession.round > currentSession.maxRounds) {
    stopSession();
  } else {
    transition("WAITING_RESEARCH");
  }
}

async function analyzeReport(
  report: string,
  settings: { glmApiKey: string; claudeApiKey: string }
): Promise<AnalysisEntry> {
  // Snapshot session data upfront — currentSession can become null during async ops
  if (!currentSession) throw new Error("Session cancelled before analysis");
  const sessionSnapshot = {
    id: currentSession.id,
    topic: currentSession.topic,
    round: currentSession.round,
    maxRounds: currentSession.maxRounds,
    analyses: [...currentSession.analyses],
  };

  console.log("[CS-BG] analyzeReport START, report length:", report.length);
  logProgress("🔍 핵심 사실 추출 중", "GLM으로 보고서에서 검증 가능한 사실 추출...");

  // Extract key claims and search via Brave
  const extractPrompt = `从以下报告中提取3-5个最关键的可验证事实声明，每行一个，仅输出声明文本：\n${report.slice(0, 4000)}`;
  const extractResult = await callGLM(extractPrompt, settings.glmApiKey);
  usage.glmCalls++;
  notify();
  console.log("[CS-BG] Step 1 done, claims extracted:", extractResult.error || extractResult.text.slice(0, 200));

  const claims = extractResult.text.split("\n").filter((l) => l.trim().length > 5).slice(0, 5);
  logProgress("🌐 웹 검색 중", `${claims.length}개 사실에 대해 Brave 검색 실행...`);
  let searchContext = "";
  if (claims.length > 0) {
    // Sequential to avoid Brave 429 rate limiting
    const allResults: Awaited<ReturnType<typeof braveSearch>> = [];
    for (const claim of claims.slice(0, 3)) {
      const results = await braveSearch(claim.replace(/^\d+[.、]\s*/, ""), 2);
      allResults.push(...results);
      if (results.length > 0) await new Promise((r) => setTimeout(r, 500)); // rate limit delay
    }
    logProgress("🌐 웹 검색 완료", `${allResults.length}건의 검색 결과 확보`);
    console.log("[CS-BG] Step 2 done, search results:", allResults.length);
    if (allResults.length > 0) {
      searchContext = "\n\n## 网络搜索结果\n" + allResults.slice(0, 5).map((r) => `- [${r.title}](${r.url}): ${r.description.slice(0, 150)}`).join("\n");
    }
  } else {
    console.log("[CS-BG] Step 2 skipped, no claims");
  }

  logProgress("🧠 종합 분석 준비", "Claude에게 보고서 + 검색 결과 전달...");

  // Build previous rounds summary for context
  const prevRounds = sessionSnapshot.analyses.map((a) =>
    `Round ${a.round}: "${a.followUpQuestion}"`
  ).join("\n");

  const round = sessionSnapshot.round;
  const maxRounds = sessionSnapshot.maxRounds;
  const progressRatio = round / maxRounds; // 0.2 ~ 1.0

  // Phase guidance based on research progress
  let phaseGuidance: string;
  if (progressRatio <= 0.25) {
    phaseGuidance = `EARLY PHASE (기초 수집): 핵심 사실과 기본 구조를 파악하는 단계입니다. 주제의 핵심 변수와 현황을 넓게 탐색하세요.`;
  } else if (progressRatio <= 0.5) {
    phaseGuidance = `MID PHASE (심화 분석): 핵심 변수 간의 인과관계와 구조적 역학을 파고드는 단계입니다. "왜?"와 "어떤 메커니즘으로?"를 질문하세요.`;
  } else if (progressRatio <= 0.75) {
    phaseGuidance = `LATE PHASE (검증·비교): 확인된 사실을 다른 관점/비교군으로 교차 검증하는 단계입니다. 반대 의견, 리스크, 대안적 해석을 탐색하세요.`;
  } else {
    phaseGuidance = `FINAL PHASE (통합·실전): 지금까지의 분석을 종합하여 실행 가능한 결론을 도출하는 단계입니다. 전체를 하나의 판단 프레임으로 엮는 질문을 하세요. 예: 결론적 판단, 실전 적용, 시나리오별 대응 등.`;
  }

  const systemPrompt = `You are a research synthesis coordinator investigating a specific topic. Your session persists across rounds — you remember all previous analyses.

## CORE TOPIC (NEVER DRIFT FROM THIS)
"${sessionSnapshot.topic}"

## Your Role
- Synthesize each round's ChatGPT report with external evidence (Brave search results)
- Identify what is confirmed, what is uncertain, and what is missing
- Generate follow-up questions that DEEPEN understanding of the CORE TOPIC

## Research Phase Strategy
${phaseGuidance}

## Quality Rules for Follow-up Questions
- Every follow-up MUST directly relate to the CORE TOPIC
- Revisiting a previous angle from a DEEPER perspective (e.g., 현상→원인→수치 검증) is encouraged
- But do NOT ask the same question at the same depth — always go deeper or shift perspective
- If the report drifts off-topic, steer the follow-up back to the core topic
- Prefer "HOW" and "WHY" questions over "WHAT" questions
- Ask about mechanisms, causal paths, and trade-offs rather than simple facts
- Think: "What would a domain expert ask next to build a complete judgment framework?"

## Output Format
Output EXACTLY three sections in this order — no other text:

### Meta-Assessment
(Self-reflect on research trajectory so far. Answer briefly in 2-4 lines:)
- Axes explored so far: [list]
- Gaps remaining: [list]
- Self-diagnosis: repetitive? biased? shallow? drifting?
- Strategy adjustment for this round: [what to do differently]

### Synthesis
(Your analysis of this round's report + external evidence)

### Follow-up Question
(A single sentence question, informed by your meta-assessment)

## Rules
- Respond in the SAME language as the report
- No translations, no meta-commentary outside Meta-Assessment section, no markdown bold
- Meta-Assessment is for internal use — be honest and critical about the research trajectory`;

  const claudePrompt = `## Round ${round}/${maxRounds}
${prevRounds ? `\n## Previous Follow-up Questions (avoid exact repetition, but deeper revisits OK)\n${prevRounds}\n` : ""}
## ChatGPT Report (this round)
${report.slice(0, 6000)}

## External Evidence (Brave Search)
${searchContext || "(No search results available)"}

Produce your synthesis and follow-up question now.`;

  logProgress("🧠 Claude 종합 분석 중", "연구 결과 종합 및 후속 질문 생성...");
  let claudeResult: { text: string; error?: string };
  claudeResult = await callClaude(claudePrompt, "", systemPrompt, `cs-${sessionSnapshot.id}`);
  usage.claudeCalls++;
  notify();
  // If Claude proxy fails, fall back to GLM
  if (claudeResult.error) {
    logProgress("⚠️ Claude 실패, GLM 대체", claudeResult.error);
    claudeResult = await callGLM(claudePrompt, settings.glmApiKey);
    usage.glmCalls++;
    notify();
  }
  if (claudeResult.error) {
    logProgress("❌ 종합 분석 실패", claudeResult.error);
  } else {
    logProgress("🧠 종합 분석 완료", `${claudeResult.text.length}자 분석 결과 생성`);
  }

  // Parse meta-assessment (internal self-reflection)
  const metaMatch = claudeResult.text.match(/### Meta-Assessment\s*\n([\s\S]*?)(?=\n### Synthesis)/);
  const metaAssessment = metaMatch?.[1]?.trim() || "";

  // Extract synthesis (strip meta-assessment section)
  const synthesisOnward = claudeResult.text.replace(/### Meta-Assessment[\s\S]*?(?=\n### Synthesis)/, "").trim();

  const questionMatch = synthesisOnward.match(/### Follow-up Question\s*\n([\s\S]*?)(?:\n###|$)/);
  let followUpQuestion = questionMatch?.[1]?.trim() || "Please provide more details on the uncertain aspects.";
  // Extract only the actual question — first non-empty line that looks like a question
  const lines = followUpQuestion.split("\n").map((l) => l.trim()).filter((l) => l.length > 10);
  if (lines.length > 0) {
    // Take the first substantive line, strip markdown bold markers
    followUpQuestion = lines[0].replace(/^\*\*/, "").replace(/\*\*$/, "");
  }

  if (metaAssessment) {
    logProgress("🔄 자체 전략 조정", metaAssessment.split("\n")[0]?.slice(0, 80) || "전략 리뷰 완료");
  }

  return {
    round: sessionSnapshot.round,
    glmClaims: extractResult.text,
    searchResults: searchContext || "(검색 결과 없음)",
    claudeAnalysis: synthesisOnward,
    metaAssessment,
    followUpQuestion,
    enrichedQuestion: "", // will be filled by caller
    glmVerification: searchContext || "(검색 결과 없음)", // backward compat
    createdAt: Date.now(),
  };
}

export function confirmAndProceed(settings: { glmApiKey: string; claudeApiKey: string; maxRounds: number; autoMode: boolean }) {
  if (!currentSession || currentSession.state !== "WAITING_CONFIRM") return;
  currentSession.round++;
  if (currentSession.round > currentSession.maxRounds) {
    stopSession();
  } else {
    transition("WAITING_RESEARCH");
    startPolling(settings);
  }
}

export function generateFinalReport(): string {
  if (!currentSession) return "";

  const createdDate = new Date(currentSession.createdAt).toLocaleString("ko-KR");
  const currentRound = currentSession.round > currentSession.maxRounds ? currentSession.maxRounds : currentSession.round - 1;

  let report = `# 연구 보고서: ${currentSession.topic}\n\n`;
  report += `- 생성일: ${createdDate}\n`;
  report += `- 총 라운드: ${currentRound}/${currentSession.maxRounds}\n`;
  report += `- GLM 호출: ${usage.glmCalls}회 | Claude 호출: ${usage.claudeCalls}회\n`;
  report += `\n---\n\n`;

  // Add ChatGPT final report at the top if available
  if (currentSession.finalReport) {
    report += `## ChatGPT 최종 보고서\n\n`;
    report += `${currentSession.finalReport}\n\n`;
    report += `---\n\n`;
  }

  // Generate report for each completed round — full record of all data
  for (let i = 0; i < currentSession.analyses.length; i++) {
    const analysis = currentSession.analyses[i];
    const chatReport = currentSession.reports[i];

    report += `## Round ${analysis.round}\n\n`;

    if (chatReport) {
      report += `### 1. ChatGPT 연구 보고서\n\n`;
      report += `${chatReport.content}\n\n`;
    }

    if (analysis.glmClaims) {
      report += `### 2. GLM 추출 핵심 사실\n\n`;
      report += `${analysis.glmClaims}\n\n`;
    }

    if (analysis.searchResults && analysis.searchResults !== "(검색 결과 없음)") {
      report += `### 3. Brave 웹 검색 결과\n\n`;
      report += `${analysis.searchResults}\n\n`;
    }

    if (analysis.metaAssessment) {
      report += `### 4. Claude 자체 전략 평가\n\n`;
      report += `${analysis.metaAssessment}\n\n`;
    }

    report += `### 5. Claude 종합 분석\n\n`;
    report += `${analysis.claudeAnalysis}\n\n`;

    report += `### 6. 후속 질문 (원본)\n\n`;
    report += `> ${analysis.followUpQuestion}\n\n`;

    if (analysis.enrichedQuestion && analysis.enrichedQuestion !== analysis.followUpQuestion) {
      report += `### 7. ChatGPT에 전달된 전체 질문\n\n`;
      report += `${analysis.enrichedQuestion}\n\n`;
    }

    report += `---\n\n`;
  }

  return report;
}

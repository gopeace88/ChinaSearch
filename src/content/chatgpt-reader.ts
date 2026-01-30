/**
 * ChatGPT DOM reader - extracts assistant messages.
 * Uses message COUNT (not text comparison) to detect new messages reliably.
 * Uses window-level state to survive multiple script injections.
 */

// Store state on window to avoid duplicates from multiple injections
const WIN = window as any;
if (WIN.__csExtLastCount === undefined) {
  WIN.__csExtLastCount = -1; // -1 = not initialized
}

function getAssistantMessages(): Element[] {
  const selectors = [
    '[data-message-author-role="assistant"]',
    'div.agent-turn .markdown',
  ];
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) return Array.from(els);
  }
  return [];
}

export function extractLatestReport(): string | null {
  const messages = getAssistantMessages();
  if (messages.length === 0) return null;

  const last = messages[messages.length - 1];
  const markdown = last.querySelector('.markdown') || last.closest('.markdown') || last;
  return markdown.textContent?.trim() || null;
}

/**
 * Check if there's a NEW assistant message since last check.
 * Compares message count, not text content.
 */
export function checkForNewMessage(): string | null {
  const messages = getAssistantMessages();
  const currentCount = messages.length;

  console.log("[CS-Extension] Message count: current=" + currentCount + " last=" + WIN.__csExtLastCount);

  if (WIN.__csExtLastCount < 0) {
    // Not initialized — treat as no new message
    return null;
  }

  if (currentCount <= WIN.__csExtLastCount) {
    return null;
  }

  // New message(s) detected
  WIN.__csExtLastCount = currentCount;
  const last = messages[messages.length - 1];
  const markdown = last.querySelector('.markdown') || last.closest('.markdown') || last;
  return markdown.textContent?.trim() || null;
}

/**
 * Mark current message count as "seen"
 */
export function markCurrentAsSeen(): void {
  const count = getAssistantMessages().length;
  WIN.__csExtLastCount = count;
  console.log("[CS-Extension] Marked as seen, count=" + count);
}

/**
 * Check if ChatGPT is still generating a response (streaming)
 */
export function isStreaming(): boolean {
  const stopBtn = document.querySelector(
    'button[aria-label="Stop streaming"], button[data-testid="stop-button"]'
  );
  if (stopBtn) return true;

  const thinking = document.querySelector(
    '[data-testid="thinking-indicator"], .result-thinking'
  );
  if (thinking) return true;

  return false;
}

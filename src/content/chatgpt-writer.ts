/**
 * ChatGPT DOM writer - inserts text into input field
 */

function getInputElement(): HTMLElement | null {
  // ChatGPT's input is a contenteditable div with id "prompt-textarea"
  return document.querySelector<HTMLElement>('#prompt-textarea')
    || document.querySelector<HTMLElement>('div[contenteditable="true"]');
}

/**
 * Insert text into ChatGPT's input using execCommand for React compatibility
 */
export function insertText(text: string): boolean {
  const input = getInputElement();
  if (!input) {
    console.error("[CS-Extension] Input element not found");
    return false;
  }

  // Focus the input
  input.focus();

  // Clear existing content
  if (input.tagName === 'TEXTAREA') {
    (input as HTMLTextAreaElement).value = '';
  } else {
    // For contenteditable, select all and delete
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Use execCommand to insert text - this triggers React's change detection
  document.execCommand('insertText', false, text);

  // Also dispatch input event as backup
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));

  console.log("[CS-Extension] Text inserted:", text.slice(0, 50) + "...");
  return true;
}

/**
 * Click the send button to submit the question
 */
export function submitInput(): boolean {
  // Try send button selectors
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send"]',
    'form button[type="submit"]',
  ];

  for (const sel of selectors) {
    const btn = document.querySelector<HTMLButtonElement>(sel);
    if (btn && !btn.disabled) {
      btn.click();
      console.log("[CS-Extension] Send button clicked");
      return true;
    }
  }

  // Fallback: Enter key on input
  const input = getInputElement();
  if (input) {
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true,
    }));
    return true;
  }

  console.error("[CS-Extension] Could not find send button");
  return false;
}

/**
 * Click the "New chat" button to start a fresh conversation
 */
export function startNewChat(): boolean {
  // Try new chat button selectors (ChatGPT UI may vary)
  const selectors = [
    'a[href="/"]',  // Home link often starts new chat
    'button:has-text("New chat")',
    'a:has-text("New chat")',
    '[data-testid="new-chat-button"]',
    // Sidebar new chat button
    'nav a[href="/"]',
    // Icon-based selectors
    'button[aria-label="New chat"]',
    'a[aria-label="New chat"]',
  ];

  // Try clicking elements that contain "new chat" or pen icon
  for (const sel of selectors) {
    try {
      const btn = document.querySelector<HTMLElement>(sel);
      if (btn) {
        btn.click();
        console.log("[CS-Extension] New chat button clicked");
        return true;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  // Fallback: Look for any link/button with "New" or "새로운" text in sidebar
  const allButtons = Array.from(document.querySelectorAll<HTMLElement>('nav button, nav a, aside button, aside a'));
  for (const btn of allButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('new') || text.includes('새로운') || text.includes('새 채팅')) {
      btn.click();
      console.log("[CS-Extension] New chat button found and clicked via text search");
      return true;
    }
  }

  // Last resort: Navigate to root URL
  console.warn("[CS-Extension] New chat button not found, navigating to root");
  window.location.href = 'https://chatgpt.com/';
  return true;
}

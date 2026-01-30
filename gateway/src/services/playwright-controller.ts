import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, cpSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProgressData {
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentRound: number;
  maxRounds: number;
  currentQuestion?: string;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warning' | 'error';
    message: string;
  }>;
}

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionId: string;
  private extensionId: string | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async launch(): Promise<void> {
    try {
      console.log('[PlaywrightController] Extension-based mode - no browser launch needed');
      console.log('[PlaywrightController] Extension will handle all browser interactions via WebSocket');

      // No need to launch or connect to browser
      // Extension runs in user's logged-in Chrome and communicates via WebSocket
      this.extensionId = 'websocket-extension';

      console.log(`[PlaywrightController] Ready for session ${this.sessionId}`);
    } catch (error) {
      console.error('[PlaywrightController] Failed to initialize:', error);
      throw error;
    }
  }

  async startResearch(topic: string, maxRounds: number, files?: string[]): Promise<void> {
    if (!this.extensionId) {
      throw new Error('Extension not initialized');
    }

    try {
      // Extension handles all browser interactions
      console.log(`[PlaywrightController] Sending START_SESSION to extension: ${topic}`);

      // Send message to extension to start session
      const response = await this.sendMessageToExtension({
        type: 'START_SESSION',
        payload: {
          sessionId: this.sessionId,
          topic,
          maxRounds,
          files
        }
      });

      console.log('[PlaywrightController] Start research response:', response);
    } catch (error) {
      console.error('[PlaywrightController] Failed to start research:', error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (!this.extensionId) {
      throw new Error('Browser not launched');
    }

    await this.sendMessageToExtension({
      type: 'PAUSE_SESSION',
      payload: { sessionId: this.sessionId }
    });
  }

  async resume(): Promise<void> {
    if (!this.extensionId) {
      throw new Error('Browser not launched');
    }

    await this.sendMessageToExtension({
      type: 'RESUME_SESSION',
      payload: { sessionId: this.sessionId }
    });
  }

  async cancel(): Promise<void> {
    if (!this.extensionId) {
      throw new Error('Browser not launched');
    }

    await this.sendMessageToExtension({
      type: 'CANCEL_SESSION',
      payload: { sessionId: this.sessionId }
    });
  }

  async getProgress(): Promise<ProgressData> {
    if (!this.extensionId) {
      throw new Error('Browser not launched');
    }

    const response = await this.sendMessageToExtension({
      type: 'GET_PROGRESS',
      payload: { sessionId: this.sessionId }
    });

    return response as ProgressData;
  }

  async attachFiles(filePaths: string[]): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Wait for file input to be available
      await this.page.waitForSelector('input[type="file"]', { timeout: 10000 });

      // Attach files using Playwright's setInputFiles
      const fileInput = await this.page.locator('input[type="file"]');
      await fileInput.setInputFiles(filePaths);

      console.log(`[PlaywrightController] Attached ${filePaths.length} files`);
    } catch (error) {
      console.error('[PlaywrightController] Failed to attach files:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      this.browser = null;
      this.extensionId = null;

      console.log(`[PlaywrightController] Closed browser for session ${this.sessionId}`);
    } catch (error) {
      console.error('[PlaywrightController] Error closing browser:', error);
      throw error;
    }
  }

  private async getExtensionId(): Promise<string | null> {
    if (!this.context) return null;

    try {
      // Wait for service workers to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get all service workers
      const serviceWorkers = this.context.serviceWorkers();

      // Find our extension service worker
      for (const worker of serviceWorkers) {
        const url = worker.url();
        if (url.includes('chrome-extension://')) {
          // Extract extension ID from URL: chrome-extension://<extension-id>/...
          const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
          if (match) {
            const extensionId = match[1];
            console.log(`[PlaywrightController] Detected extension ID: ${extensionId}`);
            return extensionId;
          }
        }
      }

      // Fallback: try to detect via a test page
      console.log('[PlaywrightController] No service worker found, trying fallback method...');
      const testPage = await this.context.newPage();
      await testPage.goto('chrome://version/');
      await testPage.waitForTimeout(2000);

      // Get extension URLs from chrome://version page
      const extensionId = await testPage.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));
          for (const row of rows) {
            const text = row.textContent || '';
            if (text.includes('chrome-extension://')) {
              const match = text.match(/chrome-extension:\/\/([a-z]+)/);
              if (match) {
                return match[1];
              }
            }
          }
        }
        return null;
      });

      await testPage.close();

      if (extensionId) {
        console.log(`[PlaywrightController] Detected extension ID via fallback: ${extensionId}`);
      }

      return extensionId;
    } catch (error) {
      console.error('[PlaywrightController] Failed to get extension ID:', error);
      return null;
    }
  }

  private async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for login indicators
      const hasLoginButton = await this.page.locator('button:has-text("Log in")').count() > 0;
      return !hasLoginButton;
    } catch {
      return false;
    }
  }

  private async sendMessageToExtension(message: any): Promise<any> {
    try {
      console.log(`[PlaywrightController] Sending message to extension via WebSocket:`, message.type);

      // Import sendToExtension dynamically to avoid circular dependency
      const { sendToExtension } = await import('../index.js');

      const result = await sendToExtension(message);
      console.log(`[PlaywrightController] Extension response:`, result);

      return result;
    } catch (error) {
      console.error('[PlaywrightController] Failed to send message to extension:', error);
      throw error;
    }
  }
}

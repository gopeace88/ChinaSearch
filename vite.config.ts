import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync } from "fs";
import { join } from "path";
import manifest from "./manifest.json";

// Read auth tokens from clawdbot at build time
function loadAuthTokens() {
  try {
    const profilesPath = join(
      process.env.HOME || "/home/jhkim",
      ".clawdbot/agents/main/agent/auth-profiles.json"
    );
    const data = JSON.parse(readFileSync(profilesPath, "utf-8"));
    return {
      CLAUDE_OAUTH_TOKEN: data.profiles?.["anthropic:claude-cli"]?.access || "",
      GLM_API_KEY: "",
    };
  } catch {
    return { CLAUDE_OAUTH_TOKEN: "", GLM_API_KEY: "" };
  }
}

const tokens = loadAuthTokens();

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: { outDir: "dist" },
  define: {
    __CLAUDE_OAUTH_TOKEN__: JSON.stringify(tokens.CLAUDE_OAUTH_TOKEN),
    __GLM_API_KEY__: JSON.stringify(tokens.GLM_API_KEY || "edb1d1b247fd48feb8835efb1e327ef0.Ic5g7NxRX3Zs1ppt"),
    __BRAVE_API_KEY__: JSON.stringify("BSAU6sCCMUrVLTw438ahZngoXVREFvr"),
  },
});

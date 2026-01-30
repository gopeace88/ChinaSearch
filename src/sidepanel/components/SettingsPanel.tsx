import { useEffect, useState } from "react";
import type { Settings } from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/constants";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("settings").then((r) => {
      if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
    });
  }, []);

  const save = () => {
    chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", payload: settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ fontSize: 13 }}>
        GLM API Key
        <input
          type="password"
          value={settings.glmApiKey}
          onChange={(e) => setSettings({ ...settings, glmApiKey: e.target.value })}
          style={{ display: "block", width: "100%", padding: 6, marginTop: 4, border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
        />
      </label>

      <label style={{ fontSize: 13 }}>
        Claude API Key
        <input
          type="password"
          value={settings.claudeApiKey}
          onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
          style={{ display: "block", width: "100%", padding: 6, marginTop: 4, border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
        />
      </label>

      <label style={{ fontSize: 13 }}>
        Max Rounds (1-50)
        <input
          type="number"
          min={1}
          max={50}
          value={settings.maxRounds}
          onChange={(e) => setSettings({ ...settings, maxRounds: Number(e.target.value) })}
          style={{ display: "block", width: 80, padding: 6, marginTop: 4, border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }}
          placeholder="1-50"
        />
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          1에서 50 사이의 값을 입력하세요
        </div>
      </label>

      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={settings.autoMode}
          onChange={(e) => setSettings({ ...settings, autoMode: e.target.checked })}
        />
        Auto-submit mode
      </label>

      <button onClick={save} style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14 }}>
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}

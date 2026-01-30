#!/usr/bin/env node
/**
 * Test script for claude-max-api-proxy session management
 *
 * Tests that the proxy correctly uses --resume for existing sessions
 * and creates new sessions with --session-id
 */

async function testProxy() {
    const baseUrl = "http://localhost:8080";
    const sessionId = "test-session-" + Date.now();

    console.log("Testing claude-max-api-proxy with session management...\n");

    // Test 1: First request (should create new session)
    console.log("Test 1: Creating new session with ID:", sessionId);
    const response1 = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4",
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello from session test 1'"
                }
            ],
            user: sessionId, // Session ID passed via OpenAI user field
        }),
    });

    const result1 = await response1.json();
    console.log("Response 1:", JSON.stringify(result1, null, 2));
    console.log("Session ID from response:", result1.session_id);
    console.log();

    // Test 2: Second request (should resume existing session)
    console.log("Test 2: Resuming session with ID:", sessionId);
    const response2 = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4",
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello from session test 2'"
                }
            ],
            user: sessionId, // Same session ID
        }),
    });

    const result2 = await response2.json();
    console.log("Response 2:", JSON.stringify(result2, null, 2));
    console.log("Session ID from response:", result2.session_id);
    console.log();

    // Verify both responses have same session ID
    if (result1.session_id === result2.session_id) {
        console.log("✓ SUCCESS: Both requests used the same Claude session");
        console.log("  Session ID:", result1.session_id);
    } else {
        console.log("✗ FAILED: Session IDs don't match!");
        console.log("  Session 1:", result1.session_id);
        console.log("  Session 2:", result2.session_id);
    }
}

testProxy().catch(console.error);

#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=== Testing Gateway Server API ==="
echo

# Test health check
echo "1. Health Check:"
curl -s "${BASE_URL}/health" | jq .
echo -e "\n"

# Create a session
echo "2. Create Session:"
SESSION_ID=$(curl -s -X POST "${BASE_URL}/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{"topic": "AI Ethics in 2025", "maxRounds": 3}' | jq -r '.id')
echo "Created session ID: ${SESSION_ID}"
echo -e "\n"

# Get session details
echo "3. Get Session Details:"
curl -s "${BASE_URL}/api/sessions/${SESSION_ID}" | jq .
echo -e "\n"

# List all sessions
echo "4. List All Sessions:"
curl -s "${BASE_URL}/api/sessions" | jq .
echo -e "\n"

# Pause session
echo "5. Pause Session:"
curl -s -X POST "${BASE_URL}/api/sessions/${SESSION_ID}/pause" | jq .
echo -e "\n"

# Resume session
echo "6. Resume Session:"
curl -s -X POST "${BASE_URL}/api/sessions/${SESSION_ID}/resume" | jq .
echo -e "\n"

# Cancel session
echo "7. Cancel Session:"
curl -s -X POST "${BASE_URL}/api/sessions/${SESSION_ID}/cancel" | jq .
echo -e "\n"

echo "=== Test Complete ==="

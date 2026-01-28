#!/bin/bash
set -e

echo "=== Building frontend ==="
cd frontend
npm run build
cd ..

echo "=== Starting backend ==="
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

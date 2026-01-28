from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import Base, engine
from app.routers import sessions, interventions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ChinaSearch", version="0.1.0")
app.include_router(sessions.router)
app.include_router(interventions.router)

STATIC_DIR = Path(__file__).parent.parent / "static"


@app.get("/api/health")
def health():
    return {"status": "ok"}


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(STATIC_DIR / "index.html")

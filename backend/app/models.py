from datetime import datetime, timezone

from sqlalchemy import String, Text, Float, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ResearchSession(Base):
    __tablename__ = "research_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    goal: Mapped[str] = mapped_column(String(500))
    state_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="running")
    iteration_count: Mapped[int] = mapped_column(Integer, default=0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

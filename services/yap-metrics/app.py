"""
YAP Metrics Service
A lightweight FastAPI service for local-only metrics and history storage.
All data is stored on the server in SQLite and never transmitted externally.
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configuration from environment
METRICS_ENABLED = os.getenv("METRICS_ENABLED", "false").lower() == "true"
METRICS_STORE_TEXT = os.getenv("METRICS_STORE_TEXT", "false").lower() == "true"
METRICS_RETENTION_DAYS = int(os.getenv("METRICS_RETENTION_DAYS", "30"))
METRICS_MAX_EVENTS = int(os.getenv("METRICS_MAX_EVENTS", "5000"))
METRICS_DB_PATH = os.getenv("METRICS_DB_PATH", "/data/metrics.sqlite")

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:*,https://localhost:*").split(",")

app = FastAPI(
    title="YAP Metrics",
    description="Local-only metrics and history storage for YAP",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database helpers
@contextmanager
def get_db():
    """Get database connection with proper cleanup"""
    conn = sqlite3.connect(METRICS_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize database tables"""
    os.makedirs(os.path.dirname(METRICS_DB_PATH), exist_ok=True)
    
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                duration_seconds REAL DEFAULT 0,
                input_chars INTEGER DEFAULT 0,
                output_chars INTEGER DEFAULT 0,
                status TEXT DEFAULT 'success',
                text_content TEXT,
                metadata TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)")
        conn.commit()


def cleanup_old_events():
    """Remove events older than retention period and enforce max events"""
    with get_db() as conn:
        # Remove old events
        cutoff = (datetime.utcnow() - timedelta(days=METRICS_RETENTION_DAYS)).isoformat()
        conn.execute("DELETE FROM events WHERE timestamp < ?", (cutoff,))
        
        # Enforce max events (keep newest)
        conn.execute("""
            DELETE FROM events WHERE id NOT IN (
                SELECT id FROM events ORDER BY timestamp DESC LIMIT ?
            )
        """, (METRICS_MAX_EVENTS,))
        conn.commit()


# Initialize database on startup
@app.on_event("startup")
async def startup():
    if METRICS_ENABLED:
        init_db()
        cleanup_old_events()


# Request/Response models
class MetricEvent(BaseModel):
    """A single metrics event"""
    event_type: str = Field(..., description="Type: 'asr_record', 'asr_transcribe', 'tts_synthesize', 'tts_play'")
    duration_seconds: float = Field(default=0, description="Duration in seconds")
    input_chars: int = Field(default=0, description="Input character count")
    output_chars: int = Field(default=0, description="Output character count")
    status: str = Field(default="success", description="Status: 'success', 'error'")
    text_content: Optional[str] = Field(default=None, description="Text content (only stored if METRICS_STORE_TEXT=true)")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


class EventResponse(BaseModel):
    """Response for a stored event"""
    id: int
    timestamp: str
    event_type: str
    duration_seconds: float
    input_chars: int
    output_chars: int
    status: str
    text_content: Optional[str] = None
    metadata: Optional[dict] = None


class SummaryResponse(BaseModel):
    """Summary statistics"""
    range: str
    total_events: int
    asr_events: int
    tts_events: int
    asr_seconds_recorded: float
    asr_seconds_transcribed: float
    tts_seconds_generated: float
    total_input_chars: int
    total_output_chars: int


class HistoryResponse(BaseModel):
    """Paginated history response"""
    events: List[EventResponse]
    total: int
    limit: int
    offset: int


class ConfigResponse(BaseModel):
    """Metrics configuration"""
    enabled: bool
    store_text: bool
    retention_days: int
    max_events: int


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "metrics_enabled": METRICS_ENABLED,
        "store_text": METRICS_STORE_TEXT,
        "retention_days": METRICS_RETENTION_DAYS,
        "max_events": METRICS_MAX_EVENTS
    }


# Configuration endpoint
@app.get("/api/metrics/config", response_model=ConfigResponse)
async def get_config():
    """Get metrics configuration"""
    return ConfigResponse(
        enabled=METRICS_ENABLED,
        store_text=METRICS_STORE_TEXT,
        retention_days=METRICS_RETENTION_DAYS,
        max_events=METRICS_MAX_EVENTS
    )


# Record event
@app.post("/api/metrics/event", response_model=EventResponse)
async def record_event(event: MetricEvent):
    """Record a metrics event"""
    if not METRICS_ENABLED:
        raise HTTPException(status_code=503, detail="Metrics collection is disabled")
    
    timestamp = datetime.utcnow().isoformat()
    
    # Only store text if explicitly enabled
    text_content = event.text_content if METRICS_STORE_TEXT else None
    metadata_json = json.dumps(event.metadata) if event.metadata else None
    
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO events (timestamp, event_type, duration_seconds, input_chars, output_chars, status, text_content, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp,
            event.event_type,
            event.duration_seconds,
            event.input_chars,
            event.output_chars,
            event.status,
            text_content,
            metadata_json
        ))
        conn.commit()
        event_id = cursor.lastrowid
    
    # Periodic cleanup
    cleanup_old_events()
    
    return EventResponse(
        id=event_id,
        timestamp=timestamp,
        event_type=event.event_type,
        duration_seconds=event.duration_seconds,
        input_chars=event.input_chars,
        output_chars=event.output_chars,
        status=event.status,
        text_content=text_content,
        metadata=event.metadata
    )


# Get summary
@app.get("/api/metrics/summary", response_model=SummaryResponse)
async def get_summary(
    range: str = Query("7d", description="Time range: 'today', '7d', '30d', 'all'")
):
    """Get summary statistics for the specified time range"""
    if not METRICS_ENABLED:
        raise HTTPException(status_code=503, detail="Metrics collection is disabled")
    
    # Calculate cutoff time
    now = datetime.utcnow()
    if range == "today":
        cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif range == "7d":
        cutoff = (now - timedelta(days=7)).isoformat()
    elif range == "30d":
        cutoff = (now - timedelta(days=30)).isoformat()
    else:  # 'all'
        cutoff = "1970-01-01T00:00:00"
    
    with get_db() as conn:
        # Total events
        total = conn.execute(
            "SELECT COUNT(*) as count FROM events WHERE timestamp >= ?",
            (cutoff,)
        ).fetchone()["count"]
        
        # ASR events
        asr_stats = conn.execute("""
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(CASE WHEN event_type = 'asr_record' THEN duration_seconds ELSE 0 END), 0) as recorded,
                COALESCE(SUM(CASE WHEN event_type = 'asr_transcribe' THEN duration_seconds ELSE 0 END), 0) as transcribed,
                COALESCE(SUM(input_chars), 0) as input_chars,
                COALESCE(SUM(output_chars), 0) as output_chars
            FROM events 
            WHERE event_type LIKE 'asr_%' AND timestamp >= ?
        """, (cutoff,)).fetchone()
        
        # TTS events
        tts_stats = conn.execute("""
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(duration_seconds), 0) as generated,
                COALESCE(SUM(input_chars), 0) as input_chars,
                COALESCE(SUM(output_chars), 0) as output_chars
            FROM events 
            WHERE event_type LIKE 'tts_%' AND timestamp >= ?
        """, (cutoff,)).fetchone()
    
    return SummaryResponse(
        range=range,
        total_events=total,
        asr_events=asr_stats["count"],
        tts_events=tts_stats["count"],
        asr_seconds_recorded=asr_stats["recorded"],
        asr_seconds_transcribed=asr_stats["transcribed"],
        tts_seconds_generated=tts_stats["generated"],
        total_input_chars=asr_stats["input_chars"] + tts_stats["input_chars"],
        total_output_chars=asr_stats["output_chars"] + tts_stats["output_chars"]
    )


# Get history
@app.get("/api/metrics/history", response_model=HistoryResponse)
async def get_history(
    limit: int = Query(50, ge=1, le=500, description="Number of events to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    event_type: Optional[str] = Query(None, description="Filter by event type")
):
    """Get paginated event history"""
    if not METRICS_ENABLED:
        raise HTTPException(status_code=503, detail="Metrics collection is disabled")
    
    with get_db() as conn:
        # Build query
        where_clause = ""
        params = []
        
        if event_type:
            where_clause = "WHERE event_type = ?"
            params.append(event_type)
        
        # Get total count
        count_query = f"SELECT COUNT(*) as count FROM events {where_clause}"
        total = conn.execute(count_query, params).fetchone()["count"]
        
        # Get events
        query = f"""
            SELECT id, timestamp, event_type, duration_seconds, input_chars, output_chars, status, text_content, metadata
            FROM events {where_clause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        
        rows = conn.execute(query, params).fetchall()
        
        events = []
        for row in rows:
            metadata = json.loads(row["metadata"]) if row["metadata"] else None
            events.append(EventResponse(
                id=row["id"],
                timestamp=row["timestamp"],
                event_type=row["event_type"],
                duration_seconds=row["duration_seconds"],
                input_chars=row["input_chars"],
                output_chars=row["output_chars"],
                status=row["status"],
                text_content=row["text_content"],
                metadata=metadata
            ))
    
    return HistoryResponse(
        events=events,
        total=total,
        limit=limit,
        offset=offset
    )


# Clear history
@app.delete("/api/metrics/history")
async def clear_history(clear_text_only: bool = Query(False, description="Only clear stored text, keep events")):
    """Clear all history or just stored text"""
    if not METRICS_ENABLED:
        raise HTTPException(status_code=503, detail="Metrics collection is disabled")
    
    with get_db() as conn:
        if clear_text_only:
            conn.execute("UPDATE events SET text_content = NULL")
            message = "Stored text cleared"
        else:
            conn.execute("DELETE FROM events")
            message = "All history cleared"
        conn.commit()
    
    return {"success": True, "message": message}


# Export history as JSON
@app.get("/api/metrics/export")
async def export_history():
    """Export all history as JSON"""
    if not METRICS_ENABLED:
        raise HTTPException(status_code=503, detail="Metrics collection is disabled")
    
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, timestamp, event_type, duration_seconds, input_chars, output_chars, status, text_content, metadata
            FROM events ORDER BY timestamp DESC
        """).fetchall()
        
        events = []
        for row in rows:
            metadata = json.loads(row["metadata"]) if row["metadata"] else None
            events.append({
                "id": row["id"],
                "timestamp": row["timestamp"],
                "event_type": row["event_type"],
                "duration_seconds": row["duration_seconds"],
                "input_chars": row["input_chars"],
                "output_chars": row["output_chars"],
                "status": row["status"],
                "text_content": row["text_content"],
                "metadata": metadata
            })
    
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "total_events": len(events),
        "events": events
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8091)

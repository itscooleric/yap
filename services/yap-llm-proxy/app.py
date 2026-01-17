"""
YAP LLM Proxy Service
Forwards chat requests to configured LLM providers with authentication and error handling.
Supports OpenAI-compatible APIs (OpenWebUI, Ollama, OpenAI, etc.)
"""

import os
import json
import time
from datetime import datetime
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx


# Configuration from environment
def _get_int_env(name: str, default: int) -> int:
    """Safely parse an integer environment variable with a default fallback."""
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        print(f"[WARN] Invalid value for {name}={raw!r}; using default {default}")
        return default


def _get_float_env(name: str, default: float) -> float:
    """Safely parse a float environment variable with a default fallback."""
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except (TypeError, ValueError):
        print(f"[WARN] Invalid value for {name}={raw!r}; using default {default}")
        return default


LLM_PROVIDER_URL = os.getenv("LLM_PROVIDER_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
LLM_TIMEOUT = _get_int_env("LLM_TIMEOUT", 60)
LLM_MAX_TOKENS = _get_int_env("LLM_MAX_TOKENS", 2000)
LLM_TEMPERATURE = _get_float_env("LLM_TEMPERATURE", 0.7)

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:*,https://localhost:*").split(",")

# Logging configuration
LOG_REQUESTS = os.getenv("LOG_REQUESTS", "true").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    # Startup
    print("=" * 60)
    print("YAP LLM Proxy Service Starting")
    print("=" * 60)
    print(f"Provider URL: {LLM_PROVIDER_URL or '(not configured)'}")
    print(f"Model: {LLM_MODEL}")
    print(f"Timeout: {LLM_TIMEOUT}s")
    print(f"Max Tokens: {LLM_MAX_TOKENS}")
    print(f"Temperature: {LLM_TEMPERATURE}")
    print(f"Request Logging: {LOG_REQUESTS}")
    print("=" * 60)
    yield
    # Shutdown (nothing to cleanup)


app = FastAPI(
    title="YAP LLM Proxy",
    description="Forwards chat requests to LLM providers",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class Message(BaseModel):
    """Chat message"""
    role: str = Field(..., description="Role: 'system', 'user', or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Request to chat with LLM"""
    messages: List[Message] = Field(..., description="Conversation history")
    model: Optional[str] = Field(None, description="Model to use (overrides default)")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(None, ge=1, description="Maximum tokens in response")
    stream: bool = Field(False, description="Stream response (not supported)")


class ChatResponse(BaseModel):
    """Response from LLM"""
    message: str = Field(..., description="LLM response text")
    model: str = Field(..., description="Model that generated the response")
    usage: Optional[Dict[str, int]] = Field(None, description="Token usage statistics")
    finish_reason: Optional[str] = Field(None, description="Reason for completion")


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    detail: Optional[str] = None


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "llm-proxy",
        "provider_configured": bool(LLM_PROVIDER_URL),
        "model": LLM_MODEL
    }


def log_request(request_data: dict, response_data: dict = None, error: str = None, duration: float = 0):
    """Log request/response for debugging"""
    if not LOG_REQUESTS:
        return
    
    timestamp = datetime.utcnow().isoformat()
    log_entry = {
        "timestamp": timestamp,
        "request": request_data,
        "duration_seconds": round(duration, 2)
    }
    
    if response_data:
        log_entry["response"] = response_data
    if error:
        log_entry["error"] = error
    
    print(json.dumps(log_entry), flush=True)


@app.post("/chat", response_model=ChatResponse, responses={500: {"model": ErrorResponse}})
async def chat(request: ChatRequest):
    """
    Forward chat request to configured LLM provider.
    Supports OpenAI-compatible APIs.
    """
    if not LLM_PROVIDER_URL:
        raise HTTPException(
            status_code=503,
            detail="LLM provider not configured. Set LLM_PROVIDER_URL environment variable."
        )
    
    # Use provided parameters or defaults
    model = request.model or LLM_MODEL
    temperature = request.temperature if request.temperature is not None else LLM_TEMPERATURE
    max_tokens = request.max_tokens if request.max_tokens is not None else LLM_MAX_TOKENS
    
    if request.stream:
        raise HTTPException(
            status_code=400,
            detail="Streaming is not supported"
        )
    
    # Build OpenAI-compatible request
    llm_request = {
        "model": model,
        "messages": [{"role": msg.role, "content": msg.content} for msg in request.messages],
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    # Prepare headers
    headers = {
        "Content-Type": "application/json"
    }
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    
    # Log request
    request_data = {
        "model": model,
        "messages_count": len(request.messages),
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            response = await client.post(
                f"{LLM_PROVIDER_URL}/v1/chat/completions",
                headers=headers,
                json=llm_request
            )
            
            duration = time.time() - start_time
            
            if response.status_code != 200:
                error_msg = f"LLM provider returned status {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg = f"{error_msg}: {error_detail.get('error', {}).get('message', response.text[:200])}"
                except (ValueError, json.JSONDecodeError):
                    error_msg = f"{error_msg}: {response.text[:200]}"
                
                log_request(request_data, error=error_msg, duration=duration)
                raise HTTPException(status_code=response.status_code, detail=error_msg)
            
            # Parse response
            response_json = response.json()
            
            # Extract message from OpenAI format
            choices = response_json.get("choices", [])
            if not choices:
                error_msg = "No choices in LLM response"
                log_request(request_data, error=error_msg, duration=duration)
                raise HTTPException(status_code=500, detail=error_msg)
            
            message_content = choices[0].get("message", {}).get("content", "")
            finish_reason = choices[0].get("finish_reason")
            usage = response_json.get("usage")
            
            response_data = {
                "message_length": len(message_content),
                "finish_reason": finish_reason,
                "usage": usage
            }
            log_request(request_data, response_data, duration=duration)
            
            return ChatResponse(
                message=message_content,
                model=model,
                usage=usage,
                finish_reason=finish_reason
            )
            
    except httpx.TimeoutException:
        duration = time.time() - start_time
        error_msg = f"Request to LLM provider timed out after {LLM_TIMEOUT}s"
        log_request(request_data, error=error_msg, duration=duration)
        raise HTTPException(status_code=504, detail=error_msg)
    
    except httpx.RequestError as e:
        duration = time.time() - start_time
        error_msg = f"Failed to connect to LLM provider: {str(e)}"
        log_request(request_data, error=error_msg, duration=duration)
        raise HTTPException(status_code=502, detail=error_msg)
    
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"Unexpected error: {str(e)}"
        log_request(request_data, error=error_msg, duration=duration)
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/")
async def index():
    """API info"""
    return {
        "name": "YAP LLM Proxy",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Health check",
            "/chat": "Chat with LLM (POST)"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8092)

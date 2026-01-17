"""
YAP LLM Proxy Service
A lightweight FastAPI service that proxies chat requests to Ollama.
Handles CORS, error formatting, and provides a simple API for the Yap chat tab.
"""

import os
import httpx
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configuration from environment
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.2")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "120"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:*,https://localhost:*").split(",")

app = FastAPI(
    title="YAP LLM Proxy",
    description="Proxy service for LLM chat requests",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Models
class Message(BaseModel):
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to send to LLM")
    conversationHistory: List[Message] = Field(default=[], description="Previous messages in conversation")
    model: str = Field(default=DEFAULT_MODEL, description="Model to use for generation")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Temperature for generation")
    systemPrompt: Optional[str] = Field(default=None, description="System prompt to set LLM behavior")


class ChatResponse(BaseModel):
    response: str = Field(..., description="LLM response text")
    model: str = Field(..., description="Model used for generation")
    timestamp: str = Field(..., description="ISO timestamp of response")


class HealthResponse(BaseModel):
    status: str
    provider: str
    ollama_url: str
    default_model: str


# Routes
@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint - verifies service is running"""
    return HealthResponse(
        status="ok",
        provider="ollama",
        ollama_url=OLLAMA_URL,
        default_model=DEFAULT_MODEL
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Forward chat request to Ollama
    
    This endpoint:
    1. Builds messages array from conversation history
    2. Adds system prompt if provided
    3. Appends current user message
    4. Sends to Ollama /api/chat endpoint
    5. Returns formatted response
    """
    
    # Build messages array for Ollama
    messages = []
    
    # Add system prompt if provided
    if request.systemPrompt:
        messages.append({
            "role": "system",
            "content": request.systemPrompt
        })
    
    # Add conversation history
    for msg in request.conversationHistory:
        messages.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": request.message
    })
    
    # Prepare Ollama request payload
    ollama_payload = {
        "model": request.model,
        "messages": messages,
        "stream": False
    }
    
    # Add temperature if provided
    if request.temperature is not None:
        ollama_payload["options"] = {
            "temperature": request.temperature
        }
    
    # Call Ollama
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json=ollama_payload
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract response from Ollama format
            assistant_message = data.get("message", {}).get("content", "")
            
            if not assistant_message:
                raise HTTPException(
                    status_code=500,
                    detail="Ollama returned empty response"
                )
            
            return ChatResponse(
                response=assistant_message,
                model=request.model,
                timestamp=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            )
            
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail=f"Request to Ollama timed out after {REQUEST_TIMEOUT}s. Try a smaller model or increase timeout."
            )
        except httpx.HTTPStatusError as e:
            # Parse Ollama error if available
            try:
                error_data = e.response.json()
                error_msg = error_data.get("error", str(e))
            except Exception:
                error_msg = str(e)
            
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Ollama request failed: {error_msg}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to Ollama at {OLLAMA_URL}. Please ensure Ollama is running: ollama serve"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error: {str(e)}"
            )


@app.get("/models")
async def list_models():
    """
    List available models from Ollama
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            data = response.json()
            
            # Extract model names
            models = [model.get("name") for model in data.get("models", [])]
            
            return {
                "models": models,
                "default": DEFAULT_MODEL
            }
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot list models from Ollama: {str(e)}"
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

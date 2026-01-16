"""
YAP LLM Proxy Service

A lightweight proxy service that forwards chat requests to OpenAI-compatible LLM providers.
Supports OpenWebUI, Ollama, OpenAI, and other compatible endpoints.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Application metadata
APP_NAME = "yap-llm-proxy"
APP_VERSION = "1.0.0"

# Configuration from environment variables
LLM_PROVIDER_URL = os.getenv("LLM_PROVIDER_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "60"))  # seconds
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# Initialize FastAPI app
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Proxy service for forwarding chat requests to OpenAI-compatible LLM providers"
)

# Configure CORS
origins = CORS_ORIGINS.split(",") if CORS_ORIGINS != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class Message(BaseModel):
    """Chat message with role and content"""
    role: str = Field(..., description="Message role (system, user, or assistant)")
    content: str = Field(..., description="Message content")
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v not in ['system', 'user', 'assistant']:
            raise ValueError('Role must be system, user, or assistant')
        return v


class ChatRequest(BaseModel):
    """Chat completion request"""
    messages: List[Message] = Field(..., description="List of messages in the conversation")
    model: Optional[str] = Field(None, description="Model to use (overrides default)")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(1000, ge=1, le=8000, description="Maximum tokens to generate")
    stream: Optional[bool] = Field(False, description="Stream the response (not supported)")
    
    @field_validator('stream')
    @classmethod
    def validate_stream(cls, v):
        if v is True:
            raise ValueError('Streaming is not currently supported')
        return v


class ChatResponse(BaseModel):
    """Chat completion response"""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Optional[Dict[str, int]] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    provider_configured: bool
    model: str
    timestamp: str


class ErrorResponse(BaseModel):
    """Error response"""
    detail: str
    error_type: Optional[str] = None
    timestamp: str


# Routes
@app.get("/", response_model=Dict[str, Any])
async def index():
    """API information endpoint"""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "description": "Proxy service for OpenAI-compatible LLM providers",
        "endpoints": {
            "/": "API information",
            "/health": "Health check",
            "/chat": "Chat completion endpoint"
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        service=APP_NAME,
        version=APP_VERSION,
        provider_configured=bool(LLM_PROVIDER_URL),
        model=LLM_MODEL,
        timestamp=datetime.utcnow().isoformat()
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Forward chat completion request to configured LLM provider.
    
    Supports OpenAI-compatible endpoints including:
    - OpenWebUI
    - Ollama
    - OpenAI
    - Any other compatible provider
    """
    # Check if provider is configured
    if not LLM_PROVIDER_URL:
        logger.error("LLM provider URL not configured")
        raise HTTPException(
            status_code=503,
            detail="LLM provider not configured. Set LLM_PROVIDER_URL environment variable."
        )
    
    # Use provided model or default
    model = request.model or LLM_MODEL
    
    # Build request payload for OpenAI-compatible API
    payload = {
        "model": model,
        "messages": [msg.model_dump() for msg in request.messages],
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": False
    }
    
    # Build headers
    headers = {
        "Content-Type": "application/json"
    }
    
    # Add API key if configured
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    
    # Log request (without sensitive data)
    logger.info(f"Forwarding chat request: model={model}, messages={len(request.messages)}, temperature={request.temperature}")
    
    # Forward request to LLM provider
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            response = await client.post(
                LLM_PROVIDER_URL,
                json=payload,
                headers=headers
            )
            
            # Check for HTTP errors
            if response.status_code != 200:
                logger.error(f"LLM provider returned error status {response.status_code}")
                raise HTTPException(
                    status_code=502,
                    detail="LLM provider returned an error. Please check your configuration and try again."
                )
            
            # Parse and return response
            response_data = response.json()
            logger.info(f"LLM response received: {response_data.get('usage', {})}")
            
            return response_data
            
    except httpx.TimeoutException as e:
        logger.error(f"Request to LLM provider timed out after {LLM_TIMEOUT}s: {e}")
        raise HTTPException(
            status_code=504,
            detail=f"Request to LLM provider timed out after {LLM_TIMEOUT} seconds. The provider may be overloaded or unreachable."
        )
    except httpx.ConnectError as e:
        logger.error(f"Failed to connect to LLM provider: {e}")
        raise HTTPException(
            status_code=502,
            detail="Failed to connect to LLM provider. Check that the provider is running and accessible."
        )
    except httpx.RequestError as e:
        logger.error(f"Request to LLM provider failed: {e}")
        raise HTTPException(
            status_code=502,
            detail="Request to LLM provider failed. Please check your configuration."
        )
    except Exception as e:
        logger.exception(f"Unexpected error during LLM request: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later."
        )


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            detail=exc.detail,
            error_type="http_error",
            timestamp=datetime.utcnow().isoformat()
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Custom handler for unexpected exceptions"""
    logger.exception(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            detail="Internal server error",
            error_type="internal_error",
            timestamp=datetime.utcnow().isoformat()
        ).model_dump()
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8092)

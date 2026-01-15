"""
YAP Exporter Service
A lightweight FastAPI service for exporting transcripts to GitLab, GitHub, and SFTP.
Secrets are stored in environment variables, not in the browser.
"""

import os
import json
import base64
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

# Configuration from environment
GITLAB_URL = os.getenv("GITLAB_URL", "https://gitlab.com")
GITLAB_TOKEN = os.getenv("GITLAB_TOKEN", "")
GITHUB_API_URL = os.getenv("GITHUB_API_URL", "https://api.github.com")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

# SFTP settings (optional)
SFTP_HOST = os.getenv("SFTP_HOST", "")
SFTP_PORT = int(os.getenv("SFTP_PORT", "22"))
SFTP_USER = os.getenv("SFTP_USER", "")
SFTP_PASSWORD = os.getenv("SFTP_PASSWORD", "")
SFTP_KEY_PATH = os.getenv("SFTP_KEY_PATH", "")
SFTP_BASE_PATH = os.getenv("SFTP_BASE_PATH", "/uploads")

# Default export settings
EXPORT_DEFAULT_REPO = os.getenv("EXPORT_DEFAULT_REPO", "")
EXPORT_DEFAULT_BRANCH = os.getenv("EXPORT_DEFAULT_BRANCH", "main")

# CORS configuration from environment
# Default allows localhost only for security
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:*,https://localhost:*").split(",")

app = FastAPI(
    title="YAP Exporter",
    description="Export transcripts to GitLab, GitHub, or SFTP",
    version="1.0.0"
)

# CORS - defaults to localhost only
# Set CORS_ORIGINS env var to allow specific domains in production
# WARNING: Using "*" allows all origins and is a security risk
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ExportPayload(BaseModel):
    """Canonical export bundle"""
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    app_version: str = "1.0.0"
    transcript: str = ""
    raw_transcript: Optional[str] = None
    clips: list = Field(default_factory=list)


class GitCommitRequest(BaseModel):
    """Request for committing to GitLab or GitHub"""
    project_id: str  # GitLab project ID or GitHub "owner/repo"
    file_path: str = Field(default="inbox/{year}/{month}/{timestamp}.md")
    branch: str = "main"
    commit_message: Optional[str] = None
    generate_message: bool = False
    payload: ExportPayload


class SFTPUploadRequest(BaseModel):
    """Request for SFTP upload"""
    remote_path: Optional[str] = None  # Path on server (relative to SFTP_BASE_PATH)
    payload: ExportPayload


class ExportResponse(BaseModel):
    """Response for export operations"""
    success: bool
    message: str
    url: Optional[str] = None
    file_path: Optional[str] = None


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "gitlab_configured": bool(GITLAB_TOKEN),
        "github_configured": bool(GITHUB_TOKEN),
        "sftp_configured": bool(SFTP_HOST),
        "ollama_configured": bool(OLLAMA_BASE_URL)
    }


def format_file_path(template: str) -> str:
    """Format file path template with date variables"""
    now = datetime.utcnow()
    return template.format(
        year=now.strftime("%Y"),
        month=now.strftime("%m"),
        day=now.strftime("%d"),
        timestamp=now.strftime("%Y%m%d-%H%M%S"),
        date=now.strftime("%Y-%m-%d"),
        datetime=now.strftime("%Y-%m-%d_%H%M%S")
    )


def generate_markdown_content(payload: ExportPayload) -> str:
    """Generate markdown file content from export payload"""
    now = datetime.utcnow()
    
    content = f"""---
title: YAP Transcript Export
date: {now.strftime("%Y-%m-%d %H:%M:%S")} UTC
app_version: {payload.app_version}
clips_count: {len(payload.clips)}
---

# Transcript

{payload.transcript}

"""
    
    if payload.clips:
        content += "\n## Clips\n\n"
        for i, clip in enumerate(payload.clips, 1):
            clip_id = clip.get("id", f"clip-{i}")
            duration = clip.get("duration_ms", 0) / 1000
            transcript = clip.get("transcript", "")
            content += f"### Clip {i} ({clip_id})\n"
            content += f"*Duration: {duration:.1f}s*\n\n"
            content += f"{transcript}\n\n"
    
    return content


async def generate_commit_message(transcript: str) -> str:
    """Generate commit message using Ollama if configured"""
    if not OLLAMA_BASE_URL:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": f"Generate a very short (max 50 chars) commit message summarizing this transcript. Just output the message, no quotes or explanation:\n\n{transcript[:1000]}",
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                summary = data.get("response", "").strip()[:50]
                if summary:
                    now = datetime.utcnow()
                    return f"yap export: {summary} ({now.strftime('%Y-%m-%d %H:%M')})"
    except Exception as e:
        print(f"Ollama error: {e}")
    
    return None


def get_default_commit_message() -> str:
    """Generate default commit message"""
    now = datetime.utcnow()
    return f"yap export {now.strftime('%Y-%m-%d %H:%M:%S')}"


# GitLab Export
@app.post("/v1/export/gitlab/commit", response_model=ExportResponse)
async def export_gitlab_commit(request: GitCommitRequest):
    """Commit transcript to GitLab repository"""
    
    if not GITLAB_TOKEN:
        raise HTTPException(status_code=503, detail="GitLab not configured")
    
    file_path = format_file_path(request.file_path)
    content = generate_markdown_content(request.payload)
    
    # Generate or use provided commit message
    commit_message = request.commit_message
    if not commit_message:
        if request.generate_message:
            commit_message = await generate_commit_message(request.payload.transcript)
        if not commit_message:
            commit_message = get_default_commit_message()
    
    # GitLab API - create or update file
    project_id = request.project_id.replace("/", "%2F")
    api_url = f"{GITLAB_URL}/api/v4/projects/{project_id}/repository/files/{file_path.replace('/', '%2F')}"
    
    headers = {"PRIVATE-TOKEN": GITLAB_TOKEN}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check if file exists
        check_response = await client.get(
            api_url,
            headers=headers,
            params={"ref": request.branch}
        )
        
        if check_response.status_code == 200:
            # Update existing file
            response = await client.put(
                api_url,
                headers=headers,
                json={
                    "branch": request.branch,
                    "content": content,
                    "commit_message": commit_message
                }
            )
        else:
            # Create new file
            response = await client.post(
                api_url,
                headers=headers,
                json={
                    "branch": request.branch,
                    "content": content,
                    "commit_message": commit_message
                }
            )
        
        if response.status_code in [200, 201]:
            data = response.json()
            file_url = f"{GITLAB_URL}/{request.project_id}/-/blob/{request.branch}/{file_path}"
            return ExportResponse(
                success=True,
                message="Successfully committed to GitLab",
                url=file_url,
                file_path=file_path
            )
        else:
            error_detail = response.text[:200]
            raise HTTPException(
                status_code=response.status_code,
                detail=f"GitLab API error: {error_detail}"
            )


# GitHub Export
@app.post("/v1/export/github/commit", response_model=ExportResponse)
async def export_github_commit(request: GitCommitRequest):
    """Commit transcript to GitHub repository"""
    
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=503, detail="GitHub not configured")
    
    file_path = format_file_path(request.file_path)
    content = generate_markdown_content(request.payload)
    
    # Generate or use provided commit message
    commit_message = request.commit_message
    if not commit_message:
        if request.generate_message:
            commit_message = await generate_commit_message(request.payload.transcript)
        if not commit_message:
            commit_message = get_default_commit_message()
    
    # GitHub API - create or update file
    api_url = f"{GITHUB_API_URL}/repos/{request.project_id}/contents/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check if file exists (to get SHA for update)
        check_response = await client.get(
            api_url,
            headers=headers,
            params={"ref": request.branch}
        )
        
        payload = {
            "message": commit_message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": request.branch
        }
        
        if check_response.status_code == 200:
            # File exists, include SHA for update
            existing = check_response.json()
            payload["sha"] = existing.get("sha")
        
        response = await client.put(api_url, headers=headers, json=payload)
        
        if response.status_code in [200, 201]:
            data = response.json()
            file_url = data.get("content", {}).get("html_url", "")
            return ExportResponse(
                success=True,
                message="Successfully committed to GitHub",
                url=file_url,
                file_path=file_path
            )
        else:
            error_detail = response.text[:200]
            raise HTTPException(
                status_code=response.status_code,
                detail=f"GitHub API error: {error_detail}"
            )


# SFTP Export
@app.post("/v1/export/sftp/upload", response_model=ExportResponse)
async def export_sftp_upload(request: SFTPUploadRequest):
    """Upload transcript to SFTP server"""
    
    if not SFTP_HOST:
        raise HTTPException(status_code=503, detail="SFTP not configured")
    
    try:
        import paramiko
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="SFTP not available: paramiko not installed"
        )
    
    # Generate file path
    now = datetime.utcnow()
    if request.remote_path:
        remote_path = format_file_path(request.remote_path)
    else:
        remote_path = f"{SFTP_BASE_PATH}/yap-export-{now.strftime('%Y%m%d-%H%M%S')}.md"
    
    content = generate_markdown_content(request.payload)
    
    try:
        # Connect to SFTP
        transport = paramiko.Transport((SFTP_HOST, SFTP_PORT))
        
        if SFTP_KEY_PATH and os.path.exists(SFTP_KEY_PATH):
            # Try to load key automatically detecting type
            pkey = None
            for key_class in [paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey, paramiko.DSSKey]:
                try:
                    pkey = key_class.from_private_key_file(SFTP_KEY_PATH)
                    break
                except paramiko.SSHException:
                    continue
            
            if pkey is None:
                raise HTTPException(
                    status_code=500,
                    detail="Could not load SSH key - unsupported key format"
                )
            
            transport.connect(username=SFTP_USER, pkey=pkey)
        else:
            transport.connect(username=SFTP_USER, password=SFTP_PASSWORD)
        
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        # Ensure directory exists
        dir_path = os.path.dirname(remote_path)
        try:
            sftp.stat(dir_path)
        except FileNotFoundError:
            # Create directory tree
            parts = dir_path.split("/")
            current = ""
            for part in parts:
                if not part:
                    continue
                current = f"{current}/{part}"
                try:
                    sftp.stat(current)
                except FileNotFoundError:
                    sftp.mkdir(current)
        
        # Write file
        with sftp.file(remote_path, "w") as f:
            f.write(content)
        
        sftp.close()
        transport.close()
        
        return ExportResponse(
            success=True,
            message="Successfully uploaded via SFTP",
            file_path=remote_path
        )
        
    except HTTPException:
        # Re-raise HTTPException to preserve status code and detail
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SFTP error: {str(e)}")


# JSON export (for debugging/testing)
@app.post("/v1/export/json")
async def export_json(payload: ExportPayload):
    """Return the export payload as JSON (for testing)"""
    return {
        "success": True,
        "content": generate_markdown_content(payload),
        "payload": payload.dict()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)

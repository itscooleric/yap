# YAP Exporter

A lightweight FastAPI service for exporting YAP transcripts to:
- **GitLab** - Commit to a repository
- **GitHub** - Commit to a repository
- **SFTP** - Upload to a server

## Security

**Important**: This service holds API tokens and secrets in environment variables. Never expose this service to the public internet without authentication.

Recommended deployment:
- Run on `localhost` only (default)
- Use behind a reverse proxy with authentication if remote access needed
- Tokens are stored server-side, not in the browser

## Quick Start

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your tokens:
   ```bash
   # GitLab
   GITLAB_TOKEN=glpat-xxxx
   
   # GitHub
   GITHUB_TOKEN=ghp_xxxx
   ```

3. Start the service:
   ```bash
   docker compose up -d
   ```

4. Check health:
   ```bash
   curl http://localhost:8090/health
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns service status and configured integrations.

### GitLab Commit
```
POST /v1/export/gitlab/commit
Content-Type: application/json

{
  "project_id": "username/repo",
  "file_path": "inbox/{year}/{month}/{timestamp}.md",
  "branch": "main",
  "commit_message": "Optional custom message",
  "generate_message": false,
  "payload": {
    "transcript": "Your transcript text...",
    "clips": []
  }
}
```

### GitHub Commit
```
POST /v1/export/github/commit
Content-Type: application/json

{
  "project_id": "owner/repo",
  "file_path": "inbox/{year}/{month}/{timestamp}.md",
  "branch": "main",
  "commit_message": "Optional custom message",
  "generate_message": false,
  "payload": {
    "transcript": "Your transcript text...",
    "clips": []
  }
}
```

### SFTP Upload
```
POST /v1/export/sftp/upload
Content-Type: application/json

{
  "remote_path": "/exports/{timestamp}.md",
  "payload": {
    "transcript": "Your transcript text...",
    "clips": []
  }
}
```

## File Path Templates

Use these variables in `file_path`:
- `{year}` - 4-digit year (2024)
- `{month}` - 2-digit month (01-12)
- `{day}` - 2-digit day (01-31)
- `{timestamp}` - YYYYMMDD-HHMMSS
- `{date}` - YYYY-MM-DD
- `{datetime}` - YYYY-MM-DD_HHMMSS

Example: `inbox/{year}/{month}/{timestamp}.md` → `inbox/2024/01/20240115-143022.md`

## Ollama Integration

If `OLLAMA_BASE_URL` is configured, you can set `"generate_message": true` to auto-generate commit messages from the transcript content.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITLAB_URL` | GitLab instance URL | https://gitlab.com |
| `GITLAB_TOKEN` | GitLab personal access token | - |
| `GITHUB_API_URL` | GitHub API URL | https://api.github.com |
| `GITHUB_TOKEN` | GitHub personal access token | - |
| `OLLAMA_BASE_URL` | Ollama API URL (optional) | - |
| `OLLAMA_MODEL` | Ollama model for summaries | llama3 |
| `SFTP_HOST` | SFTP server hostname | - |
| `SFTP_PORT` | SFTP server port | 22 |
| `SFTP_USER` | SFTP username | - |
| `SFTP_PASSWORD` | SFTP password | - |
| `SFTP_KEY_PATH` | Path to SSH private key | - |
| `SFTP_BASE_PATH` | Base path for uploads | /uploads |

## Token Permissions

### GitLab
Create a personal access token with:
- `api` scope (for repository access)

### GitHub
Create a personal access token (classic) with:
- `repo` scope (for private repos)
- Or fine-grained token with Contents: Read and write

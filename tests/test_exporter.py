"""
Tests for YAP Exporter Service (GitLab/GitHub/SFTP export)

These tests verify the exporter service endpoints work correctly,
including GitLab HTTP export, GitHub HTTP export, and SFTP upload.
"""

import pytest
import requests
import os
from datetime import datetime


# Determine base URL from environment or use default for local testing
EXPORTER_BASE_URL = os.environ.get('EXPORTER_BASE_URL', 'http://localhost:8090')


class TestExporterHealth:
    """Test exporter service health endpoint"""

    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200 OK"""
        response = requests.get(f'{EXPORTER_BASE_URL}/health')
        assert response.status_code == 200

    def test_health_endpoint_returns_json(self):
        """Health endpoint should return JSON with status and configuration"""
        response = requests.get(f'{EXPORTER_BASE_URL}/health')
        data = response.json()
        assert 'status' in data
        assert data['status'] == 'ok'
        assert 'gitlab_configured' in data
        assert 'github_configured' in data
        assert 'sftp_configured' in data
        assert 'ollama_configured' in data


class TestExporterGitLabCommit:
    """Test GitLab commit export endpoint"""

    def test_gitlab_commit_requires_configuration(self):
        """GitLab commit should fail gracefully if not configured"""
        payload = {
            "project_id": "test/repo",
            "file_path": "test.md",
            "branch": "main",
            "commit_message": "Test commit",
            "payload": {
                "timestamp": datetime.utcnow().isoformat(),
                "app_version": "1.0.0",
                "transcript": "Test transcript",
                "clips": []
            }
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/gitlab/commit',
            json=payload
        )
        
        # Should either succeed (if configured) or return 503
        assert response.status_code in [200, 201, 503]
        
        if response.status_code == 503:
            data = response.json()
            assert 'detail' in data
            assert 'not configured' in data['detail'].lower()

    def test_gitlab_commit_validates_payload(self):
        """GitLab commit should validate required fields"""
        # Missing required fields
        payload = {
            "project_id": "test/repo",
            # Missing file_path, branch, payload
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/gitlab/commit',
            json=payload
        )
        
        # Should return validation error (422)
        assert response.status_code == 422


class TestExporterGitHubCommit:
    """Test GitHub commit export endpoint"""

    def test_github_commit_requires_configuration(self):
        """GitHub commit should fail gracefully if not configured"""
        payload = {
            "project_id": "owner/repo",
            "file_path": "test.md",
            "branch": "main",
            "commit_message": "Test commit",
            "payload": {
                "timestamp": datetime.utcnow().isoformat(),
                "app_version": "1.0.0",
                "transcript": "Test transcript",
                "clips": []
            }
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/github/commit',
            json=payload
        )
        
        # Should either succeed (if configured) or return 503
        assert response.status_code in [200, 201, 503]
        
        if response.status_code == 503:
            data = response.json()
            assert 'detail' in data
            assert 'not configured' in data['detail'].lower()

    def test_github_commit_validates_payload(self):
        """GitHub commit should validate required fields"""
        # Missing required fields
        payload = {
            "project_id": "owner/repo",
            # Missing file_path, branch, payload
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/github/commit',
            json=payload
        )
        
        # Should return validation error (422)
        assert response.status_code == 422


class TestExporterSFTPUpload:
    """Test SFTP upload export endpoint"""

    def test_sftp_upload_requires_configuration(self):
        """SFTP upload should fail gracefully if not configured"""
        payload = {
            "remote_path": "/test/test.md",
            "payload": {
                "timestamp": datetime.utcnow().isoformat(),
                "app_version": "1.0.0",
                "transcript": "Test transcript",
                "clips": []
            }
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/sftp/upload',
            json=payload
        )
        
        # Should either succeed (if configured) or return 503
        assert response.status_code in [200, 503]
        
        if response.status_code == 503:
            data = response.json()
            assert 'detail' in data
            assert 'not configured' in data['detail'].lower()


class TestExporterJSONExport:
    """Test JSON export endpoint (debugging/testing)"""

    def test_json_export_returns_content(self):
        """JSON export should return formatted content"""
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "app_version": "1.0.0",
            "transcript": "This is a test transcript.",
            "clips": [
                {
                    "id": "clip-1",
                    "duration_ms": 5000,
                    "transcript": "First clip"
                },
                {
                    "id": "clip-2",
                    "duration_ms": 3000,
                    "transcript": "Second clip"
                }
            ]
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/json',
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        assert data['success'] is True
        assert 'content' in data
        assert 'payload' in data
        
        # Check content contains expected data
        content = data['content']
        assert 'Transcript' in content
        assert payload['transcript'] in content
        assert 'Clips' in content

    def test_json_export_with_empty_clips(self):
        """JSON export should handle empty clips list"""
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "app_version": "1.0.0",
            "transcript": "Simple transcript without clips.",
            "clips": []
        }
        
        response = requests.post(
            f'{EXPORTER_BASE_URL}/v1/export/json',
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'content' in data

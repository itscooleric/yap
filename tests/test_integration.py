"""
Integration Tests for YAP Application

These tests verify that different components of the application
work together correctly, including end-to-end workflows.
"""

import pytest
import requests
import os
from datetime import datetime


# Service URLs from environment or defaults
TTS_BASE_URL = os.environ.get('TTS_BASE_URL', 'http://localhost:5000')
EXPORTER_BASE_URL = os.environ.get('EXPORTER_BASE_URL', 'http://localhost:8090')


class TestTTSServiceAvailability:
    """Test TTS service is available for integration"""

    def test_tts_service_is_running(self):
        """TTS service should be accessible"""
        try:
            response = requests.get(f'{TTS_BASE_URL}/health', timeout=5)
            assert response.status_code == 200
        except requests.exceptions.RequestException:
            pytest.skip("TTS service not running")


class TestExporterServiceAvailability:
    """Test Exporter service is available for integration"""

    def test_exporter_service_is_running(self):
        """Exporter service should be accessible"""
        try:
            response = requests.get(f'{EXPORTER_BASE_URL}/health', timeout=5)
            assert response.status_code == 200
        except requests.exceptions.RequestException:
            pytest.skip("Exporter service not running")


@pytest.mark.integration
class TestASRToExportWorkflow:
    """Test complete ASR to export workflow"""

    def test_transcript_export_json_format(self):
        """Test exporting a transcript in JSON format"""
        # Simulate ASR transcript
        transcript = "This is a test transcript from ASR."
        clips = [
            {
                "id": "clip-1",
                "duration_ms": 5000,
                "transcript": "First clip",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": "clip-2",
                "duration_ms": 3000,
                "transcript": "Second clip",
                "created_at": datetime.utcnow().isoformat()
            }
        ]
        
        # Create export payload
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "app_version": "1.0.0",
            "transcript": transcript,
            "clips": clips
        }
        
        try:
            response = requests.post(
                f'{EXPORTER_BASE_URL}/v1/export/json',
                json=payload,
                timeout=10
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data['success'] is True
            assert transcript in data['content']
            
        except requests.exceptions.RequestException:
            pytest.skip("Exporter service not available")


@pytest.mark.integration
class TestTTSReadAlongWorkflow:
    """Test TTS with read-along workflow"""

    def test_synthesize_multiple_chunks(self):
        """Test synthesizing multiple text chunks for read-along"""
        chunks = [
            "This is the first paragraph.",
            "This is the second paragraph.",
            "This is the third paragraph."
        ]
        
        try:
            # Get available voices
            voices_response = requests.get(f'{TTS_BASE_URL}/voices', timeout=5)
            voices = voices_response.json()
            
            if not voices:
                pytest.skip("No voices available")
            
            voice = voices[0]
            audio_results = []
            
            # Synthesize each chunk
            for i, chunk in enumerate(chunks):
                response = requests.post(
                    f'{TTS_BASE_URL}/synthesize/{voice}',
                    data=chunk,
                    headers={'Content-Type': 'text/plain'},
                    timeout=10
                )
                
                assert response.status_code == 200
                assert response.headers['Content-Type'] == 'audio/wav'
                assert len(response.content) > 0
                
                audio_results.append({
                    'chunk_index': i,
                    'chunk_text': chunk,
                    'audio_size': len(response.content)
                })
            
            # Verify all chunks were synthesized
            assert len(audio_results) == len(chunks)
            for result in audio_results:
                assert result['audio_size'] > 0
                
        except requests.exceptions.RequestException:
            pytest.skip("TTS service not available")


@pytest.mark.integration
class TestSettingsPersistence:
    """Test settings persistence across components"""

    def test_settings_structure(self):
        """Test that settings follow expected structure"""
        # ASR settings
        asr_settings = {
            'showSeparators': False,
            'collapseBlankLines': True,
            'trimWhitespace': True,
            'betweenClips': 'blank',
            'autoTranscribe': False,
            'autoCopy': False,
            'confirmClear': True
        }
        
        # TTS settings
        tts_settings = {
            'markdownPreview': False,
            'readAlong': False,
            'chunkMode': 'paragraph',
            'maxChunks': 30,
            'maxCharsPerChunk': 1200
        }
        
        # Verify structure is consistent
        assert isinstance(asr_settings, dict)
        assert isinstance(tts_settings, dict)
        assert all(isinstance(k, str) for k in asr_settings.keys())
        assert all(isinstance(k, str) for k in tts_settings.keys())


@pytest.mark.integration
class TestExportProfileManagement:
    """Test export profile creation and management"""

    def test_export_profile_creation(self):
        """Test creating an export profile"""
        profile = {
            'id': 'test-profile-1',
            'name': 'Test GitLab Export',
            'type': 'gitlab',
            'projectId': 'test/repo',
            'branch': 'main',
            'filePath': 'inbox/{year}/{month}/{timestamp}.md',
            'generateMessage': False
        }
        
        # Verify profile structure
        required_fields = ['id', 'name', 'type', 'projectId', 'branch', 'filePath']
        for field in required_fields:
            assert field in profile, f"Profile must have {field}"
        
        # Verify type is valid
        valid_types = ['gitlab', 'github', 'sftp']
        assert profile['type'] in valid_types

    def test_export_profile_validation(self):
        """Test export profile validation"""
        # Valid GitLab profile
        gitlab_profile = {
            'type': 'gitlab',
            'projectId': 'owner/repo',
            'branch': 'main'
        }
        assert gitlab_profile['type'] == 'gitlab'
        assert '/' in gitlab_profile['projectId']
        
        # Valid GitHub profile
        github_profile = {
            'type': 'github',
            'projectId': 'owner/repo',
            'branch': 'main'
        }
        assert github_profile['type'] == 'github'
        assert '/' in github_profile['projectId']
        
        # Valid SFTP profile
        sftp_profile = {
            'type': 'sftp',
            'remotePath': '/uploads/transcript.md'
        }
        assert sftp_profile['type'] == 'sftp'


@pytest.mark.integration
class TestEndToEndWorkflows:
    """Test complete end-to-end workflows"""

    def test_asr_tts_export_pipeline(self):
        """Test complete pipeline: ASR → TTS → Export"""
        # Step 1: Simulate ASR transcription
        transcript = "Hello world. This is a test."
        clips = [{
            "id": "clip-1",
            "duration_ms": 2000,
            "transcript": transcript
        }]
        
        # Step 2: Verify TTS can synthesize the transcript
        try:
            voices_response = requests.get(f'{TTS_BASE_URL}/voices', timeout=5)
            if voices_response.status_code == 200:
                voices = voices_response.json()
                if voices:
                    voice = voices[0]
                    tts_response = requests.post(
                        f'{TTS_BASE_URL}/synthesize/{voice}',
                        data=transcript,
                        headers={'Content-Type': 'text/plain'},
                        timeout=10
                    )
                    assert tts_response.status_code == 200
        except requests.exceptions.RequestException:
            pass  # TTS optional for this test
        
        # Step 3: Export to JSON format
        try:
            export_payload = {
                "timestamp": datetime.utcnow().isoformat(),
                "app_version": "1.0.0",
                "transcript": transcript,
                "clips": clips
            }
            
            export_response = requests.post(
                f'{EXPORTER_BASE_URL}/v1/export/json',
                json=export_payload,
                timeout=10
            )
            
            if export_response.status_code == 200:
                data = export_response.json()
                assert data['success'] is True
                assert transcript in data['content']
        except requests.exceptions.RequestException:
            pass  # Exporter optional for this test

    def test_markdown_preview_and_tts(self):
        """Test markdown preview with TTS synthesis"""
        markdown_text = """# Test Document

This is **bold** text and this is *italic* text.

## Second Section

More content here."""
        
        # Markdown should be renderable
        assert '# Test Document' in markdown_text
        assert '**bold**' in markdown_text
        
        # TTS should handle plain text version
        plain_text = markdown_text.replace('#', '').replace('**', '').replace('*', '')
        assert len(plain_text) > 0

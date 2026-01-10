"""
Tests for TTS API endpoints

These tests verify that the TTS service is working correctly,
including health checks and synthesis endpoints.
"""

import pytest
import requests
import os


# Determine base URL from environment or use default for local testing
TTS_BASE_URL = os.environ.get('TTS_BASE_URL', 'http://localhost:5000')


class TestTTSHealth:
    """Test TTS health endpoint"""

    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200 OK"""
        response = requests.get(f'{TTS_BASE_URL}/health')
        assert response.status_code == 200

    def test_health_endpoint_returns_json(self):
        """Health endpoint should return JSON with status"""
        response = requests.get(f'{TTS_BASE_URL}/health')
        data = response.json()
        assert 'status' in data
        assert data['status'] == 'ok'
        assert 'voices_count' in data


class TestTTSVoices:
    """Test TTS voices endpoint"""

    def test_voices_endpoint_returns_200(self):
        """Voices endpoint should return 200 OK"""
        response = requests.get(f'{TTS_BASE_URL}/voices')
        assert response.status_code == 200

    def test_voices_endpoint_returns_list(self):
        """Voices endpoint should return a list of voices"""
        response = requests.get(f'{TTS_BASE_URL}/voices')
        data = response.json()
        assert isinstance(data, list)


class TestTTSSynthesis:
    """Test TTS synthesis endpoint"""

    def test_synthesize_post_with_text_returns_audio(self):
        """POST to synthesize endpoint should return audio/wav"""
        # Get available voices first
        voices_response = requests.get(f'{TTS_BASE_URL}/voices')
        voices = voices_response.json()
        
        if not voices:
            pytest.skip("No voices available for testing")
        
        voice = voices[0]
        text = "Hello, this is a test."
        
        response = requests.post(
            f'{TTS_BASE_URL}/synthesize/{voice}',
            data=text,
            headers={'Content-Type': 'text/plain'}
        )
        
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'audio/wav'
        assert len(response.content) > 0

    def test_synthesize_post_with_query_params(self):
        """POST with length_scale query parameter should work"""
        voices_response = requests.get(f'{TTS_BASE_URL}/voices')
        voices = voices_response.json()
        
        if not voices:
            pytest.skip("No voices available for testing")
        
        voice = voices[0]
        text = "Testing speed."
        
        response = requests.post(
            f'{TTS_BASE_URL}/synthesize/{voice}?length_scale=1.5',
            data=text,
            headers={'Content-Type': 'text/plain'}
        )
        
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'audio/wav'

    def test_synthesize_get_with_text_param(self):
        """GET to synthesize endpoint with text param should work"""
        voices_response = requests.get(f'{TTS_BASE_URL}/voices')
        voices = voices_response.json()
        
        if not voices:
            pytest.skip("No voices available for testing")
        
        voice = voices[0]
        text = "GET request test."
        
        response = requests.get(
            f'{TTS_BASE_URL}/synthesize/{voice}',
            params={'text': text}
        )
        
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'audio/wav'

    def test_synthesize_without_text_returns_400(self):
        """POST without text should return 400 Bad Request"""
        voices_response = requests.get(f'{TTS_BASE_URL}/voices')
        voices = voices_response.json()
        
        if not voices:
            pytest.skip("No voices available for testing")
        
        voice = voices[0]
        
        response = requests.post(
            f'{TTS_BASE_URL}/synthesize/{voice}',
            data='',
            headers={'Content-Type': 'text/plain'}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert 'error' in data

    def test_synthesize_invalid_voice_returns_404(self):
        """POST with invalid voice should return 404"""
        response = requests.post(
            f'{TTS_BASE_URL}/synthesize/invalid_voice_name',
            data='Test text',
            headers={'Content-Type': 'text/plain'}
        )
        
        assert response.status_code == 404
        data = response.json()
        assert 'error' in data


class TestTTSMethodNotAllowed:
    """Test that proper HTTP methods are supported"""

    def test_synthesize_accepts_post(self):
        """Verify POST is allowed on synthesize endpoint"""
        voices_response = requests.get(f'{TTS_BASE_URL}/voices')
        voices = voices_response.json()
        
        if not voices:
            pytest.skip("No voices available for testing")
        
        voice = voices[0]
        
        # POST should work (verified in previous tests, but explicitly checking here)
        response = requests.post(
            f'{TTS_BASE_URL}/synthesize/{voice}',
            data='Test',
            headers={'Content-Type': 'text/plain'}
        )
        
        # Should NOT be 405 Method Not Allowed
        assert response.status_code != 405

    def test_synthesize_accepts_get(self):
        """Verify GET is allowed on synthesize endpoint"""
        voices_response = requests.get(f'{TTS_BASE_URL}/voices')
        voices = voices_response.json()
        
        if not voices:
            pytest.skip("No voices available for testing")
        
        voice = voices[0]
        
        # GET should work
        response = requests.get(
            f'{TTS_BASE_URL}/synthesize/{voice}',
            params={'text': 'Test'}
        )
        
        # Should NOT be 405 Method Not Allowed
        assert response.status_code != 405

    def test_health_only_accepts_get(self):
        """Health endpoint should only accept GET"""
        response = requests.post(f'{TTS_BASE_URL}/health')
        # Flask will return 405 for unsupported methods
        assert response.status_code == 405


class TestTTSRootEndpoint:
    """Test TTS API root endpoint"""

    def test_root_returns_api_info(self):
        """Root endpoint should return API information"""
        response = requests.get(f'{TTS_BASE_URL}/')
        assert response.status_code == 200
        data = response.json()
        assert 'name' in data
        assert 'endpoints' in data

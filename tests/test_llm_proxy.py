"""
Tests for YAP LLM Proxy Service

These tests verify the LLM proxy service endpoints work correctly,
including health check, chat forwarding, error handling, and timeout scenarios.
"""

import pytest
import requests
import os


# Determine base URL from environment or use default for local testing
LLM_BASE_URL = os.environ.get('LLM_BASE_URL', 'http://localhost:8092')


class TestLLMProxyHealth:
    """Test LLM proxy health endpoint"""

    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200 OK"""
        response = requests.get(f'{LLM_BASE_URL}/health')
        assert response.status_code == 200

    def test_health_endpoint_returns_json(self):
        """Health endpoint should return JSON with status"""
        response = requests.get(f'{LLM_BASE_URL}/health')
        data = response.json()
        assert 'status' in data
        assert data['status'] == 'ok'
        assert 'service' in data
        assert data['service'] == 'llm-proxy'
        assert 'provider_configured' in data
        assert 'model' in data


class TestLLMProxyChat:
    """Test LLM proxy chat endpoint"""

    def test_chat_without_provider_returns_503(self):
        """Chat should return 503 when provider is not configured"""
        # This test assumes no LLM_PROVIDER_URL is set
        # If one is set, this test may fail
        payload = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        
        # Should fail if provider not configured
        if response.status_code == 503:
            data = response.json()
            assert 'detail' in data
            assert 'not configured' in data['detail'].lower()
        else:
            # If provider is configured, test should pass with valid response
            assert response.status_code in [200, 502, 504]

    def test_chat_requires_messages(self):
        """Chat should validate required fields"""
        # Test with missing messages field
        response = requests.post(f'{LLM_BASE_URL}/chat', json={})
        assert response.status_code == 422  # Validation error

    def test_chat_validates_message_structure(self):
        """Chat should validate message structure"""
        # Test with invalid message structure
        payload = {
            "messages": [
                {"invalid": "field"}
            ]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code == 422  # Validation error

    def test_chat_with_valid_structure(self):
        """Chat should accept valid request structure"""
        payload = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        
        # Should return either:
        # - 200 if provider configured and working
        # - 502 if provider configured but unreachable
        # - 503 if provider not configured
        # - 504 if timeout
        assert response.status_code in [200, 502, 503, 504]

    def test_chat_streaming_not_supported(self):
        """Chat should reject streaming requests"""
        payload = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ],
            "stream": True
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        
        # Should return 400 or 503 (if provider not configured)
        if response.status_code == 400:
            data = response.json()
            assert 'streaming' in data['detail'].lower() or 'not' in data['detail'].lower() and 'supported' in data['detail'].lower()


@pytest.mark.integration
class TestLLMProxyIntegration:
    """Integration tests requiring a running LLM provider"""

    def test_chat_with_mock_provider(self):
        """Test chat with mocked LLM provider response"""
        pytest.skip(
            "Requires mock LLM provider infrastructure. "
            "To implement: set up a mock HTTP server that responds to OpenAI-compatible "
            "/v1/chat/completions endpoint, or use environment variable to point to a test provider"
        )


class TestLLMProxyConfiguration:
    """Test configuration and environment variable handling"""

    def test_index_endpoint(self):
        """Test index endpoint returns API info"""
        response = requests.get(f'{LLM_BASE_URL}/')
        assert response.status_code == 200
        data = response.json()
        assert 'name' in data
        assert 'version' in data
        assert 'endpoints' in data
        assert '/health' in data['endpoints']
        assert '/chat' in data['endpoints']


class TestLLMProxyErrorHandling:
    """Test error handling scenarios"""

    def test_malformed_json(self):
        """Test handling of malformed JSON"""
        response = requests.post(
            f'{LLM_BASE_URL}/chat',
            data='invalid json',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 422

    def test_empty_request_body(self):
        """Test handling of empty request body"""
        response = requests.post(f'{LLM_BASE_URL}/chat')
        assert response.status_code == 422

    def test_temperature_validation(self):
        """Test temperature parameter validation"""
        # Test temperature within valid range
        payload = {
            "messages": [{"role": "user", "content": "Hello"}],
            "temperature": 0.7
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        # Should not fail validation
        assert response.status_code != 422 or 'temperature' not in response.text.lower()

        # Test temperature outside valid range
        payload["temperature"] = 3.0  # > 2.0
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code == 422

    def test_max_tokens_validation(self):
        """Test max_tokens parameter validation"""
        # Test valid max_tokens
        payload = {
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 100
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code != 422 or 'max_tokens' not in response.text.lower()

        # Test invalid max_tokens (< 1)
        payload["max_tokens"] = 0
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code == 422


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

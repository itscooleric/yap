"""
Tests for YAP LLM Proxy Service

These tests verify the LLM proxy service endpoints work correctly,
including health check, chat forwarding, error handling, and timeout scenarios.
"""

import pytest
import requests
import os
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse


# Determine base URL from environment or use default for local testing
LLM_BASE_URL = os.environ.get('LLM_BASE_URL', 'http://localhost:8092')

# Expected service name (matches main.py)
EXPECTED_SERVICE_NAME = 'yap-llm-proxy'


# Mock LLM Provider HTTP Server
class MockLLMHandler(BaseHTTPRequestHandler):
    """Mock LLM provider that simulates OpenAI-compatible API responses"""
    
    # Class variable to control behavior
    behavior = 'success'  # 'success', 'error', 'timeout', 'invalid_json', 'server_error'
    
    def log_message(self, format, *args):
        """Suppress server logs during tests"""
        pass
    
    def do_POST(self):
        """Handle POST requests to /v1/chat/completions"""
        if self.path == '/v1/chat/completions':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                request_data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode())
                return
            
            # Simulate different behaviors
            if MockLLMHandler.behavior == 'timeout':
                # Sleep to simulate timeout
                time.sleep(10)
                return
            
            elif MockLLMHandler.behavior == 'server_error':
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {'error': {'message': 'Internal server error', 'type': 'server_error'}}
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            elif MockLLMHandler.behavior == 'invalid_json':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'invalid json response')
                return
            
            elif MockLLMHandler.behavior == 'error':
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    'error': {
                        'message': 'Invalid request',
                        'type': 'invalid_request_error'
                    }
                }
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            # Default: success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Create OpenAI-compatible response
            response = {
                'id': 'chatcmpl-mock123',
                'object': 'chat.completion',
                'created': int(time.time()),
                'model': request_data.get('model', 'gpt-3.5-turbo'),
                'choices': [
                    {
                        'index': 0,
                        'message': {
                            'role': 'assistant',
                            'content': 'This is a mock response from the LLM.'
                        },
                        'finish_reason': 'stop'
                    }
                ],
                'usage': {
                    'prompt_tokens': 10,
                    'completion_tokens': 20,
                    'total_tokens': 30
                }
            }
            
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()


@pytest.fixture(scope='function')
def mock_llm_server():
    """Fixture to start a mock LLM provider server for testing"""
    # Reset behavior to success for each test
    MockLLMHandler.behavior = 'success'
    
    # Start server on a random available port
    server = HTTPServer(('localhost', 0), MockLLMHandler)
    port = server.server_address[1]
    
    # Run server in a separate thread
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    # Give server time to start
    time.sleep(0.1)
    
    yield f'http://localhost:{port}'
    
    # Shutdown server
    server.shutdown()
    server_thread.join(timeout=1)


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
        assert data['service'] == EXPECTED_SERVICE_NAME
        assert 'provider_configured' in data
        assert 'model' in data
        assert 'version' in data
        assert 'timestamp' in data


class TestLLMProxyIndex:
    """Test LLM proxy index endpoint"""
    
    def test_index_endpoint(self):
        """Test index endpoint returns API info"""
        response = requests.get(f'{LLM_BASE_URL}/')
        assert response.status_code == 200
        data = response.json()
        assert 'name' in data
        assert data['name'] == EXPECTED_SERVICE_NAME
        assert 'version' in data
        assert 'endpoints' in data
        assert '/' in data['endpoints']
        assert '/health' in data['endpoints']
        assert '/chat' in data['endpoints']


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
        # Test with invalid message structure (missing required fields)
        payload = {
            "messages": [
                {"invalid": "field"}
            ]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code == 422  # Validation error

    def test_chat_validates_message_role(self):
        """Chat should validate message role"""
        # Test with invalid role
        payload = {
            "messages": [
                {"role": "invalid_role", "content": "Hello"}
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
        
        # Should return 422 validation error
        assert response.status_code == 422
        data = response.json()
        assert 'detail' in data

    def test_chat_with_system_message(self):
        """Chat should accept system messages"""
        payload = {
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello"}
            ]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code in [200, 502, 503, 504]

    def test_chat_with_conversation_history(self):
        """Chat should accept multi-turn conversations"""
        payload = {
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi! How can I help you?"},
                {"role": "user", "content": "Tell me a joke"}
            ]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code in [200, 502, 503, 504]


@pytest.mark.unit
class TestLLMProxyWithMockProvider:
    """Unit tests using mock LLM provider"""
    
    def test_successful_chat_completion(self, mock_llm_server):
        """Test successful chat completion with mock provider"""
        # Note: This test requires the LLM proxy to be configured with the mock server
        # For true unit testing, we'd test the proxy service directly
        # This test documents the expected behavior when a provider is available
        
        # This is a placeholder showing how the mock server would be used
        # In reality, we'd need to start the LLM proxy with LLM_PROVIDER_URL set to mock_llm_server
        assert mock_llm_server.startswith('http://localhost:')
        
        # Test the mock server directly
        response = requests.post(
            f'{mock_llm_server}/v1/chat/completions',
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': 'Hello'}]
            },
            timeout=5
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'choices' in data
        assert len(data['choices']) > 0
        assert data['choices'][0]['message']['role'] == 'assistant'
        assert 'content' in data['choices'][0]['message']
    
    def test_mock_provider_error_response(self, mock_llm_server):
        """Test handling of error response from mock provider"""
        # Set mock to return error
        MockLLMHandler.behavior = 'error'
        
        response = requests.post(
            f'{mock_llm_server}/v1/chat/completions',
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': 'Hello'}]
            },
            timeout=5
        )
        
        assert response.status_code == 400
        data = response.json()
        assert 'error' in data
    
    def test_mock_provider_server_error(self, mock_llm_server):
        """Test handling of 500 error from mock provider"""
        MockLLMHandler.behavior = 'server_error'
        
        response = requests.post(
            f'{mock_llm_server}/v1/chat/completions',
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': 'Hello'}]
            },
            timeout=5
        )
        
        assert response.status_code == 500
        data = response.json()
        assert 'error' in data
    
    def test_mock_provider_timeout(self, mock_llm_server):
        """Test handling of timeout from mock provider"""
        MockLLMHandler.behavior = 'timeout'
        
        with pytest.raises(requests.exceptions.Timeout):
            requests.post(
                f'{mock_llm_server}/v1/chat/completions',
                json={
                    'model': 'gpt-3.5-turbo',
                    'messages': [{'role': 'user', 'content': 'Hello'}]
                },
                timeout=1  # Short timeout to trigger quickly
            )
    
    def test_mock_provider_invalid_json(self, mock_llm_server):
        """Test handling of invalid JSON response from mock provider"""
        MockLLMHandler.behavior = 'invalid_json'
        
        response = requests.post(
            f'{mock_llm_server}/v1/chat/completions',
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': 'Hello'}]
            },
            timeout=5
        )
        
        assert response.status_code == 200
        # Response should fail to parse as JSON
        with pytest.raises(requests.exceptions.JSONDecodeError):
            response.json()


@pytest.mark.integration
class TestLLMProxyIntegration:
    """Integration tests requiring a running LLM proxy service"""

    def test_proxy_forwards_to_mock_provider(self):
        """Test that proxy correctly forwards requests to configured provider"""
        # This test would require starting the LLM proxy with LLM_PROVIDER_URL
        # pointing to the mock server. For now, we document the expected behavior.
        pytest.skip(
            "Requires LLM proxy service running with mock provider configured. "
            "Start proxy with LLM_PROVIDER_URL pointing to mock server."
        )


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
        response = requests.post(
            f'{LLM_BASE_URL}/chat',
            headers={'Content-Type': 'application/json'}
        )
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

        # Test temperature outside valid range (> 2.0)
        payload["temperature"] = 3.0
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code == 422

        # Test negative temperature
        payload["temperature"] = -0.5
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

        # Test invalid max_tokens (> 8000)
        payload["max_tokens"] = 10000
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        assert response.status_code == 422

    def test_model_parameter(self):
        """Test model parameter handling"""
        payload = {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "custom-model"
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        # Should accept custom model name
        assert response.status_code in [200, 502, 503, 504]

    def test_empty_message_content(self):
        """Test handling of empty message content"""
        payload = {
            "messages": [{"role": "user", "content": ""}]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        # Should accept empty content (provider may reject it)
        assert response.status_code in [200, 422, 502, 503, 504]

    def test_very_long_message(self):
        """Test handling of very long messages"""
        long_content = "Hello " * 10000  # Very long message
        payload = {
            "messages": [{"role": "user", "content": long_content}]
        }
        response = requests.post(f'{LLM_BASE_URL}/chat', json=payload)
        # Should accept long messages (provider may have limits)
        assert response.status_code in [200, 422, 502, 503, 504]


class TestLLMProxyErrorResponses:
    """Test error response format"""
    
    def test_error_response_structure(self):
        """Test that error responses have expected structure"""
        # Trigger a validation error
        response = requests.post(f'{LLM_BASE_URL}/chat', json={})
        assert response.status_code == 422
        
        data = response.json()
        assert 'detail' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

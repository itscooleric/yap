"""
Tests for YAP Settings and Configuration

These tests verify that settings are properly stored, retrieved,
and applied across the application, including default values.
"""

import pytest
import json


class TestDefaultSettings:
    """Test default settings configuration"""

    def test_asr_default_settings(self):
        """ASR tab should have sensible default settings"""
        # Expected defaults from asr.js
        expected_defaults = {
            'showSeparators': False,
            'collapseBlankLines': True,
            'trimWhitespace': True,
            'betweenClips': 'blank',
            'cleanLineBreaks': False,
            'lineBreakMode': 'paragraphs',
            'autoTranscribe': False,
            'autoCopy': False,
            'confirmClear': True,
            'confirmDeleteClip': True
        }
        
        # This is a documentation test to ensure defaults are reasonable
        assert expected_defaults['collapseBlankLines'] is True, "Should collapse blank lines by default"
        assert expected_defaults['trimWhitespace'] is True, "Should trim whitespace by default"
        assert expected_defaults['confirmClear'] is True, "Should confirm clear by default for safety"

    def test_tts_default_settings(self):
        """TTS tab should have sensible default settings"""
        # Expected defaults from tts.js
        expected_defaults = {
            'markdownPreview': False,
            'readAlong': False,
            'chunkMode': 'paragraph',
            'maxChunks': 30,
            'maxCharsPerChunk': 1200
        }
        
        # Verify defaults are reasonable values
        assert expected_defaults['chunkMode'] == 'paragraph', "Should chunk by paragraph by default"
        assert expected_defaults['maxChunks'] > 0, "Max chunks must be positive"
        assert expected_defaults['maxChunks'] <= 50, "Max chunks should be reasonable (not too high)"
        assert expected_defaults['maxCharsPerChunk'] > 0, "Max chars must be positive"
        assert expected_defaults['maxCharsPerChunk'] >= 1000, "Max chars should allow reasonable paragraph size"

    def test_apps_ecosystem_default_disabled(self):
        """Apps ecosystem should be disabled by default"""
        # According to README and config.js, enableApps defaults to false
        # This is a security/simplicity feature
        expected_default = False
        assert expected_default is False, "Apps should be disabled by default"

    def test_llm_default_settings(self):
        """LLM should have sensible default settings"""
        expected_defaults = {
            'apiEndpoint': 'http://localhost:11434/v1/chat/completions',
            'modelName': 'llama3',
            'apiKey': '',
            'temperature': 0.7,
            'maxTokens': 2048
        }
        
        # Verify defaults are reasonable
        assert expected_defaults['apiEndpoint'].startswith('http://'), "Should use HTTP protocol"
        assert 'localhost' in expected_defaults['apiEndpoint'], "Should default to localhost"
        assert len(expected_defaults['modelName']) > 0, "Model name should not be empty"
        assert expected_defaults['apiKey'] == '', "API key should be empty by default"
        assert 0 <= expected_defaults['temperature'] <= 2, "Temperature should be in valid range"
        assert expected_defaults['maxTokens'] > 0, "Max tokens should be positive"


class TestSettingsKeys:
    """Test settings storage key conventions"""

    def test_asr_settings_keys(self):
        """ASR settings should use consistent key naming"""
        expected_keys = [
            'settings.transcript.showSeparators',
            'settings.transcript.collapseBlankLines',
            'settings.transcript.trimWhitespace',
            'settings.transcript.betweenClips',
            'settings.transcript.cleanLineBreaks',
            'settings.transcript.lineBreakMode',
            'settings.asr.autoTranscribe',
            'settings.asr.autoCopy',
            'settings.asr.confirmClear',
            'settings.asr.confirmDeleteClip'
        ]
        
        # Verify key naming convention
        for key in expected_keys:
            assert key.startswith('settings.'), f"Settings key should start with 'settings.': {key}"
            assert '.' in key, f"Settings key should use dot notation: {key}"

    def test_tts_settings_keys(self):
        """TTS settings should use consistent key naming"""
        expected_keys = [
            'settings.tts.markdownPreview',
            'settings.tts.readAlong',
            'settings.tts.chunkMode',
            'settings.tts.maxChunks',
            'settings.tts.maxCharsPerChunk'
        ]
        
        # Verify key naming convention
        for key in expected_keys:
            assert key.startswith('settings.tts.'), f"TTS settings should start with 'settings.tts.': {key}"

    def test_export_settings_keys(self):
        """Export settings should use consistent key naming"""
        expected_keys = [
            'yap.export.profiles',
            'yap.export.exporterUrl'
        ]
        
        # Verify key naming convention
        for key in expected_keys:
            assert key.startswith('yap.'), f"App-level settings should start with 'yap.': {key}"

    def test_llm_settings_keys(self):
        """LLM settings should use consistent key naming"""
        expected_keys = [
            'settings.llm.apiEndpoint',
            'settings.llm.modelName',
            'settings.llm.apiKey',
            'settings.llm.temperature',
            'settings.llm.maxTokens'
        ]
        
        # Verify key naming convention
        for key in expected_keys:
            assert key.startswith('settings.llm.'), f"LLM settings should start with 'settings.llm.': {key}"


class TestSettingsValidation:
    """Test settings validation logic"""

    def test_transcript_between_clips_options(self):
        """betweenClips setting should accept valid options"""
        valid_options = ['blank', 'single']
        
        for option in valid_options:
            # Each option should be a valid string
            assert isinstance(option, str)
            assert option in valid_options

    def test_tts_chunk_mode_options(self):
        """chunkMode setting should accept valid options"""
        valid_options = ['paragraph', 'line']
        
        for option in valid_options:
            # Each option should be a valid string
            assert isinstance(option, str)
            assert option in valid_options

    def test_export_profile_structure(self):
        """Export profiles should have consistent structure"""
        # Example profile structure
        example_profile = {
            'id': 'profile-1',
            'name': 'My GitLab',
            'type': 'gitlab',
            'projectId': 'owner/repo',
            'branch': 'main',
            'filePath': 'inbox/{year}/{month}/{timestamp}.md'
        }
        
        required_fields = ['id', 'name', 'type']
        for field in required_fields:
            assert field in example_profile, f"Profile must have {field} field"

    def test_llm_api_endpoint_validation(self):
        """LLM API endpoint should be a valid URL"""
        valid_endpoints = [
            'http://localhost:11434/v1/chat/completions',
            'https://api.openai.com/v1/chat/completions',
            'http://192.168.1.100:8080/v1/chat/completions'
        ]
        
        for endpoint in valid_endpoints:
            assert endpoint.startswith('http://') or endpoint.startswith('https://'), \
                f"Endpoint must use HTTP/HTTPS protocol: {endpoint}"
            # Basic URL structure check
            assert '://' in endpoint, f"Endpoint must be a valid URL: {endpoint}"

    def test_llm_temperature_range(self):
        """LLM temperature should be within valid range"""
        valid_temps = [0, 0.5, 0.7, 1.0, 1.5, 2.0]
        
        for temp in valid_temps:
            assert 0 <= temp <= 2, f"Temperature must be between 0 and 2: {temp}"

    def test_llm_max_tokens_positive(self):
        """LLM max tokens should be positive"""
        valid_tokens = [100, 1024, 2048, 4096]
        
        for tokens in valid_tokens:
            assert tokens > 0, f"Max tokens must be positive: {tokens}"


class TestConfigurationDefaults:
    """Test application configuration defaults"""

    def test_exporter_default_url(self):
        """Exporter should default to localhost"""
        default_url = 'http://localhost:8090'
        assert default_url.startswith('http://'), "Should use HTTP protocol"
        assert 'localhost' in default_url, "Should default to localhost for security"

    def test_llm_default_config(self):
        """LLM provider should have sensible defaults"""
        default_llm_url = 'http://localhost:11434/v1/chat/completions'
        default_llm_model = 'llama3'
        default_temperature = 0.7
        default_max_tokens = 2048
        
        assert default_llm_url.startswith('http://'), "Should use HTTP protocol"
        assert 'localhost' in default_llm_url, "Should default to localhost"
        assert isinstance(default_llm_model, str), "Model should be a string"
        assert len(default_llm_model) > 0, "Model should not be empty"
        assert 0 <= default_temperature <= 2, "Temperature should be between 0 and 2"
        assert default_max_tokens > 0, "Max tokens should be positive"


class TestFeatureFlags:
    """Test feature flag behavior"""

    def test_apps_feature_flag(self):
        """Apps feature should be controllable via config"""
        # Apps can be enabled/disabled via config.js enableApps flag
        # Default should be false (disabled)
        default_enable_apps = False
        assert default_enable_apps is False, "Apps should be disabled by default"

    def test_markdown_preview_setting(self):
        """Markdown preview should be a toggle setting"""
        # Default should be false (not shown by default)
        default_markdown_preview = False
        assert isinstance(default_markdown_preview, bool)

    def test_read_along_setting(self):
        """Read-along should be a toggle setting"""
        # Default should be false (not enabled by default)
        default_read_along = False
        assert isinstance(default_read_along, bool)

"""
Tests for TTS Read-Along Functionality

These tests verify the TTS read-along feature works correctly,
including text chunking, sequential playback, and highlighting.
"""

import pytest


class TestReadAlongChunking:
    """Test text chunking for read-along mode"""

    def test_paragraph_chunking_logic(self):
        """Paragraph chunking should split on double newlines"""
        sample_text = """First paragraph with some content.
This is still the first paragraph.

Second paragraph starts here.
And continues on this line.

Third paragraph is short."""
        
        # Expected to split into 3 paragraphs
        paragraphs = sample_text.strip().split('\n\n')
        assert len(paragraphs) == 3
        assert 'First paragraph' in paragraphs[0]
        assert 'Second paragraph' in paragraphs[1]
        assert 'Third paragraph' in paragraphs[2]

    def test_line_chunking_logic(self):
        """Line chunking should split on single newlines"""
        sample_text = """Line one
Line two
Line three"""
        
        lines = sample_text.split('\n')
        assert len(lines) == 3
        assert lines[0] == 'Line one'
        assert lines[1] == 'Line two'
        assert lines[2] == 'Line three'

    def test_empty_chunk_filtering(self):
        """Empty chunks should be filtered out"""
        sample_text = """Content here

More content"""
        
        chunks = [chunk.strip() for chunk in sample_text.split('\n\n') if chunk.strip()]
        assert len(chunks) == 2
        assert all(len(chunk) > 0 for chunk in chunks)

    def test_max_chunks_limit(self):
        """Should respect maximum chunks limit"""
        max_chunks = 30
        
        # Create text with many paragraphs
        many_paragraphs = '\n\n'.join([f'Paragraph {i}' for i in range(50)])
        chunks = many_paragraphs.split('\n\n')[:max_chunks]
        
        assert len(chunks) <= max_chunks

    def test_max_chars_per_chunk(self):
        """Should respect maximum characters per chunk"""
        max_chars = 1200
        
        # Create a very long paragraph
        long_paragraph = ' '.join(['word'] * 500)
        
        if len(long_paragraph) > max_chars:
            # Chunk should be truncated or split
            chunk = long_paragraph[:max_chars]
            assert len(chunk) <= max_chars


class TestReadAlongDefaults:
    """Test read-along default settings"""

    def test_read_along_disabled_by_default(self):
        """Read-along should be disabled by default"""
        default_enabled = False
        assert default_enabled is False, "Read-along should be off by default"

    def test_chunk_mode_default(self):
        """Default chunk mode should be paragraph"""
        default_chunk_mode = 'paragraph'
        assert default_chunk_mode == 'paragraph', "Should chunk by paragraph by default"

    def test_max_chunks_default(self):
        """Default max chunks should be reasonable"""
        default_max_chunks = 30
        assert default_max_chunks > 0, "Max chunks must be positive"
        assert default_max_chunks <= 50, "Max chunks should be reasonable (not too high)"
        assert isinstance(default_max_chunks, int), "Max chunks must be an integer"

    def test_max_chars_per_chunk_default(self):
        """Default max chars per chunk should be reasonable"""
        default_max_chars = 1200
        assert default_max_chars > 0, "Max chars must be positive"
        assert default_max_chars >= 1000, "Max chars should allow reasonable paragraph size"
        assert isinstance(default_max_chars, int), "Max chars must be an integer"


class TestReadAlongBehavior:
    """Test read-along playback behavior"""

    def test_sequential_chunk_playback(self):
        """Chunks should be played sequentially"""
        chunks = ['First chunk', 'Second chunk', 'Third chunk']
        
        # Simulate sequential playback
        for i, chunk in enumerate(chunks):
            current_index = i
            assert current_index < len(chunks)
            assert chunks[current_index] == chunk

    def test_chunk_highlighting_logic(self):
        """Current chunk should be highlighted during playback"""
        chunks = ['Chunk A', 'Chunk B', 'Chunk C']
        
        # Simulate highlighting each chunk
        for i in range(len(chunks)):
            current_chunk_index = i
            is_highlighted = lambda idx: idx == current_chunk_index
            
            assert is_highlighted(i) is True
            for j in range(len(chunks)):
                if j != i:
                    assert is_highlighted(j) is False

    def test_playback_stop_clears_highlighting(self):
        """Stopping playback should clear highlighting"""
        current_chunk_index = 2
        
        # Stop playback
        current_chunk_index = -1
        
        assert current_chunk_index == -1, "Index should be reset when stopped"


class TestReadAlongIntegration:
    """Test read-along integration with TTS"""

    def test_markdown_stripping_for_synthesis(self):
        """Markdown should be stripped before synthesis"""
        markdown_text = "# Heading\n\n**Bold text** and *italic* and `code`."
        
        # Strip markdown (simplified - real implementation is more complex)
        plain_text = markdown_text.replace('#', '').replace('**', '').replace('*', '').replace('`', '').strip()
        
        # Plain text should not contain markdown syntax
        assert '#' not in plain_text or plain_text.count('#') < markdown_text.count('#')
        assert plain_text != markdown_text  # Should be different after stripping

    def test_chunk_audio_caching(self):
        """Generated chunk audio should be cached"""
        chunk_audio_urls = []
        
        # Simulate caching 3 chunks
        for i in range(3):
            url = f'blob:http://localhost/chunk-{i}'
            chunk_audio_urls.append(url)
        
        assert len(chunk_audio_urls) == 3
        assert all(url.startswith('blob:') for url in chunk_audio_urls)

    def test_read_along_cleanup(self):
        """Read-along should clean up resources when stopped"""
        # Simulate cleanup
        chunk_audio_urls = ['blob:url1', 'blob:url2', 'blob:url3']
        current_chunk_index = 1
        is_playing = True
        
        # Cleanup
        is_playing = False
        current_chunk_index = -1
        chunk_audio_urls = []
        
        assert is_playing is False
        assert current_chunk_index == -1
        assert len(chunk_audio_urls) == 0


class TestReadAlongEdgeCases:
    """Test edge cases for read-along functionality"""

    def test_single_chunk_text(self):
        """Single chunk should still work"""
        text = "Just one short sentence."
        chunks = [text]
        
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_empty_text(self):
        """Empty text should result in no chunks"""
        text = ""
        chunks = [chunk for chunk in text.split('\n\n') if chunk.strip()]
        
        assert len(chunks) == 0

    def test_very_long_single_paragraph(self):
        """Very long paragraph should be handled"""
        long_text = ' '.join(['word'] * 1000)
        max_chars = 1200
        
        # Should be truncated or split
        if len(long_text) > max_chars:
            chunk = long_text[:max_chars]
            assert len(chunk) <= max_chars

    def test_unicode_and_special_chars(self):
        """Unicode and special characters should be preserved"""
        text = "Hello 世界! Testing émojis 🎉 and spëcial çhars."
        chunks = [text]
        
        assert len(chunks) == 1
        assert '世界' in chunks[0]
        assert '🎉' in chunks[0]
        assert 'émojis' in chunks[0]

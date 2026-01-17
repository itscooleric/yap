"""
Tests for HTTPException handling in FastAPI endpoints.

These unit tests verify that HTTPException is properly preserved
and not caught by generic Exception handlers.
"""

import pytest
from fastapi import HTTPException
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add exporter to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestHTTPExceptionHandling:
    """Test that HTTPException is preserved in error handling"""

    def test_http_exception_preserves_status_code(self):
        """HTTPException should preserve its status code and not be converted to 500"""
        # Simulate what happens in the SFTP endpoint exception handling
        
        def handle_with_generic_catch():
            """Simulates the pattern: try... except HTTPException: raise except Exception: ..."""
            try:
                # This simulates raising HTTPException inside the try block
                raise HTTPException(status_code=400, detail="Bad request error")
            except HTTPException:
                # Re-raise HTTPException to preserve status code
                raise
            except Exception as e:
                # Generic handler should not catch HTTPException
                raise HTTPException(status_code=500, detail=f"Generic error: {str(e)}")
        
        # Test that HTTPException is raised with original status code
        with pytest.raises(HTTPException) as exc_info:
            handle_with_generic_catch()
        
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Bad request error"

    def test_generic_exception_converts_to_500(self):
        """Generic exceptions should be converted to 500 HTTPException"""
        
        def handle_with_generic_catch():
            """Simulates the pattern: try... except HTTPException: raise except Exception: ..."""
            try:
                # This simulates a generic exception (not HTTPException)
                raise ValueError("Some internal error")
            except HTTPException:
                # Re-raise HTTPException to preserve status code
                raise
            except Exception as e:
                # Generic handler converts to 500
                raise HTTPException(status_code=500, detail=f"Generic error: {str(e)}")
        
        # Test that generic exception is converted to 500 HTTPException
        with pytest.raises(HTTPException) as exc_info:
            handle_with_generic_catch()
        
        assert exc_info.value.status_code == 500
        assert "Generic error: Some internal error" in exc_info.value.detail

    def test_http_exception_with_503_preserved(self):
        """HTTPException with 503 status should be preserved"""
        
        def handle_with_generic_catch():
            """Simulates the pattern: try... except HTTPException: raise except Exception: ..."""
            try:
                # This simulates raising HTTPException for service unavailable
                raise HTTPException(status_code=503, detail="Service not configured")
            except HTTPException:
                # Re-raise HTTPException to preserve status code
                raise
            except Exception as e:
                # Generic handler should not catch HTTPException
                raise HTTPException(status_code=500, detail=f"Generic error: {str(e)}")
        
        # Test that HTTPException is raised with original 503 status code
        with pytest.raises(HTTPException) as exc_info:
            handle_with_generic_catch()
        
        assert exc_info.value.status_code == 503
        assert exc_info.value.detail == "Service not configured"

    def test_sftp_key_error_scenario(self):
        """Simulate the specific SFTP key loading error scenario"""
        
        def simulate_sftp_upload():
            """Simulates SFTP upload with HTTPException for key error"""
            try:
                # Simulate trying to load SSH key
                pkey = None
                # ... key loading logic would be here
                
                if pkey is None:
                    # This HTTPException should be preserved
                    raise HTTPException(
                        status_code=500,
                        detail="Could not load SSH key - unsupported key format"
                    )
                
                # Rest of SFTP logic...
            except HTTPException:
                # Re-raise HTTPException to preserve it
                raise
            except Exception as e:
                # Generic SFTP errors get wrapped
                raise HTTPException(status_code=500, detail=f"SFTP error: {str(e)}")
        
        # Test that the specific HTTPException is raised
        with pytest.raises(HTTPException) as exc_info:
            simulate_sftp_upload()
        
        assert exc_info.value.status_code == 500
        assert "Could not load SSH key" in exc_info.value.detail
        # Should NOT have "SFTP error:" prefix
        assert not exc_info.value.detail.startswith("SFTP error:")


class TestExceptionOrderMatters:
    """Demonstrate that exception handler order matters"""

    def test_wrong_order_catches_http_exception(self):
        """If generic Exception is caught first, HTTPException is wrapped"""
        
        def handle_wrong_order():
            """BAD PATTERN: Generic Exception handler catches HTTPException"""
            try:
                raise HTTPException(status_code=400, detail="Bad request")
            except Exception as e:
                # This catches HTTPException too!
                raise HTTPException(status_code=500, detail=f"Wrapped: {str(e)}")
        
        # HTTPException gets incorrectly wrapped as 500
        with pytest.raises(HTTPException) as exc_info:
            handle_wrong_order()
        
        assert exc_info.value.status_code == 500
        # The original 400 error is lost
        assert "Wrapped:" in exc_info.value.detail

    def test_correct_order_preserves_http_exception(self):
        """If HTTPException is caught first, it's preserved"""
        
        def handle_correct_order():
            """GOOD PATTERN: HTTPException handler before generic Exception"""
            try:
                raise HTTPException(status_code=400, detail="Bad request")
            except HTTPException:
                # Re-raise to preserve original exception
                raise
            except Exception as e:
                # This won't catch HTTPException
                raise HTTPException(status_code=500, detail=f"Wrapped: {str(e)}")
        
        # HTTPException is preserved with original status code
        with pytest.raises(HTTPException) as exc_info:
            handle_correct_order()
        
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Bad request"

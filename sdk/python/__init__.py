"""
CAM Protocol Python SDK

This package provides a client for interacting with the CAM API.
"""

from .cam_sdk import CAMClient, CAMError, Provider, OpenAIProvider

__all__ = ['CAMClient', 'CAMError', 'Provider', 'OpenAIProvider']
__version__ = '1.0.0'

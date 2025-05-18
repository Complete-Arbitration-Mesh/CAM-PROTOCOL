"""
CAM Protocol Python SDK

This SDK provides a client for interacting with the CAM API.
"""

import os
import json
import time
from typing import Dict, List, Optional, Union, Any
import requests


class CAMError(Exception):
    """Exception raised for CAM API errors."""
    
    def __init__(self, message: str, error_type: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        super().__init__(self.message)


class Provider:
    """Base class for CAM providers."""
    
    def generate(self, prompt: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response from the provider.
        
        Args:
            prompt: Input prompt
            options: Provider-specific options
            
        Returns:
            Dictionary with content and metadata
        """
        raise NotImplementedError("Subclasses must implement this method")


class OpenAIProvider(Provider):
    """OpenAI provider implementation."""
    
    def __init__(self, api_key: str, default_model: str = "gpt-3.5-turbo", organization: Optional[str] = None):
        """
        Initialize the OpenAI provider.
        
        Args:
            api_key: OpenAI API key
            default_model: Default model to use
            organization: OpenAI organization ID
        """
        self.api_key = api_key
        self.default_model = default_model
        self.organization = organization
        
    def generate(self, prompt: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a response using OpenAI.
        
        Args:
            prompt: Input prompt
            options: Provider-specific options
            
        Returns:
            Dictionary with content and metadata
        """
        options = options or {}
        model = options.get("model", self.default_model)
        max_tokens = options.get("max_tokens", 1000)
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        if self.organization:
            headers["OpenAI-Organization"] = self.organization
            
        start_time = time.time()
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            latency = (time.time() - start_time) * 1000  # Convert to ms
            
            return {
                "content": data["choices"][0]["message"]["content"],
                "metadata": {
                    "model": model,
                    "provider": "openai",
                    "cost": self._calculate_cost(data["usage"], model),
                    "latency": latency
                }
            }
            
        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response:
                try:
                    error_data = e.response.json()
                    error_message = error_data.get("error", {}).get("message", str(e))
                    raise CAMError(f"OpenAI API error: {error_message}", "provider_error")
                except (json.JSONDecodeError, KeyError):
                    pass
            raise CAMError(f"OpenAI API error: {str(e)}", "provider_error")
    
    def _calculate_cost(self, usage: Dict[str, int], model: str) -> float:
        """
        Calculate the cost of an OpenAI request.
        
        Args:
            usage: Token usage information
            model: Model used
            
        Returns:
            Cost in USD
        """
        # Simplified cost calculation
        rates = {
            "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        }
        
        rate = rates.get(model, rates["gpt-3.5-turbo"])
        input_cost = (usage["prompt_tokens"] / 1000) * rate["input"]
        output_cost = (usage["completion_tokens"] / 1000) * rate["output"]
        
        return input_cost + output_cost


class CAMClient:
    """Client for the CAM API."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        providers: Optional[Dict[str, Provider]] = None,
        cost_configuration: Optional[Dict[str, Any]] = None,
        latency_configuration: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the CAM client.
        
        Args:
            api_key: API key for authentication
            endpoint: CAM API endpoint
            providers: Provider-specific configuration
            cost_configuration: Cost weights for providers and models
            latency_configuration: Expected latency for providers and models
        """
        self.api_key = api_key or os.environ.get("CAM_API_KEY")
        self.endpoint = endpoint or os.environ.get("CAM_ENDPOINT", "https://api.cam-protocol.org")
        self.providers = providers or {}
        self.cost_configuration = cost_configuration or {}
        self.latency_configuration = latency_configuration or {}
        
        if not self.api_key:
            import warnings
            warnings.warn("CAM client initialized without an API key. Set api_key or CAM_API_KEY environment variable.")
            
    def submit_intent(
        self,
        content: str,
        intent: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Submit an intent to the CAM arbitration engine.
        
        Args:
            content: The content to process
            intent: Intent specification
            **kwargs: Additional parameters
            
        Returns:
            Response with content and metadata
        """
        if not content:
            raise ValueError("Content is required")
            
        intent = intent or {}
        
        # Allow for kwargs to be used instead of intent dict
        if kwargs:
            for key, value in kwargs.items():
                if key not in intent:
                    intent[key] = value
                    
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-CAM-SDK-Version": "1.0.0",
            "X-CAM-SDK-Language": "python",
        }
        
        try:
            response = requests.post(
                f"{self.endpoint}/v1/intents",
                headers=headers,
                json={"content": content, "intent": intent}
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response:
                try:
                    error_data = e.response.json()
                    error = error_data.get("error", {})
                    raise CAMError(
                        error.get("message", str(e)),
                        error.get("type", "unknown_error"),
                        error.get("details")
                    )
                except (json.JSONDecodeError, KeyError):
                    pass
            raise CAMError(str(e), "request_error")
            
    def get_intent(self, intent_id: str) -> Dict[str, Any]:
        """
        Get the status of a previously submitted intent.
        
        Args:
            intent_id: The ID of the intent to retrieve
            
        Returns:
            Intent status and result
        """
        if not intent_id:
            raise ValueError("Intent ID is required")
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-CAM-SDK-Version": "1.0.0",
            "X-CAM-SDK-Language": "python",
        }
        
        try:
            response = requests.get(
                f"{self.endpoint}/v1/intents/{intent_id}",
                headers=headers
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response:
                try:
                    error_data = e.response.json()
                    error = error_data.get("error", {})
                    raise CAMError(
                        error.get("message", str(e)),
                        error.get("type", "unknown_error"),
                        error.get("details")
                    )
                except (json.JSONDecodeError, KeyError):
                    pass
            raise CAMError(str(e), "request_error")
            
    def list_intents(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List all intents for the authenticated user or organization.
        
        Args:
            limit: Maximum number of intents to return
            offset: Offset for pagination
            status: Filter by status
            
        Returns:
            List of intents with pagination info
        """
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        if status is not None:
            params["status"] = status
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-CAM-SDK-Version": "1.0.0",
            "X-CAM-SDK-Language": "python",
        }
        
        try:
            response = requests.get(
                f"{self.endpoint}/v1/intents",
                headers=headers,
                params=params
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response:
                try:
                    error_data = e.response.json()
                    error = error_data.get("error", {})
                    raise CAMError(
                        error.get("message", str(e)),
                        error.get("type", "unknown_error"),
                        error.get("details")
                    )
                except (json.JSONDecodeError, KeyError):
                    pass
            raise CAMError(str(e), "request_error")
            
    def register_provider(self, name: str, provider: Provider) -> None:
        """
        Register a custom provider.
        
        Args:
            name: Provider name
            provider: Provider implementation
        """
        if not name:
            raise ValueError("Provider name is required")
            
        if not isinstance(provider, Provider):
            raise TypeError("Provider must be an instance of Provider class")
            
        self.providers[name] = provider

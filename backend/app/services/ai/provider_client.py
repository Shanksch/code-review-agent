import httpx
import json
from typing import Dict, Any, List
from fastapi import HTTPException
from app.models import AiProviderConfig

import asyncio
import re

class ProviderClient:
    def __init__(self, config: AiProviderConfig):
        self.config = config
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate_review(self, prompt: str, system_prompt: str, max_retries: int = 5) -> Dict[str, Any]:
        """
        Sends a prompt to an OpenAI-compatible endpoint (like Groq) 
        and expects a strict JSON response. Has built-in retry logic for rate limits.
        """
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"}
        }

        url = self.config.base_url.rstrip("/") + "/chat/completions"

        for attempt in range(max_retries):
            try:
                response = await self.client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                
                data = response.json()
                raw_content = data["choices"][0]["message"]["content"]
                
                # Parse the JSON string returned by the model
                return json.loads(raw_content)

            except httpx.HTTPStatusError as e:
                error_details = e.response.text
                if e.response.status_code == 429 and attempt < max_retries - 1:
                    wait_time = 2.0 ** attempt
                    match = re.search(r"try again in ([0-9.]+)s", error_details)
                    if match:
                        wait_time = float(match.group(1)) + 1.0
                    print(f"Rate limited (429). Retrying in {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                    continue

                raise HTTPException(
                    status_code=502, 
                    detail=f"AI Provider error ({e.response.status_code}): {error_details}"
                )
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=502, 
                    detail="AI Provider returned malformed JSON that could not be parsed."
                )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                raise HTTPException(
                    detail=f"Failed to communicate with AI Provider: {str(e)}"
                )

    async def generate_chat(self, messages: List[Dict[str, str]], max_retries: int = 5) -> str:
        """
        Sends a conversation history to an OpenAI-compatible endpoint.
        Returns the raw string response from the assistant.
        """
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.config.model_name,
            "messages": messages,
        }

        url = self.config.base_url.rstrip("/") + "/chat/completions"

        for attempt in range(max_retries):
            try:
                response = await self.client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                
                data = response.json()
                return data["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as e:
                error_details = e.response.text
                if e.response.status_code == 429 and attempt < max_retries - 1:
                    wait_time = 2.0 ** attempt
                    match = re.search(r"try again in ([0-9.]+)s", error_details)
                    if match:
                        wait_time = float(match.group(1)) + 1.0
                    print(f"Rate limited (429). Retrying in {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                    continue

                raise HTTPException(
                    status_code=502, 
                    detail=f"AI Provider error ({e.response.status_code}): {error_details}"
                )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to communicate with AI Provider: {str(e)}"
                )

    async def close(self):
        await self.client.aclose()

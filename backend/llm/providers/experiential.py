from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from backend.llm.interface import LLMClient, LLMMessage, LLMResponse

T = TypeVar("T", bound=BaseModel)

DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct"
DEFAULT_BASE_URL = "https://api.experiential.ai/v1/"
# Transient conditions worth retrying: rate limits and upstream/server errors.
RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504, 529}

# Rate-limit backoff. Token-per-minute quotas reset on a ~60s window, so a
# retry must be able to wait long enough to land in the next window; the
# server-error backoff (2s/4s) cannot. Capped so a request never hangs
# indefinitely on a malformed or hostile header value.
RATE_LIMIT_FALLBACK_SLEEP_SECONDS = 20.0
RATE_LIMIT_MAX_SLEEP_SECONDS = 65.0

_DURATION_UNITS = {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0}


def _parse_duration_seconds(raw: str) -> Optional[float]:
    """Parse a provider retry hint into seconds.

    Accepts a bare number of seconds (`Retry-After: 30`) and the compound
    duration strings Groq returns on `x-ratelimit-reset-*` (`7.66s`, `2m59.56s`,
    `120ms`). Returns None when the value is not a duration — an HTTP-date
    `Retry-After` is valid per spec but not emitted here, and guessing at it
    would be worse than falling back to the default delay.
    """
    text = raw.strip().lower()
    if not text:
        return None
    try:
        return max(0.0, float(text))
    except ValueError:
        pass

    total = 0.0
    number = ""
    unit = ""
    matched = False
    for char in text:
        if char.isdigit() or char == ".":
            if unit:
                if number and unit in _DURATION_UNITS:
                    total += float(number) * _DURATION_UNITS[unit]
                    matched = True
                number, unit = "", ""
            number += char
        elif char.isalpha():
            unit += char
        else:
            return None
    if number and unit in _DURATION_UNITS:
        total += float(number) * _DURATION_UNITS[unit]
        matched = True
    return max(0.0, total) if matched else None


class ExperientialClient(LLMClient):
    """OpenAI-compatible chat-completions client.

    Works against any OpenAI-compatible endpoint (OpenRouter included) by
    pointing ``base_url`` at the provider root, e.g.
    ``https://openrouter.ai/api/v1``. The provider name is carried through to
    reporting so a run is never mislabelled. The API key is held in memory only:
    it is never logged, serialized, or included in error messages.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "",
        base_url: str = "",
        timeout: float = 120.0,
        provider: str = "experiential",
        max_retries: int = 2,
    ):
        self._api_key = api_key
        self._provider = provider or "experiential"
        self._model = model or DEFAULT_MODEL
        self._base_url = (base_url.rstrip("/") + "/") if base_url else DEFAULT_BASE_URL
        self._timeout = timeout
        self._max_retries = max(0, int(max_retries))
        self._http = httpx.Client(timeout=timeout, headers=self._headers())

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    @property
    def provider_name(self) -> str:
        return self._provider

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def endpoint_host(self) -> str:
        """Endpoint host only — safe to display and log."""
        return httpx.URL(self._base_url).host or ""

    def _post(self, payload: dict) -> dict:
        url = f"{self._base_url}chat/completions"
        for attempt in range(self._max_retries + 1):
            try:
                resp = self._http.post(url, json=payload)
            except httpx.TransportError:
                if attempt < self._max_retries:
                    time.sleep(min(2.0 * (attempt + 1), 8.0))
                    continue
                raise
            if resp.status_code in RETRYABLE_STATUS_CODES and attempt < self._max_retries:
                time.sleep(self._retry_delay(resp, attempt))
                continue
            resp.raise_for_status()
            return resp.json()
        raise RuntimeError("unreachable")  # pragma: no cover

    def _retry_delay(self, resp: httpx.Response, attempt: int) -> float:
        """Seconds to wait before retrying a retryable response.

        Rate limits are handled differently from server errors. A 429 from a
        token-per-minute quota does not clear until the provider's one-minute
        window rolls over, so the general 2s/4s backoff guarantees the retry is
        rejected too and simply burns the retry budget against an identical
        oversized request. The provider states the true wait itself, so honour
        it: `Retry-After`, else Groq's `x-ratelimit-reset-*` hint, else fall back
        to a rate-limit-appropriate delay rather than the server-error one.
        """
        if resp.status_code != 429:
            return min(2.0 * (attempt + 1), 8.0)

        for header in ("retry-after", "x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"):
            raw = resp.headers.get(header)
            if not raw:
                continue
            seconds = _parse_duration_seconds(raw)
            if seconds is not None:
                # Small cushion so the retry lands after the window has rolled over,
                # and a ceiling so a pathological header cannot hang the request.
                return min(seconds + 1.0, RATE_LIMIT_MAX_SLEEP_SECONDS)

        return min(RATE_LIMIT_FALLBACK_SLEEP_SECONDS * (attempt + 1), RATE_LIMIT_MAX_SLEEP_SECONDS)

    def chat_completion(
        self,
        messages: List[LLMMessage],
        system: str = "",
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        msgs = [{"role": "system", "content": system}] if system else []
        msgs += [{"role": m.role, "content": m.content} for m in messages]
        payload: dict = {
            "model": self._model,
            "messages": msgs,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        data = self._post(payload)
        choice = data["choices"][0]
        return LLMResponse(
            content=choice["message"]["content"] or "",
            finish_reason=choice.get("finish_reason", ""),
            usage=data.get("usage"),
        )

    def structured_completion(
        self,
        messages: List[LLMMessage],
        response_model: Type[T],
        system: str = "",
        temperature: float = 0.1,
        max_tokens: int = 4096,
        retries: int = 2,
    ) -> T:
        schema_json = response_model.model_json_schema()
        # Compact separators rather than indent=2. The schema is machine-read by
        # the model, so the pretty-printer's newlines and indentation were pure
        # prompt cost — measured at 686 tokens indented vs 406 compact for the
        # Hypothesis schema, with identical content.
        instruction = (
            "Respond only with valid JSON matching this schema:\n"
            + json.dumps(schema_json, separators=(",", ":"))
        )
        sys_msg = system + "\n\n" + instruction if system else instruction

        last_error: Optional[str] = None
        for attempt in range(1 + retries):
            try:
                msgs = [{"role": "system", "content": sys_msg}]
                if last_error:
                    msgs.append({
                        "role": "system",
                        "content": (
                            "Previous attempt failed JSON/Pydantic validation. "
                            f"Error: {last_error}. Respond with valid JSON only, with no prose and no code fences."
                        ),
                    })
                msgs += [{"role": m.role, "content": m.content} for m in messages]
                payload: dict = {
                    "model": self._model,
                    "messages": msgs,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                data = self._post(payload)
                content = data["choices"][0]["message"]["content"] or ""
                parsed = self._extract_json(content)
                return response_model.model_validate(parsed)
            except (ValidationError, json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
                last_error = str(e)
                continue
        raise ValueError(f"structured_completion failed after {1 + retries} attempts. Last error: {last_error}")

    @staticmethod
    def _extract_json(text: str) -> Any:
        text = text.strip()
        if text.startswith("```"):
            for delim in ("```json", "```JSON", "```"):
                if text.startswith(delim):
                    text = text[len(delim):]
                    if "```" in text:
                        text = text[: text.rindex("```")]
                    break
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Tolerate prose around the JSON object, which reasoning models
            # sometimes emit even when asked for JSON only.
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end > start:
                return json.loads(text[start : end + 1])
            raise

    def close(self) -> None:
        self._http.close()


class MockLLMClient(LLMClient):
    def __init__(self, model: str = "mock"):
        self._model = model
        self._responses: List[Any] = []
        self._call_count = 0

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model

    def enqueue(self, response: Any) -> None:
        self._responses.append(response)

    def enqueue_many(self, responses: List[Any]) -> None:
        self._responses.extend(responses)

    @property
    def call_count(self) -> int:
        return self._call_count

    def chat_completion(
        self,
        messages: List[LLMMessage] = None,
        system: str = "",
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        self._call_count += 1
        if self._responses:
            r = self._responses.pop(0)
            if isinstance(r, str):
                return LLMResponse(content=r)
            if isinstance(r, dict) and "content" in r:
                return LLMResponse(**r)
            if isinstance(r, LLMResponse):
                return r
        return LLMResponse(content="[mock response]")

    def structured_completion(
        self,
        messages: List[LLMMessage] = None,
        response_model: Type[T] = None,
        system: str = "",
        temperature: float = 0.1,
        max_tokens: int = 4096,
        retries: int = 2,
    ) -> T:
        self._call_count += 1
        if self._responses:
            r = self._responses.pop(0)
            if isinstance(r, dict):
                return response_model.model_validate(r)
            if isinstance(r, str):
                try:
                    return response_model.model_validate_json(r)
                except Exception:
                    pass
            if isinstance(r, BaseModel):
                return r
        if response_model is not None:
            try:
                return response_model.model_validate({})
            except Exception:
                pass
        return response_model.model_validate({"module_id": ""})

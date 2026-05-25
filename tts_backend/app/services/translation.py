import asyncio
import httpx
from typing import Dict, List
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import get_settings

settings = get_settings()


class TranslationError(Exception):
    pass


# ── DeepL ────────────────────────────────────────────────────────────────────

DEEPL_LANGUAGE_MAP = {
    "en": "EN-US", "fr": "FR", "es": "ES", "de": "DE",
    "it": "IT", "pt": "PT-PT", "nl": "NL", "pl": "PL",
    "ru": "RU", "ja": "JA", "zh": "ZH", "ar": "AR",
    "ko": "KO", "sv": "SV", "da": "DA", "fi": "FI",
    "nb": "NB", "tr": "TR", "cs": "CS", "ro": "RO",
}


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(httpx.HTTPError),
)
async def _translate_deepl(text: str, target_lang: str) -> str:
    if not settings.deepl_api_key:
        raise TranslationError("DEEPL_API_KEY is not configured")
    deepl_lang = DEEPL_LANGUAGE_MAP.get(target_lang.lower(), target_lang.upper())
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api-free.deepl.com/v2/translate",
            headers={"Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}"},
            json={"text": [text], "target_lang": deepl_lang},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["translations"][0]["text"]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(httpx.HTTPError),
)
async def _translate_google(text: str, target_lang: str) -> str:
    if not settings.google_translate_api_key:
        raise TranslationError("GOOGLE_TRANSLATE_API_KEY is not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://translation.googleapis.com/language/translate/v2",
            params={"key": settings.google_translate_api_key},
            json={"q": text, "target": target_lang, "format": "text"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"]["translations"][0]["translatedText"]


# ── Public interface ──────────────────────────────────────────────────────────

async def translate_to_all(text: str, languages: List[str]) -> Dict[str, str]:
    """
    Translate `text` into all requested languages in parallel.
    Returns a dict like {"en": "Hello", "fr": "Bonjour", "es": "Hola"}.
    Source language is detected automatically by the provider.
    """
    provider = settings.translation_provider.lower()

    async def translate_one(lang: str) -> tuple[str, str]:
        try:
            if provider == "deepl":
                translated = await _translate_deepl(text, lang)
            elif provider == "google":
                translated = await _translate_google(text, lang)
            elif provider == "passthrough":
                translated = await _passthrough(text, lang)
            else:
                raise TranslationError(f"Unknown translation provider: {provider}")
            return lang, translated
        except Exception as exc:
            raise TranslationError(f"Failed to translate to '{lang}': {exc}") from exc

    pairs = await asyncio.gather(*[translate_one(lang) for lang in languages])
    return dict(pairs)


async def _passthrough(text: str, _lang: str) -> str:
    """Returns the original text unchanged — useful for local testing without a translation key."""
    return text

from fastapi import APIRouter, HTTPException
from app.services.tts import list_models
from app.models.schemas import ModelResponse

router = APIRouter(prefix="/models", tags=["models"])


@router.get("/", response_model=list[ModelResponse])
async def get_models():
    """Return all ElevenLabs models that support text-to-speech."""
    try:
        raw = await list_models()
        return [
            ModelResponse(
                model_id=m["model_id"],
                name=m["name"],
                description=m.get("description"),
                can_do_text_to_speech=m.get("can_do_text_to_speech", True),
                languages=m.get("languages", []),
            )
            for m in raw
        ]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch models: {exc}")

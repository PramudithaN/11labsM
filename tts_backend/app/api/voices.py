from fastapi import APIRouter, HTTPException
from app.services.tts import list_voices
from app.models.schemas import VoiceResponse

router = APIRouter(prefix="/voices", tags=["voices"])


@router.get("/", response_model=list[VoiceResponse])
async def get_voices():
    """Return all available ElevenLabs voices."""
    try:
        raw = await list_voices()
        return [
            VoiceResponse(
                voice_id=v["voice_id"],
                name=v["name"],
                preview_url=v.get("preview_url"),
                labels=v.get("labels", {}),
            )
            for v in raw
        ]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch voices: {exc}")

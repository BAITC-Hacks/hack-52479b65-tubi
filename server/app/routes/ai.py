from fastapi import APIRouter

from .. import ai
from ..localization import Language
from ..schemas import Health, PrepareInput, PrepareResponse
from .dependencies import SettingsDep

router = APIRouter(tags=['AI'])


@router.get('/health', response_model=Health)
def health(settings: SettingsDep):
    return {'status': 'ok', 'ai_mode': 'live' if settings.openai_api_key else 'fallback'}


@router.post('/ai/prepare', response_model=PrepareResponse)
def prepare(body: PrepareInput, settings: SettingsDep, locale: Language):
    return ai.prepare(body, settings, locale)

"""Application assembly; HTTP handlers, rules and persistence live in their modules."""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles

from .db import Database
from .errors import register_error_handlers
from .localization import request_locale
from .routes import ai, proposals, tasks
from .schemas import ErrorResponse
from .seed import seed_database
from .settings import PROJECT_DIR, Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.settings = settings or Settings.from_env()
        application.state.database = Database(application.state.settings.db_path)
        application.state.database.initialize()
        seed_database(application.state.database)
        yield

    application = FastAPI(
        title='Tubi API', version='0.2.0', lifespan=lifespan,
        dependencies=[Depends(request_locale)],
        responses={code: {'model': ErrorResponse} for code in (404, 409, 422, 500, 503)},
    )
    register_error_handlers(application)
    for router in (ai.router, tasks.router, proposals.router):
        application.include_router(router, prefix='/api')

    dist = PROJECT_DIR / 'web' / 'dist'
    if dist.is_dir():
        application.mount('/', StaticFiles(directory=dist, html=True), name='web')
    return application


app = create_app()

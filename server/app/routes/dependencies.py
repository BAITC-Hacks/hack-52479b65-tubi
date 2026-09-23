from typing import Annotated

from fastapi import Depends, Request

from ..db import Database
from ..settings import Settings


def database(request: Request) -> Database:
    return request.app.state.database


def settings(request: Request) -> Settings:
    return request.app.state.settings


DatabaseDep = Annotated[Database, Depends(database)]
SettingsDep = Annotated[Settings, Depends(settings)]

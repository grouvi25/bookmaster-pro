"""
Auth router — /api/v1/auth
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.schemas import (
    IdentifyRequest,
    IdentifyResponse,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter()


@router.post("/identify", response_model=IdentifyResponse)
async def identify(
    body: IdentifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Определить роль пользователя по platform + platform_id."""
    service = AuthService(db)
    result = await service.identify(body.platform, body.platform_id)
    return IdentifyResponse(**result)


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Регистрация нового мастера или клиента."""
    if body.role not in ("master", "client"):
        raise HTTPException(status_code=400, detail="Role must be 'master' or 'client'")

    service = AuthService(db)
    try:
        result = await service.register(
            platform=body.platform,
            platform_id=body.platform_id,
            role=body.role,
            display_name=body.display_name,
            specialization=body.specialization,
            phone=body.phone,
            city=body.city,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return TokenResponse(
        access_token=result["token"],
        role=result["role"],
        user_id=result["user_id"],
        display_name=result["display_name"],
    )

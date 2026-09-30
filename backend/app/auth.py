"""Signup, login, and bearer-token authentication."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])
password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)
ACCESS_TOKEN_MINUTES = 30


class SignupRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=12, max_length=128)]


class LoginRequest(SignupRequest):
    pass


class SignupResponse(BaseModel):
    status: str
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


def normalise_email(email: EmailStr) -> str:
    return str(email).strip().lower()


def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    payload = {"sub": user.id, "email": user.email, "exp": expires_at, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, get_settings().jwt_secret_value, algorithm="HS256")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
    try:
        payload = jwt.decode(credentials.credentials, get_settings().jwt_secret_value, algorithms=["HS256"])
        user_id = payload["sub"]
    except (jwt.PyJWTError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid access token") from None

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid access token")
    return user


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_202_ACCEPTED)
async def signup(payload: SignupRequest, session: AsyncSession = Depends(get_session)) -> SignupResponse:
    user = User(email=normalise_email(payload.email), password_hash=password_hasher.hash(payload.password))
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email is already registered") from None
    return SignupResponse(status="pending_activation", message="Your account awaits admin activation.")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    user = await session.scalar(select(User).where(User.email == normalise_email(payload.email)))
    if user is None or not password_hasher.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="account is awaiting activation")
    return TokenResponse(access_token=create_access_token(user), expires_in=ACCESS_TOKEN_MINUTES * 60)


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"id": user.id, "email": user.email}
import os
import hashlib
import hmac
import httpx
import google.auth.transport.requests
import google.oauth2.id_token
from datetime import datetime, timedelta
from typing import Optional, Union

import jwt
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import async_session, User, UserIdentity, AuthProvider, UserRole, Order, Courier
from rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET must be set in the environment")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Admin credentials — ONLY from env, never stored in DB
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@grandstore.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin")


async def get_db():
    async with async_session() as session:
        yield session


# --- Pydantic schemas ---

class LoginRequest(BaseModel):
    login: str  # email or username
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str | None = None
    username: str | None = None
    phone: str | None = None
    password: str


class TelegramAuthRequest(BaseModel):
    initData: str


class TelegramBrowserAuthRequest(BaseModel):
    id: int
    first_name: str = ""
    last_name: str = ""
    username: str | None = None
    photo_url: str | None = None
    auth_date: int = 0
    hash: str = ""


class VKAuthRequest(BaseModel):
    access_token: str
    user_id: int
    email: str | None = None


class VKCodeAuthRequest(BaseModel):
    code: str
    redirect_uri: str


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token


class SetPasswordRequest(BaseModel):
    password: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    username: str | None = None


class AuthResponse(BaseModel):
    token: str
    user: dict


# --- Helpers ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_admin_token() -> str:
    payload = {
        "sub": "admin",
        "admin": True,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Union[int, dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("admin"):
            return {"admin": True}
        return int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(401, "Invalid or expired token")


def user_to_dict(user: User) -> dict:
    providers = [i.provider.value for i in user.auth_identities]
    identities = [
        {
            "provider": i.provider.value,
            "provider_user_id": i.provider_user_id,
        }
        for i in user.auth_identities
    ]
    has_password = any(
        i.provider == AuthProvider.LOCAL and i.password_hash
        for i in user.auth_identities
    )
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
        "is_active": user.is_active,
        "providers": providers,
        "identities": identities,
        "has_password": has_password,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    decoded = decode_token(token)

    if isinstance(decoded, dict) and decoded.get("admin"):
        return User(
            id=0,
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            username="admin",
            role=UserRole.ADMIN,
            is_active=True,
            auth_identities=[],
        )

    user_id = decoded
    result = await db.execute(
        select(User)
        .options(selectinload(User.auth_identities))
        .where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found or inactive")
    return user


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        decoded = decode_token(token)

        if isinstance(decoded, dict) and decoded.get("admin"):
            return User(
                id=0,
                name=ADMIN_NAME,
                email=ADMIN_EMAIL,
                username="admin",
                role=UserRole.ADMIN,
                is_active=True,
                auth_identities=[],
            )

        result = await db.execute(
            select(User)
            .options(selectinload(User.auth_identities))
            .where(User.id == decoded, User.is_active == True)
        )
        return result.scalar_one_or_none()
    except HTTPException:
        return None


# ==========================================
# LOGIN — email/username + password
# ==========================================

@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    login_value = data.login.strip()

    # Admin check — credentials from .env only, never DB
    if login_value in (ADMIN_EMAIL.strip(), ADMIN_NAME.strip(), "admin") and data.password == ADMIN_PASSWORD:
        token = create_admin_token()
        return AuthResponse(
            token=token,
            user={
                "id": 0,
                "name": ADMIN_NAME,
                "email": ADMIN_EMAIL,
                "username": "admin",
                "role": "admin",
                "is_active": True,
                "providers": [],
                "identities": [],
                "has_password": True,
                "phone": None,
                "avatar_url": None,
                "created_at": None,
            },
        )

    # Try to find user by email identity or username
    identity_result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == AuthProvider.LOCAL,
            UserIdentity.provider_user_id == login_value,
        )
    )
    identity = identity_result.scalar_one_or_none()

    if not identity:
        # Maybe it's a username — find user by username, then get their local identity
        user_result = await db.execute(
            select(User).where(User.username == login_value, User.is_active == True)
        )
        user = user_result.scalar_one_or_none()
        if user:
            identity_result = await db.execute(
                select(UserIdentity).where(
                    UserIdentity.user_id == user.id,
                    UserIdentity.provider == AuthProvider.LOCAL,
                    UserIdentity.password_hash.isnot(None),
                )
            )
            identity = identity_result.scalars().first()

    # Check if it's a courier login (for couriers created before User was linked)
    if not identity:
        courier_result = await db.execute(select(Courier).where(Courier.login == login_value))
        courier = courier_result.scalar_one_or_none()
        if courier and courier.password_hash and verify_password(data.password, courier.password_hash):
            courier_user_result = await db.execute(
                select(User).where(User.username == courier.login)
            )
            courier_user = courier_user_result.scalar_one_or_none()
            if not courier_user:
                courier_user = User(
                    name=courier.name,
                    phone=courier.phone,
                    username=courier.login,
                    role=UserRole.COURIER,
                )
                db.add(courier_user)
                await db.flush()
            identity_result = await db.execute(
                select(UserIdentity).where(
                    UserIdentity.user_id == courier_user.id,
                    UserIdentity.provider == AuthProvider.LOCAL,
                )
            )
            identity = identity_result.scalar_one_or_none()
            if not identity:
                identity = UserIdentity(
                    user_id=courier_user.id,
                    provider=AuthProvider.LOCAL,
                    provider_user_id=courier.login,
                    password_hash=courier.password_hash,
                )
                db.add(identity)
            await db.commit()

    if not identity or not identity.password_hash:
        raise HTTPException(401, "Неверный логин или пароль")

    if not verify_password(data.password, identity.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")

    user_result = await db.execute(
        select(User)
        .options(selectinload(User.auth_identities))
        .where(User.id == identity.user_id, User.is_active == True)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Аккаунт заблокирован")

    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


# ==========================================
# REGISTER — name + email + username + password
# ==========================================

@router.post("/register", response_model=AuthResponse)
@limiter.limit("3/minute")
async def register(request: Request, data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = data.email.strip().lower() if data.email else None
    username = data.username.strip().lower() if data.username else None
    phone = data.phone.strip() if data.phone else None

    if not email and not username:
        raise HTTPException(400, "Укажите email или логин")
    if len(data.password) < 6:
        raise HTTPException(400, "Пароль должен быть не менее 6 символов")
    if username and len(username) < 3:
        raise HTTPException(400, "Логин должен быть не менее 3 символов")
    if username and not all(c.isalnum() or c in "-_" for c in username):
        raise HTTPException(400, "Логин может содержать только буквы, цифры, - и _")

    # Check email uniqueness
    if email:
        existing_email = await db.execute(
            select(UserIdentity).where(
                UserIdentity.provider == AuthProvider.LOCAL,
                UserIdentity.provider_user_id == email,
            )
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(409, "Email уже зарегистрирован")

    # Check username uniqueness
    if username:
        existing_username = await db.execute(
            select(User).where(User.username == username)
        )
        if existing_username.scalar_one_or_none():
            raise HTTPException(409, "Логин уже занят")

    user = User(
        name=data.name.strip(),
        email=email,
        username=username,
        phone=phone,
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()

    # Create local identity — use email if provided, otherwise username
    provider_user_id = email or f"username:{username}"
    identity = UserIdentity(
        user_id=user.id,
        provider=AuthProvider.LOCAL,
        provider_user_id=provider_user_id,
        password_hash=hash_password(data.password),
    )
    db.add(identity)
    await db.commit()

    user_result = await db.execute(
        select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
    )
    user = user_result.scalar_one()

    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


# ==========================================
# TELEGRAM — auto-login from WebApp
# ==========================================

@router.post("/telegram", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_telegram(request: Request, data: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    tg_user = _validate_telegram_init_data(data.initData)
    tg_id = str(tg_user.get("id", ""))
    if not tg_id:
        raise HTTPException(400, "Invalid Telegram user data")

    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == AuthProvider.TELEGRAM,
            UserIdentity.provider_user_id == tg_id,
        )
    )
    identity = result.scalar_one_or_none()

    if identity:
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == identity.user_id)
        )
        user = user_result.scalar_one()
    else:
        first_name = tg_user.get("first_name", "")
        last_name = tg_user.get("last_name", "")
        name = f"{first_name} {last_name}".strip() or "Telegram User"
        phone = tg_user.get("phone_number")

        user = User(
            name=name,
            phone=phone,
            username=tg_user.get("username"),
            avatar_url=tg_user.get("photo_url"),
            role=UserRole.USER,
        )
        db.add(user)
        await db.flush()

        identity = UserIdentity(
            user_id=user.id,
            provider=AuthProvider.TELEGRAM,
            provider_user_id=tg_id,
        )
        db.add(identity)

        if tg_user.get("email"):
            email = tg_user["email"].strip().lower()
            email_identity = UserIdentity(
                user_id=user.id,
                provider=AuthProvider.LOCAL,
                provider_user_id=email,
                password_hash=None,
            )
            db.add(email_identity)
            user.email = email

        await db.commit()

        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
        )
        user = user_result.scalar_one()

    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


# ==========================================
# VK — auto-login
# ==========================================

@router.post("/vk", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_vk(request: Request, data: VKAuthRequest, db: AsyncSession = Depends(get_db)):
    vk_id = str(data.user_id)

    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == AuthProvider.VK,
            UserIdentity.provider_user_id == vk_id,
        )
    )
    identity = result.scalar_one_or_none()

    if identity:
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == identity.user_id)
        )
        user = user_result.scalar_one()
    else:
        # Fetch user info from VK API for name and photo
        vk_name = "VK User"
        vk_photo = None
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    "https://api.vk.com/method/users.get",
                    params={
                        "user_ids": vk_id,
                        "access_token": data.access_token,
                        "v": "5.131",
                        "fields": "photo_200",
                    },
                )
                vk_data = resp.json()
                if vk_data.get("response"):
                    u = vk_data["response"][0]
                    vk_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or "VK User"
                    vk_photo = u.get("photo_200")
        except Exception:
            pass

        user = User(name=vk_name, avatar_url=vk_photo, role=UserRole.USER)
        if data.email:
            user.email = data.email.strip().lower()
        db.add(user)
        await db.flush()

        identity = UserIdentity(
            user_id=user.id,
            provider=AuthProvider.VK,
            provider_user_id=vk_id,
        )
        db.add(identity)

        if data.email:
            email = data.email.strip().lower()
            email_identity = UserIdentity(
                user_id=user.id,
                provider=AuthProvider.LOCAL,
                provider_user_id=email,
                password_hash=None,
            )
            db.add(email_identity)

        await db.commit()

        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
        )
        user = user_result.scalar_one()

    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


@router.post("/vk/code", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_vk_code(request: Request, data: VKCodeAuthRequest, db: AsyncSession = Depends(get_db)):
    vk_app_id = os.getenv("VITE_VK_APP_ID")
    vk_service_key = os.getenv("VK_SERVICE_KEY")
    if not vk_app_id or not vk_service_key:
        raise HTTPException(500, "VK OAuth not configured")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post(
                "https://id.vk.com/oauth2/auth",
                data={
                    "grant_type": "authorization_code",
                    "code": data.code,
                    "client_id": vk_app_id,
                    "client_secret": vk_service_key,
                    "redirect_uri": data.redirect_uri,
                },
            )
            token_data = token_resp.json()
            if "access_token" not in token_data:
                raise HTTPException(400, "Failed to exchange VK code")
            access_token = token_data["access_token"]
            vk_user_id = str(token_data.get("user_id", ""))
            vk_email = token_data.get("email")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"VK token exchange failed: {e}")

    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == AuthProvider.VK,
            UserIdentity.provider_user_id == vk_user_id,
        )
    )
    identity = result.scalar_one_or_none()
    if identity:
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == identity.user_id)
        )
        user = user_result.scalar_one()
    else:
        vk_name = "VK User"
        vk_photo = None
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    "https://api.vk.com/method/users.get",
                    params={
                        "user_ids": vk_user_id,
                        "access_token": access_token,
                        "v": "5.131",
                        "fields": "photo_200",
                    },
                )
                vk_data = resp.json()
                if vk_data.get("response"):
                    u = vk_data["response"][0]
                    vk_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or "VK User"
                    vk_photo = u.get("photo_200")
        except Exception:
            pass
        user = User(name=vk_name, avatar_url=vk_photo, role=UserRole.USER)
        if vk_email:
            user.email = vk_email
        db.add(user)
        await db.flush()
        identity = UserIdentity(
            user_id=user.id,
            provider=AuthProvider.VK,
            provider_user_id=vk_user_id,
        )
        db.add(identity)
        if vk_email:
            email_identity = UserIdentity(
                user_id=user.id,
                provider=AuthProvider.LOCAL,
                provider_user_id=vk_email,
                password_hash=None,
            )
            db.add(email_identity)
        await db.commit()
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
        )
        user = user_result.scalar_one()
    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


# ==========================================
# GOOGLE — OAuth ID token
# ==========================================

@router.post("/google", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_google(request: Request, data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        id_info = google.oauth2.id_token.verify_oauth2_token(
            data.credential,
            google.auth.transport.requests.Request(),
            audience=None,  # Accept any Google-signed token
        )
    except ValueError as e:
        raise HTTPException(400, f"Invalid Google token: {e}")

    google_id = str(id_info.get("sub", ""))
    email = id_info.get("email", "").strip().lower()
    name = id_info.get("name", "").strip() or "Google User"
    avatar = id_info.get("picture")

    if not google_id:
        raise HTTPException(400, "Invalid Google token: no sub")

    # Check existing identity
    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == AuthProvider.GOOGLE,
            UserIdentity.provider_user_id == google_id,
        )
    )
    identity = result.scalar_one_or_none()

    if identity:
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == identity.user_id)
        )
        user = user_result.scalar_one()
    else:
        # Check if email exists as LOCAL identity
        existing_user = None
        if email:
            existing = await db.execute(
                select(UserIdentity).where(
                    UserIdentity.provider == AuthProvider.LOCAL,
                    UserIdentity.provider_user_id == email,
                )
            )
            email_identity = existing.scalar_one_or_none()
            if email_identity:
                existing_user_result = await db.execute(
                    select(User).options(selectinload(User.auth_identities)).where(User.id == email_identity.user_id)
                )
                existing_user = existing_user_result.scalar_one()

        if existing_user:
            # Link Google identity to existing user
            identity = UserIdentity(
                user_id=existing_user.id,
                provider=AuthProvider.GOOGLE,
                provider_user_id=google_id,
            )
            db.add(identity)
            if email and not existing_user.email:
                existing_user.email = email
            await db.commit()
            user = existing_user
        else:
            user = User(name=name, email=email, avatar_url=avatar, role=UserRole.USER)
            db.add(user)
            await db.flush()

            identity = UserIdentity(
                user_id=user.id,
                provider=AuthProvider.GOOGLE,
                provider_user_id=google_id,
            )
            db.add(identity)

            if email:
                email_identity = UserIdentity(
                    user_id=user.id,
                    provider=AuthProvider.LOCAL,
                    provider_user_id=email,
                    password_hash=None,
                )
                db.add(email_identity)

            await db.commit()

            user_result = await db.execute(
                select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
            )
            user = user_result.scalar_one()

    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


# ==========================================
# TELEGRAM BROWSER — Login Widget (redirect)
# ==========================================

@router.post("/telegram/browser", response_model=AuthResponse)
@limiter.limit("10/minute")
async def auth_telegram_browser(request: Request, data: TelegramBrowserAuthRequest, db: AsyncSession = Depends(get_db)):
    if TELEGRAM_BOT_TOKEN:
        # Verify hash
        check_parts = sorted(
            (k, v) for k, v in data.model_dump().items() if k != "hash" and v is not None
        )
        check_string = "\n".join(f"{k}={v}" for k, v in check_parts)
        secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
        computed_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        if computed_hash != data.hash:
            raise HTTPException(401, "Invalid Telegram data signature")

    tg_id = str(data.id)

    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == AuthProvider.TELEGRAM,
            UserIdentity.provider_user_id == tg_id,
        )
    )
    identity = result.scalar_one_or_none()

    if identity:
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == identity.user_id)
        )
        user = user_result.scalar_one()
    else:
        name = f"{data.first_name} {data.last_name}".strip() or "Telegram User"
        user = User(
            name=name,
            username=data.username,
            avatar_url=data.photo_url,
            role=UserRole.USER,
        )
        db.add(user)
        await db.flush()
        identity = UserIdentity(
            user_id=user.id,
            provider=AuthProvider.TELEGRAM,
            provider_user_id=tg_id,
        )
        db.add(identity)
        await db.commit()
        user_result = await db.execute(
            select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
        )
        user = user_result.scalar_one()

    token = create_token(user.id)
    return AuthResponse(token=token, user=user_to_dict(user))


# ==========================================
# COMMON — Me, Set Password
# ==========================================

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return user_to_dict(user)


@router.post("/set-password")
@limiter.limit("5/minute")
async def set_password(
    request: Request,
    data: SetPasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(data.password) < 6:
        raise HTTPException(400, "Пароль должен быть не менее 6 символов")

    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.user_id == user.id,
            UserIdentity.provider == AuthProvider.LOCAL,
        )
    )
    identity = result.scalar_one_or_none()

    if identity and identity.password_hash:
        raise HTTPException(400, "Пароль уже установлен")

    if identity:
        identity.password_hash = hash_password(data.password)
    else:
        identifier = None
        if user.email:
            identifier = user.email
        elif user.username:
            identifier = f"username:{user.username}"
        else:
            raise HTTPException(400, "Нет email или логина для привязки пароля")

        identity = UserIdentity(
            user_id=user.id,
            provider=AuthProvider.LOCAL,
            provider_user_id=identifier,
            password_hash=hash_password(data.password),
        )
        db.add(identity)

    await db.commit()
    return {"ok": True, "message": "Пароль установлен"}


# ==========================================
# PROFILE UPDATE
# ==========================================

@router.patch("/profile", response_model=AuthResponse)
async def update_profile(
    data: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.email is not None:
        new_email = data.email.strip().lower()
        if new_email and new_email != user.email:
            # Check uniqueness
            existing = await db.execute(
                select(UserIdentity).where(
                    UserIdentity.provider == AuthProvider.LOCAL,
                    UserIdentity.provider_user_id == new_email,
                    UserIdentity.user_id != user.id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(409, "Email уже используется")

            # Update LOCAL identity provider_user_id if it currently matches old email
            if user.email:
                identity_result = await db.execute(
                    select(UserIdentity).where(
                        UserIdentity.user_id == user.id,
                        UserIdentity.provider == AuthProvider.LOCAL,
                        UserIdentity.provider_user_id == user.email,
                    )
                )
                identity = identity_result.scalar_one_or_none()
                if identity:
                    identity.provider_user_id = new_email

            user.email = new_email
        elif not new_email:
            raise HTTPException(400, "Email не может быть пустым")

    if data.username is not None:
        new_username = data.username.strip().lower() if data.username.strip() else None
        if new_username != user.username:
            if new_username and len(new_username) < 3:
                raise HTTPException(400, "Логин должен быть не менее 3 символов")
            if new_username and not all(c.isalnum() or c in "-_" for c in new_username):
                raise HTTPException(400, "Логин может содержать только буквы, цифры, - и _")
            if new_username:
                existing = await db.execute(
                    select(User).where(User.username == new_username, User.id != user.id)
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(409, "Логин уже занят")

            # If username changed and identity uses username:xxx, update it
            if user.username and new_username:
                old_uid = f"username:{user.username}"
                new_uid = f"username:{new_username}"
                identity_result = await db.execute(
                    select(UserIdentity).where(
                        UserIdentity.user_id == user.id,
                        UserIdentity.provider == AuthProvider.LOCAL,
                        UserIdentity.provider_user_id == old_uid,
                    )
                )
                identity = identity_result.scalar_one_or_none()
                if identity:
                    identity.provider_user_id = new_uid

            user.username = new_username

    # Keep old values to match orphan orders
    if data.name is not None or data.phone is not None:
        old_name = user.name
        old_phone = user.phone

    if data.name is not None:
        user.name = data.name.strip()

    if data.phone is not None:
        user.phone = data.phone.strip() if data.phone.strip() else None

    # Sync updated name/phone to all existing orders of this user
    if data.name is not None or data.phone is not None:
        # 1. Orders linked via user_id
        result = await db.execute(
            select(Order).where(Order.user_id == user.id)
        )
        orders = list(result.scalars().all())
        for order in orders:
            if data.name is not None:
                order.customer_name = user.name
            if data.phone is not None:
                order.phone = user.phone
        if orders:
            print(f"[PROFILE] Synced name/phone to {len(orders)} orders (user_id={user.id})")

        # 2. Orphan orders (user_id IS NULL) matching old name/phone — also update and link them
        orphan_criteria = [Order.user_id == None]
        if data.name is not None and old_name:
            orphan_criteria.append(Order.customer_name == old_name)
        if data.phone is not None and old_phone:
            orphan_criteria.append(Order.phone == old_phone)
        if len(orphan_criteria) > 1:
            result = await db.execute(
                select(Order).where(or_(*orphan_criteria[1:]), orphan_criteria[0])
            )
            orphan_orders = list(result.scalars().all())
            for order in orphan_orders:
                if data.name is not None:
                    order.customer_name = user.name
                if data.phone is not None:
                    order.phone = user.phone
                order.user_id = user.id  # link to user
            if orphan_orders:
                print(f"[PROFILE] Linked & synced {len(orphan_orders)} orphan orders to user {user.id}")

    await db.commit()

    user_result = await db.execute(
        select(User).options(selectinload(User.auth_identities)).where(User.id == user.id)
    )
    user = user_result.scalar_one()

    return AuthResponse(token=create_token(user.id), user=user_to_dict(user))


# ==========================================
# Internal helpers
# ==========================================

def _validate_telegram_init_data(init_data: str) -> dict:
    if not TELEGRAM_BOT_TOKEN:
        # Dev mode: parse without validation
        parsed = dict(item.split("=", 1) for item in init_data.split("&") if "=" in item)
        if "user" in parsed:
            return json.loads(parsed["user"])
        return {}

    parsed = dict(item.split("=", 1) for item in init_data.split("&") if "=" in item)
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(400, "Invalid Telegram data")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(
        b"WebAppData", TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256
    ).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if computed_hash != received_hash:
        raise HTTPException(401, "Invalid Telegram data signature")

    user_data = {}
    if "user" in parsed:
        user_data = json.loads(parsed["user"])
    return user_data

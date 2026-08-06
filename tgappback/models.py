import enum
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Enum, Boolean, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import JSON
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv

load_dotenv()
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DATABASE_URL = f"postgresql+asyncpg://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{DB_HOST}:{DB_PORT}/{os.getenv('DB_NAME')}"

engine = create_async_engine(DATABASE_URL,echo=False)
async_session = async_sessionmaker(engine,expire_on_commit=False,class_=AsyncSession)

class Base(DeclarativeBase):
    pass

# Определение ролей для разграничения доступа
class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    COURIER = "courier"

# Определение типов авторизации
class AuthProvider(str, enum.Enum):
    LOCAL = "local"       # Обычный вход по логину/паролю
    TELEGRAM = "telegram" # Вход через Telegram WebApp / бот
    VK = "vk"             # Вход через VK Mini Apps
    GOOGLE = "google"     # Вход через Google OAuth

# Статусы заказа для администратора
class OrderStatus(str, enum.Enum):
    CREATED = "created"     # Создан пользователем
    SHIPPED = "shipped"     # Отправлен администратором
    COMPLETED = "completed" # Выполнен и закрыт
    CANCELLED = "cancelled" # Отменён пользователем


### 1. ТАБЛИЦЫ ПОЛЬЗОВАТЕЛЕЙ И АУТЕНТИФИКАЦИИ

class User(Base):
    """Основная таблица пользователя (профиль)"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Момент, когда пользователь последний раз видел статусы своих заказов
    # (для колокольчика об изменениях статуса заказов)
    last_orders_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Связи (Relationships)
    auth_identities: Mapped[List["UserIdentity"]] = relationship("UserIdentity", back_populates="user", cascade="all, delete-orphan")
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="user")


class UserIdentity(Base):
    """Таблица способов входа (Связывает ТГ, ВК и Логин с одним профилем User)"""
    __tablename__ = "user_identities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    provider: Mapped[AuthProvider] = mapped_column(Enum(AuthProvider), nullable=False)
    
    # Уникальный ID от платформы. 
    # Например: ID чата ТГ (1234567), ID пользователя ВК (7654321) или Email для обычной регистрации.
    # Используем BigInteger, так как ID соцсетей могут быть очень длинными.
    provider_user_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    
    # Хэш пароля (нужен ТОЛЬКО для провайдера LOCAL, для ТГ/ВК тут будет NULL)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="auth_identities")


### 2. ТАБЛИЦА ТОВАРОВ (Оптимизирована под Excel-парсер)

class Category(Base):
    """Таблица категорий (Смартфоны, Ноутбуки и т.д.)"""
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")


class Product(Base):
    """Таблица товаров (Оптимизирована под Excel-парсер и разные категории)"""
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
 
    # Внешний ключ на категорию товара
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    category: Mapped["Category"] = relationship("Category", back_populates="products")

    # Сырые данные из первой колонки Excel (для точного сопоставления при импорте)
    raw_data: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Количество товаров (при импорте считается по повторам raw_data)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Сюда записываем уникальные свойства (память, процессор, год, цвет и т.д.)
    attributes: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    # Связь с ГАЛЕРЕЕЙ фотографий (один товар — много фото)
    images: Mapped[List["ProductImage"]] = relationship(
        "ProductImage", 
        back_populates="product", 
        cascade="all, delete-orphan"
    )

    # Связь с элементами заказа
    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="product")


class ProductImage(Base):
    """Таблица для хранения нескольких изображений одного товара"""
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    
    # URL картинки: "/uploads/photo1.jpg" или "https://s3..."
    image_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    
    # Флаг, является ли это фото главным на превью каталога
    is_main: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="images")


class ProductPhotoGroup(Base):
    """Фото-группа товаров, привязанная к наименованию и цвету.

    Живёт независимо от записей в products: фото не пропадают при удалении/
    перезаливке таблицы товаров. Фото из группы автоматически привязываются
    ко всем товарам с совпадающими наименованием и цветом.
    """
    __tablename__ = "product_photo_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=False, default="")

    # Список URL фото, принадлежащих группе
    images: Mapped[List[str]] = mapped_column(MutableList.as_mutable(JSON), default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        UniqueConstraint("name", "color", name="uq_product_photo_groups_name_color"),
    )

### 3. ТАБЛИЦЫ ЗАКАЗОВ (Админка и история)

class Order(Base):
    """Таблица заказов"""
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Текущий статус заказа (Управляется администратором)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.CREATED, nullable=False)
    
    # Итоговая сумма заказа (сохраняем отдельно на случай, если цены на товары изменятся в будущем)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Комментарий к заказу, адрес доставки или данные получателя
    delivery_info: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Имя покупателя
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Телефон покупателя
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Координаты доставки
    delivery_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    delivery_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Когда последний раз менялся статус заказа (для колокольчика пользователю)
    status_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    courier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("couriers.id", ondelete="SET NULL"), nullable=True)

    # Поля для подтверждения доставки
    confirmation_code: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    delivery_photo_urls: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    delivery_imei: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Подарки/акционные товары, привязанные к заказу (вычисляется сервером).
    # Список снапшотов: [{"name": ..., "image": ..., "price": ...}, ...]
    gifts: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="orders")
    courier: Mapped[Optional["Courier"]] = relationship("Courier", lazy="joined")
    items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


### 4. ТАБЛИЦА КУРЬЕРОВ (для назначения на заказы)

class Courier(Base):
    """Профиль курьера — создаётся админом вручную"""
    __tablename__ = "couriers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    login: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    orders: Mapped[List["Order"]] = relationship("Order", back_populates="courier")


class OrderItem(Base):
    """Содержимое заказа (какие товары и в каком количестве куплены)"""
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # Фиксируем цену на момент покупки
    price_at_purchase: Mapped[float] = mapped_column(Float, nullable=False) 
    # Характеристики, выбранные пользователем при добавлении в корзину
    selected_attributes: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Снапшоты на момент покупки: переживают удаление товара из каталога,
    # чтобы в истории/архиве заказов ничего не пропадало
    product_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    product_image: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="order_items")


class Promo(Base):
    """Акция/подарок: к товару, категории или всему заказу прикрепляется
    подарок (наименование, фото, цена). Применяется к корзине автоматически."""
    __tablename__ = "promos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    gift_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gift_image: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # 0 — бесплатно, иначе символическая стоимость
    gift_price: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    # Целевая привязка: "product" | "category" | "all"
    target_type: Mapped[str] = mapped_column(String(20), nullable=False, default="all")
    target_product_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True
    )
    target_category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Дополнительное условие: подарок действует, если сумма заказа >= min_total
    min_total: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    target_product: Mapped[Optional["Product"]] = relationship("Product")
    target_category: Mapped[Optional["Category"]] = relationship("Category")


class Review(Base):
    """Отзыв о магазине.

    Оставляют только авторизованные пользователи. Админ модерирует:
    status = "new" (на модерации) | "published" (виден на сайте) | "hidden" (скрыт).
    Имя сохраняется снапшотом, чтобы отзыв пережил удаление/смену профиля.
    """
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    user_name: Mapped[str] = mapped_column(String(200), nullable=False, default="Пользователь")

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Список URL приложенных фотографий
    images: Mapped[Optional[List[str]]] = mapped_column(MutableList.as_mutable(JSON), default=list)

    # "new" | "published" | "hidden"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Faq(Base):
    """Часто задаваемый вопрос. Формулировку и ответ пишет админ."""
    __tablename__ = "faq"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SupportConversation(Base):
    """Диалог пользователя с поддержкой."""
    __tablename__ = "support_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Снапшот имени, чтобы чат пережил удаление/смену профиля
    user_name: Mapped[str] = mapped_column(String(200), nullable=False, default="Пользователь")

    # "open" | "closed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")

    # Момент, когда пользователь в последний раз видел диалог
    # (для подсчёта непрочитанных ответов администратора)
    user_last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Момент, когда администратор последний раз открывал диалог
    # (для подсчёта непрочитанных сообщений пользователя)
    admin_last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    messages: Mapped[List["SupportMessage"]] = relationship(
        "SupportMessage", back_populates="conversation", cascade="all, delete-orphan"
    )


class SupportMessage(Base):
    """Сообщение в диалоге поддержки. sender = "user" | "admin"."""
    __tablename__ = "support_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("support_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender: Mapped[str] = mapped_column(String(10), nullable=False, default="user")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # Список URL приложенных фотографий
    images: Mapped[Optional[List[str]]] = mapped_column(MutableList.as_mutable(JSON), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation: Mapped["SupportConversation"] = relationship("SupportConversation", back_populates="messages")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
# План: Форма оформления заказа с картой и данными пользователя

## Контекст

При нажатии кнопки "Оформить заказ" на странице корзины текущее модальное окно показывает только текстовый список товаров. Необходимо заменить его полноценной формой оформления заказа с:
- Финальным списком товаров
- Картой для выбора адреса доставки (Leaflet + OpenStreetMap)
- Формой ввода ФИО и телефона (с автозаполнением из Telegram WebApp)
- Передачей данных в backend

Приложение работает и как Telegram Mini App, и как отдельное веб-приложение.

---

## Изменения

### 1. Установка зависимостей (Frontend)

**Файл:** `tgappfront/package.json`

```bash
cd tgappfront && npm install leaflet && npm install -D @types/leaflet
```

### 2. Типы — расширить CartItem и OrderPayload

**Файл:** `tgappfront/src/types/product.ts`

- Добавить тип `DeliveryData`:
  ```ts
  export type DeliveryData = {
    customerName: string;
    phone: string;
    address: string;
    lat: number | null;
    lng: number | null;
  };
  ```

### 3. API — добавить передачу данных доставки

**Файл:** `tgappfront/src/api/orders.ts`

- Расширить `CreateOrderPayload`:
  ```ts
  export type CreateOrderPayload = {
    items: OrderItemData[];
    total_price: number;
    customer_name?: string | null;
    delivery_info?: string | null;
    delivery_lat?: number | null;
    delivery_lng?: number | null;
    phone?: string | null;
  };
  ```

### 4. Backend — добавить поля в модель Order

**Файл:** `tgappback/models.py`

Добавить в модель `Order`:
```python
delivery_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
delivery_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
```

**Файл:** `tgappback/main.py`

- Расширить `OrderCreate` Pydantic модель:
  ```python
  class OrderCreate(BaseModel):
      items: list[OrderItemCreate]
      total_price: float
      customer_name: str | None = None
      delivery_info: str | None = None
      delivery_lat: float | None = None
      delivery_lng: float | None = None
      phone: str | None = None
  ```
- Обновить `create_order` эндпоинт для сохранения новых полей

### 5. Компонент DeliveryMap — карта для выбора адреса

**Файл:** `tgappfront/src/components/DeliveryMap.tsx` (НОВЫЙ)

- Leaflet-карта с OpenStreetMap тайлами
- Центрирование: по умолчанию центр России (55.75, 37.62), при наличии геолокации — текущее положение
- Клик по карте → маркер + reverse geocoding через Nominatim API (`https://nominatim.openstreetmap.org/reverse`)
- Пропсы: `onLocationSelect: (lat: number, lng: number, address: string) => void`
- Стилизация в accordance с текущей темой (CSS-переменные)

### 6. Компонент CheckoutModal — форма оформления заказа

**Файл:** `tgappfront/src/components/CheckoutModal.tsx` (НОВЫЙ)

Заменяет текущее модальное окно `showOrderModal` в App.tsx.

Структура:
1. **Список товаров** — финальный список с ценами (текущий `orderText`, но в формате карточек)
2. **Карта доставки** — компонент `DeliveryMap`
3. **Форма данных заказчика:**
   - Поле "ФИО" (автозаполнение из `Telegram.WebApp.initDataUnsafe.user.first_name + last_name`)
   - Поле "Телефон" (автозаполнение из `Telegram.WebApp.initDataUnsafe.user.phone_number`, если доступно)
4. Кнопка "Подтвердить заказ"

Логика автозаполнения:
```ts
// При монтировании модала:
const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
if (tgUser) {
  const fullName = [tgUser.last_name, tgUser.first_name, tgUser.patronymic].filter(Boolean).join(' ');
  setCustomerName(fullName || '');
  setPhone(tgUser.phone_number || '');
}
```

### 7. Обновление App.tsx — интеграция

**Файл:** `tgappfront/src/App.tsx`

- Импортировать `CheckoutModal`
- Заменить текущий inline-модал `showOrderModal` на `<CheckoutModal />`
- Передать в `sendToTelegram` данные доставки:
  ```ts
  function sendToTelegram(delivery: DeliveryData) {
    const orderPayload = {
      items: cart.map(...),
      total_price: cartTotal,
      customer_name: delivery.customerName,
      delivery_info: delivery.address,
      delivery_lat: delivery.lat,
      delivery_lng: delivery.lng,
      phone: delivery.phone,
    };
    createOrder(orderPayload).then(...);
  }
  ```

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `tgappfront/package.json` | Добавить leaflet |
| `tgappfront/src/types/product.ts` | Добавить DeliveryData |
| `tgappfront/src/api/orders.ts` | Расширить CreateOrderPayload |
| `tgappfront/src/components/DeliveryMap.tsx` | **Создать** — карта Leaflet |
| `tgappfront/src/components/CheckoutModal.tsx` | **Создать** — модал оформления |
| `tgappfront/src/App.tsx` | Заменить модал, обновить sendToTelegram |
| `tgappback/models.py` | Добавить delivery_lat, delivery_lng, phone в Order |
| `tgappback/main.py` | Расширить OrderCreate, create_order |

## Порядок выполнения

1. Установить leaflet + @types/leaflet
2. Обновить бэкенд (models.py → main.py) — добавить новые поля
3. Обновить типы и API на фронтенде
4. Создать DeliveryMap.tsx
5. Создать CheckoutModal.tsx
6. Обновить App.tsx — заменить модал
7. Проверить работоспособность (npm run build)

## Проверка

- `cd tgappfront && npm run build` — убедиться что нет ошибок компиляции
- Визуально проверить: корзина → "Оформить заказ" → отображается форма с картой и полями ввода

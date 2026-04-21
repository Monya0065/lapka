# Lapka VPN — Технический анализ и план развития

## 1. Архитектура системы

### 1.1 Компоненты

| Компонент | Технология | Порт | Описание |
|-----------|------------|------|----------|
| API | FastAPI (Python 3.12) | 8001 | REST API backend |
| Frontend | Next.js 14 | 3001 | Web UI |
| Database | PostgreSQL 16 | 5433 | Основная БД |
| Cache | Redis 7 | 6380 | Кэш и сессии |
| Bot | python-telegram-bot | — | Telegram бот |
| Mobile | Flutter | — | iOS + Android |
| Desktop | Tauri | — | Windows/macOS/Linux |

### 1.2 Структура проекта

```
/Users/vadimpetrov/Documents/New project/vpn/
├── docker-compose.yml          # Оркестрация
├── .env                  # Конфигурация
├── backend/               # Python API
│   ├── app/
│   │   ├── __init__.py   # FastAPI app
│   │   ├── database.py  # PostgreSQL connection
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── repositories/
│   │   └── services/ # Business logic
│   │       ├── __init__.py      # Auth service
│   │       ├── billing.py        # Subscriptions
│   │       ├── device.py       # Devices
│   │       ├── vpn.py         # VPN provisioner
│   │       ├── payment.py    # YooKassa
│   │       └── smtp_email.py # Email
│   └── api/routers/
│       ├── auth.py         # /api/auth
│       ├── billing.py      # /api/billing
│       ├── devices.py     # /api/devices
│       ├── vpn.py        # /api/vpn
│       ├── admin.py     # /api/admin
│       ├── telegram.py   # /api/telegram
│       └── wireguard.py # WireGuard config
│
├── frontend/             # Next.js
│   ├── app/
│   │   ├── page.tsx       # Landing
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/  # User dashboard
│   │   └── admin/      # Admin panel
│   └── package.json
│
├── bot/                # Telegram bot
│   └── app/bot.py
│
├── docker/
│   ├── api.Dockerfile
│   ├── frontend.Dockerfile
│   └── bot.Dockerfile
│
└── seed.py             # Demo data

vpn-mobile/            # Flutter app
├── pubspec.yaml
└── lib/main.dart

vpn-desktop/          # Tauri desktop
├── Cargo.toml
├── src-tauri/
└── index.html
```

---

## 2. API Endpoints

### 2.1 Авторизация

| Метод | Endpoint | Описание |
|-------|---------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/verify` | Верификация email |
| POST | `/api/auth/resend-verification` | Повтор email |

### 2.2 Биллинг

| Метод | Endpoint | Описание |
|-------|---------|----------|
| GET | `/api/billing/subscription` | Подписка пользователя |
| POST | `/api/billing/checkout` | Создать платеж |
| GET | `/api/billing/checkout/{id}/status` | Статус платежа |
| POST | `/api/billing/webhook/{provider}` | Webhook |

### 2.3 Устройства

| Метод | Endpoint | Описание |
|-------|---------|----------|
| GET | `/api/devices` | Список устройств |
| POST | `/api/devices` | Добавить устройство |
| POST | `/api/devices/claim` | ��ривязать устройство |
| DELETE | `/api/devices/{id}` | Удалить устройство |

### 2.4 VPN

| Метод | Endpoint | Описание |
|-------|---------|----------|
| GET | `/api/vpn/profiles` | Список профилей |
| POST | `/api/vpn/profiles` | Создать профиль |
| GET | `/api/vpn/profiles/{id}/config` | WireGuard конфиг |
| DELETE | `/api/vpn/profiles/{id}` | Удалить профиль |
| GET | `/api/vpn/connect/authorize` | Авторизовать подключение |

### 2.5 Админ

| Метод | Endpoint | Описание |
|-------|---------|----------|
| GET | `/api/admin/users` | Список пользователей |
| GET | `/api/admin/users/{id}` | Пользователь |
| PATCH | `/api/admin/users/{id}` | Изменить пользователя |
| DELETE | `/api/admin/users/{id}` | Удалить пользователя |
| GET | `/api/admin/subscriptions` | Подписки |
| GET | `/api/admin/payments` | Платежи |
| GET | `/api/admin/stats` | Статистика |
| GET | `/api/admin/logs` | Логи |
| GET | `/api/admin/vpn/nodes` | VPN ноды |
| POST | `/api/admin/vpn/nodes` | Добавить ноду |
| DELETE | `/api/admin/vpn/nodes/{id}` | Удалить ноду |

### 2.6 Telegram

| Метод | Endpoint | Описание |
|-------|---------|----------|
| GET | `/api/telegram/login-url` | URL для OAuth |
| GET | `/api/telegram/status/{id}` | Статус по Telegram ID |
| POST | `/api/telegram/link-start` | Начать привязку |

---

## 3. База данных

### 3.1 Таблицы

```sql
users              -- Пользователи
sessions           -- Сессии
verification_tokens -- Токены верификации
devices            -- Устройства
device_claim_tokens -- Токены привязки
subscriptions     -- Подписки
payments          -- Платежи
payment_events    -- События платежей
vpn_nodes        -- VPN сервера
vpn_profiles     -- VPN профили
telegram_links  -- Привязки Telegram
audit_events    -- Аудит логи
```

### 3.2 Индексы

- `users.email` — уникальный
- `subscriptions.user_id` — для поиска подписки
- `vpn_profiles.user_id` — для профилей пользователя
- `audit_events.created_at` — для логов

---

## 4. Frontend страницы

### 4.1 Клиент

| Путь | Описание |
|-----|----------|
| `/` | Landing page |
| `/login` | Вход |
| `/register` | Регистрация |
| `/verify` | Верификация email |
| `/dashboard` | Личный кабинет |
| `/dashboard/devices` | Устройства |
| `/dashboard/subscription` | Подписка |

### 4.2 Админ

| Путь | Описание |
|-----|----------|
| `/admin` | Обзор |
| `/admin/users` | Пользователи |
| `/admin/nodes` | VPN ноды |
| `/admin/subscriptions` | Подписки |
| `/admin/payments` | Платежи |
| `/admin/stats` | Статистика |
| `/admin/logs` | Логи |

---

## 5. Подписки

| План | Цена | Период |
|-------|------|-------|
| Trial | бесплатно | 7 дней |
| Monthly | ₽299 | 30 дней |
| Yearly | ₽2490 | 365 дней |

---

## 6. Telegram бот

### 6.1 Команды

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие |
| `/help` | Помощь |
| `/activate` | Получить ссылку активации |
| `/status` | Статус подписки |

---

## 7. Mobile App (Flutter)

### 7.1 Экраны

1. **AuthScreen** — Login / Register
2. **DashboardScreen** — Подписка + устройст��а
3. **AddDeviceScreen** — Добавить устройство

### 7.2 API интеграция

- `http://10.0.2.2:8001` — для Android эмулятора
- `http://localhost:8001` — для iOS симулятора

---

## 8. Desktop App (Tauri)

### 8.1 UI

- Login / Register
- Dashboard
- Управление устройствами

### 8.2 Rust команды

- `login` — Вход
- `get_subscription` — Подписка
- `get_devices` — Устройства
- `create_device` — Добавить устройство
- `logout` — Выход

---

## 9. Текущее состояние

### 9.1 Работает

- ✅ API + Frontend
- ✅ PostgreSQL + Redis
- ✅ Telegram бот
- ✅ Админ-панель
- ✅ Trial подписка
- ✅ WireGuard конфиги
- ✅ Flutter mobile app
- ✅ Tauri desktop app

### 9.2 Требует настройки

- SMTP для email верификации
- YooKassa для платежей
- Реальные VPN сервера

---

## 10. План развития

### 10.1 Фаза 1 — Запуск (MVP)

- [x] Backend API
- [x] Web Frontend
- [x] Telegram бот
- [x] Админ-панель
- [x] Mobile app
- [x] Desktop app
- [ ] Настроить SMTP
- [ ] Настроить YooKassa
- [ ] Добавить реальные VPN сервера
- [ ] Деплой

### 10.2 Фаза 2 — Масштабирование

- [ ] Множественные ноды
- [ ] Географическое распределение
- [ ] Мониторинг
- [ ] Логирование
- [ ] Метрики

### 10.3 Фаза 3 — Функции

- [ ] P2P протокол
- [ ] Кибербезопасность
- [ ] Трафик статистика
- [ ] Уведомления пуш
- [ ] Multi-device sync

---

## 11. Безопасность

### 11.1 Аутентификация

- JWT токены (HS256)
- Access token: 1 час
- Refresh token: 30 дней

### 11.2 Авторизация

- Роли: `user`, `admin`
- Защита admin endpoints по role

### 11.3 Данные

- Пароли: bcrypt хэширование
- Токены: безопасное хранение

---

## 12. Мониторинг

### 12.1 Метрики

- Users count
- Active subscriptions
- Revenue
- Active nodes
- Health scores

### 12.2 Логи

- Audit events table
- Login/logout
- Subscription changes
- Device operations

---

## 13. Тестирование

### 13.1 Тесты

```bash
# API tests
cd /Users/vadimpetrov/Documents/New\ project/vpn/backend
python -m pytest tests/ -v

# Frontend lint
cd /Users/vadimpetrov/Documents/New\ project/vpn/frontend
npm run lint
```

---

## 14. Деплой

### 14.1 Docker

```bash
cd /Users/vadimpetrov/Documents/New\ project/vpn
docker compose up --build -d
```

### 14.2 Переменные окружения

```
DATABASE_URL=postgresql://vpn:vpn@postgres:5432/vpn
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key
TELEGRAM_BOT_TOKEN=your-token
YOOKASSA_SHOP_ID=your-shop-id
YOOKASSA_SECRET_KEY=your-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password
```

---

## 15. API документация

| Ссылка | Описание |
|--------|----------|
| http://localhost:8001/docs | Swagger UI |
| http://localhost:8001/openapi.json | OpenAPI spec |
| http://localhost:8001/health | Health check |

---

## 16. Контакты для демо

- **Email:** demo@lapka.ru
- **Пароль:** demo123
- **Telegram:** @VPNLapka_bot
- **Web:** http://localhost:3001
- **API:** http://localhost:8001
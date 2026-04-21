# Lapka — реальные шаги запуска (функционал, не roadmap-декорации)

Цель: рабочий стек + осмысленный AI без платного OpenAI + нормальная Postgres-конфигурация.

## Фаза A — поднять стек (день 0–1)

1. Скопировать `backend/.env.example` → `backend/.env` (локально) и при необходимости создать `.env` в корне репозитория для подстановки в Docker Compose.
2. В корне: `docker compose up --build -d`.
3. Проверить: `curl -fsS http://localhost:8000/health`, открыть `http://localhost:8000/docs`.
4. Миграции: внутри контейнера API или локально с тем же `DATABASE_URL`: `alembic upgrade head`.
5. Сид: `python -m src.seed` (идемпотентность — по поведению seed в репо).

## Фаза B — бесплатный / облачный LLM (день 1–2)

**Вариант 0 — YandexGPT (РФ, Yandex Cloud)**  
1. В [Yandex Cloud](https://console.yandex.cloud/) создать каталог, включить **Foundation Models**, выпустить **API-ключ** сервисного аккаунта с ролью на каталог (или использовать краткоживший **IAM**).  
2. В `.env`: `LLM_PROVIDER=yandexgpt`, `YANDEX_CLOUD_API_KEY=...`, `YANDEX_CLOUD_FOLDER_ID=<id каталога>`. При необходимости `YANDEXGPT_MODEL=yandexgpt-lite/latest` или `yandexgpt/latest`.  
3. Перезапуск `api`, проверка AI-эндпоинта.

**Вариант 1 — Groq (облако, бесплатный tier, без своего GPU)**  
1. Зарегистрироваться на https://console.groq.com/ и создать API key.  
2. В `.env` у корня (для Compose) или в `docker-compose` environment:  
   - `LLM_PROVIDER=groq`  
   - `GROQ_API_KEY=...` (без префикса `Bearer `)  
   - при желании `GROQ_MODEL=llama-3.3-70b-versatile` (или другая **актуальная** модель из списка Groq).  
3. `docker compose up -d --build api` и smoke: вызов безопасного AI-эндпоинта (vet triage / structuring) через Swagger.

**Важно:** Groq **не обслуживает** ряд стран (в т.ч. **Россию**, Китай, Иран, КНДР, Сирию, Кубу). С этих IP типичный ответ — **`403` / `{"error":{"message":"Forbidden"}}`**. Это не баг Lapka: нужен **другой провайдер** (Ollama/OpenAI) или запрос из **разрешённой** сети.

**Вариант 2 — Ollama (локально, без ключа)**  
1. На хосте: установить Ollama, `ollama pull llama3.2`, `ollama serve`.  
2. Для API в Docker: `OLLAMA_BASE_URL=http://host.docker.internal:11434`, `LLM_PROVIDER=ollama`.  
3. Пересобрать/перезапустить `api`.

**Платный OpenAI** по-прежнему: `LLM_PROVIDER=openai` + `OPENAI_API_KEY`.

## Фаза C — «нормальная» БД (ongoing)

1. **Dev:** текущий Postgres 16 в Compose — нормальная среда; данные в volume `lapka-postgres-data`.  
2. **Пул соединений:** задаются `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_RECYCLE` (см. `.env.example`).  
3. **Prod:** отдельный managed Postgres, отдельные секреты, бэкапы, при необходимости SSL (`?ssl=require` в URL — по политике хостинга).

## Фаза D — выйти из «муляжей» интеграций (недели, по одному каналу)

1. Аптеки: добавить реальный `PharmacyProvider` в `integrations/pharmacy_providers/` + ключ в реестре (сейчас только `demo`).  
2. Платежи / лабы — аналогично.  
3. Документы: заменить stub signed URL на объектное хранилище + реальные подписанные ссылки.  
4. Карты: `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` + данные клиник/точек из вашей БД, не «магия с карты».

## Фаза E — доказательство для клиник

1. Зафиксировать 3–5 метрик ROI (no-show, длина визита, загрузка).  
2. Снять baseline 2 недели, затем пилот с Lapka 8–12 недель, тот же отчёт.  
3. Юридически согласовать хранение и AI-политику (у вас уже заложены safety-guards в продукте).

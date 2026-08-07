# Retail API proxy через Yandex Cloud

Зачем: backend на Render, его IP-диапазон `216.24.57.0/24` (AS397273) недостижим
из части российских сетей. Измерено с трёх российских узлов:

| Цель | Из РФ |
|---|---|
| Render (`api.magicesim.store` сейчас) | **0/3**, таймауты 6–16 с |
| **Yandex Cloud** | **3/3, 35–74 мс** |
| GitHub Pages (контроль) | 3/3 |

Frontend уже обращается **только** к `https://api.magicesim.store` — вхождений
`onrender.com` в активном коде ноль. Поэтому чинить надо не код, а маршрут:
переключить этот hostname на шлюз внутри России, который сам ходит на Render.

## Архитектура

```
браузер (РФ) → api.magicesim.store → Yandex Cloud API Gateway → Render
                                          (ru-central1)         (origin)
                     ↓ если недоступен
              /assets/catalog.json   (статический кеш, уже работает)
```

Выбран **API Gateway**, а не Cloud Function или Serverless Container: HTTP-проксирование
у него декларативное (`x-yc-apigateway-integration: type: http`), кода писать не нужно,
холодного старта нет, allowlist получается сам собой — не описанный в спеке путь
отдаёт 404. Меньше движущихся частей, дешевле, откат — одна DNS-запись.

## ⚠️ Главное: `api.magicesim.store` обслуживает не только retail

Переключение DNS переносит **всех** клиентов этого хоста, а не только витрину:

| Потребитель | Что вызывает | Судьба при переключении |
|---|---|---|
| Витрина (браузер) | 6 retail-маршрутов | ✅ в allowlist, работает |
| Кеш каталога (GH Actions) | `/api/v1/retail/packages` | ✅ в allowlist, работает |
| **Админка** | 93 вызова `/api/v1/admin/**` | ❌ **сломается** |
| Dealer API | 11 маршрутов | ❌ сломается |
| Partner portal | 14 маршрутов | ❌ сломается |
| Provider sync (GH Actions) | `/api/v1/admin/providers/**` | ❌ **сломается** — встанут цены |
| **Platega webhook** | `/api/v1/payments/platega/callback` | ❌ **сломается, если он на этом хосте** |
| Приватные ссылки `/pay/` | `/api/v1/public/private-payments/**` | ❌ сломается |

Последний пункт критичен: если вебхук перестанет доходить, платежи будут списываться,
но заказы не будут подтверждаться и eSIM не будет выдаваться.

**Перед переключением обязательно проверить в Render → Environment фактическое
значение `PLATEGA_CALLBACK_URL`.** В `.env.platega.example` оно указано как
`https://api.magicesim.store/...`, но реальное значение живёт в Render и может
отличаться. Если там уже `esim-backend-3wmu.onrender.com` — вебхук не затронут
и шаг 2 ниже не нужен.

## Порядок развёртывания

Витрину переключаем **последней**. Сначала уводим всё остальное на прямой хост.

**1. Новая DNS-запись — прямой путь к Render (ничего не ломает)**

```
Type: CNAME   Host: origin   Value: esim-backend-3wmu.onrender.com   TTL: 300
```

**2. Перевести не-retail потребителей на `origin.magicesim.store`**
   - Render → Environment: `PLATEGA_CALLBACK_URL` (только если сейчас указывает на `api.`)
   - `~/magicesim-frontend`: `API_BASE`
   - `~/esim-backend/.github/workflows/sync-provider-prices.yml`: `API_BASE` ×2
   - Проверить, что админка и sync работают на новом хосте

**3. Создать шлюз**

```bash
yc serverless api-gateway create --name magic-esim-retail --spec=retail-proxy.yaml
yc serverless api-gateway get --name magic-esim-retail --format json | jq -r .domain
# → d5dxxxxxxxxxxxxxxxxx.apigw.yandexcloud.net
```

**4. Проверить шлюз по временному домену** — все 6 маршрутов, сравнить с Render:
статус, тело, ключевые поля, CORS, OPTIONS. POST — только безопасные сценарии.

**5. Проверить достижимость из РФ** — с российского IP без VPN. Это acceptance
criterion: там, где Render не отвечает, шлюз должен отвечать. Не выполнено —
не переключаем.

**6. Сертификат + привязка домена**

```bash
yc certificate-manager certificate request --name api-magicesim --domains api.magicesim.store
yc certificate-manager certificate get --name api-magicesim   # покажет CNAME для валидации
```

DNS-запись валидации (значения выдаст Certificate Manager):

```
Type: CNAME   Host: _acme-challenge.api   Value: <из Certificate Manager>   TTL: 300
```

После выдачи сертификата:

```bash
yc serverless api-gateway add-domain --name magic-esim-retail \
  --domain api.magicesim.store --certificate-name api-magicesim
```

**7. Переключить витрину — одна запись**

```
Было:  CNAME  api  →  esim-backend-3wmu.onrender.com
Стало: CNAME  api  →  <gateway>.apigw.yandexcloud.net
TTL: 300
```

**Не трогать:** `magicesim.store` (A-записи GitHub Pages), MX `improvmx` — почта.

**8. Frontend не меняется.** Он уже ходит на `api.magicesim.store`.
Fallback на `/assets/catalog.json` продолжает работать без изменений.

## Откат

Вернуть CNAME `api` на `esim-backend-3wmu.onrender.com`. TTL 300 → полное
восстановление за 5 минут. Шлюз можно оставить — он ничего не стоит без трафика.

## Стоимость

API Gateway тарифицируется по запросам и исходящему трафику. При текущем объёме
(~240 запросов в 12 часов по метрикам Render, каталог 240 КБ / 23 КБ gzip) это
единицы рублей в месяц. Точные тарифы — на странице цен Yandex Cloud; порядок
величины не тот, ради которого стоит оптимизировать.

## Что осталось direct-to-Render и почему

- **Platega webhook** — server-to-server. Недостижимость Render из браузеров РФ
  не означает недостижимости для серверов Platega. Ставить подтверждение платежа
  в зависимость от ещё одного звена — плохой размен.
- **admin / dealer / partner** — не входят в область этой задачи. Кандидаты на
  отдельный шлюз со своим allowlist, если админка нужна из РФ без VPN.
- **`/pay/` приватные ссылки** — браузерные, страдают от той же проблемы;
  выносятся отдельным шагом, чтобы не расширять текущее изменение.

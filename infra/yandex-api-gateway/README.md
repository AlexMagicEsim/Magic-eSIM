# Retail API proxy через Yandex Cloud

Зачем: backend на Render, его IP-диапазон `216.24.57.0/24` (AS397273) недостижим
из части российских сетей. Измерено с российских узлов (Москва ×2, Петербург):

| Цель | Из РФ |
|---|---|
| Render (`api.magicesim.store` сейчас) | **0/3 … 1/3**, таймауты соединения |
| **Шлюз Yandex Cloud** | **3/3**, `/health` 0,5–1,5 с, каталог ~0,55 с |
| GitHub Pages (контроль) | 3/3 |

Frontend уже обращается **только** к `https://api.magicesim.store` — вхождений
`onrender.com` в активном коде ноль. Поэтому менять надо не код, а маршрут:
переключить этот hostname на шлюз внутри России, который сам ходит на Render.

## Архитектура

```
браузер (РФ) → api.magicesim.store → API Gateway → Cloud Function → Render
                                     (ru-central1)   (проксирование)  (origin)
                     ↓ если недоступен
              /assets/catalog.json   (статический кеш, уже работает)
```

Шлюз — только входная дверь: один catch-all `/{proxy+}`, который отдаёт всё
функции. Граница безопасности — allowlist, фильтрация заголовков, прибитый
upstream — живёт в `proxy-function/index.js`, в коде, который читается и
покрыт тестами (`seo/test-api-domain.mjs`).

### Почему функция, а не встроенная HTTP-интеграция шлюза

Изначально всё было на `x-yc-apigateway-integration: type: http` — декларативно
и без кода. Пришлось отказаться: **эта интеграция теряет тело POST именно для
этого upstream**. Доказано перебором:

| Проверка | Результат |
|---|---|
| Шлюз → echo-сервис | тело целое, `content-length` верный |
| Шлюз → Render, полное тело заказа | `terms_not_accepted` (тело пустое) |
| Render напрямую, то же тело | `package_not_found` (тело дошло) |
| Заведомо битый JSON через шлюз | `terms_not_accepted`, а не ошибка парсера Express |

Пробовал с `requestBody` и без, с явным `method` и без — без разницы.
В production это означало бы, что заказы не создаются вообще.

### Почему проксирование написано вручную, а не через `fetch`

Замер **изнутри Yandex Cloud**: origin резолвится в два адреса, и они не
равноценны — `216.24.57.7` не отвечал на TLS ни разу, `216.24.57.15` отвечал
через раз. При этом установленное соединение быстрое: handshake 48 мс, каталог
240 КБ за ~350 мс.

То есть ненадёжна именно **установка** соединения, а не сам Render. По умолчанию
это выглядело как отказ ~половины параллельных запросов ровно через 10 секунд —
это дефолтный connect timeout undici.

Что сделано в `proxy-function/index.js`:

- **keep-alive пул** — большинство запросов переиспользуют готовое соединение;
- **гонка соединений** — новое соединение открывается сразу ко всем A-адресам,
  побеждает первый завершивший handshake, остальные закрываются;
- **быстрый повтор** — connect timeout 3 с вместо 10, до 4 попыток;
- **повтор только там, где он безопасен** — если хоть один байт ушёл в сокет,
  POST не повторяется. `/retail-orders` создаёт заказ, `/pay` начинает платёж;
  повтор уже дошедшего запроса означал бы двойное списание.

Результат на нагрузке (40 параллельных запросов в 4 сценариях, включая холодный
старт после простоя): было ~50% отказов и пик 17,4 с → стало **0 отказов**,
пик 6,6 с, медиана каталога 0,8 с.

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

Последний пункт критичен: если вебхук перестанет доходить, платежи будут
списываться, но заказы не будут подтверждаться и eSIM не будет выдаваться.

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

**3. Развернуть функцию и шлюз**

```bash
cd infra/yandex-api-gateway
yc serverless function create --name magic-esim-retail-proxy
yc serverless function version create --function-name magic-esim-retail-proxy \
  --runtime nodejs18 --entrypoint index.handler --memory 512m \
  --execution-timeout 30s --concurrency 16 --source-path proxy-function/
yc serverless function set-scaling-policy magic-esim-retail-proxy \
  --tag '$latest' --provisioned-instances-count 1

yc serverless api-gateway create --name magic-esim-retail --spec=retail-proxy.yaml
yc serverless api-gateway get --name magic-esim-retail --format json | jq -r .domain
```

`--concurrency 16` и один прогретый инстанс нужны не ради скорости, а чтобы
keep-alive пул жил и большинство запросов не платили за установку соединения.

**4. Проверить шлюз по временному домену** — все 6 маршрутов против Render:
статус, тело побайтово, CORS, OPTIONS, allowlist, нагрузка. POST — только
безопасные сценарии (несуществующие package_id и токены), реальные заказы не
создаются.

**5. Проверить достижимость из РФ** — с российских IP без VPN. Это acceptance
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
восстановление за 5 минут. Шлюз можно оставить — он почти ничего не стоит.

## Наблюдаемость

Функция пишет по одной структурной строке JSON на запрос — без тела, без email,
без токенов:

```json
{"evt":"proxied","method":"GET","path":"/api/v1/retail/packages","status":200,"attempts":1,"upstream_ms":331,"total_ms":338}
{"evt":"error","method":"GET","path":"/health","kind":"upstream_unreachable","reason":"connect_timeout","attempts":4,"total_ms":12043}
```

Что смотреть:

```bash
yc logging read --resource-ids <function-id> --since 1h --limit 500
```

- рост `attempts` > 1 — деградация связности Yandex Cloud → Render;
- `evt: error` — запросы, которые не дошли; витрина в этот момент показывает
  статический каталог;
- `evt: rejected` — попадания мимо allowlist.

## Стоимость

API Gateway тарифицируется по запросам и трафику, функция — по вызовам и
GB×секундам, прогретый инстанс — непрерывно. При текущем объёме (~240 запросов
за 12 часов, каталог 240 КБ / 23 КБ gzip) это единицы–десятки рублей в месяц.
Прогретый инстанс 512 МБ — основная статья; если он окажется дорогим, его можно
снять (`--provisioned-instances-count 0`), заплатив возвратом холодных стартов.

## Что осталось direct-to-Render и почему

- **Platega webhook** — server-to-server. Недостижимость Render из браузеров РФ
  не означает недостижимости для серверов Platega. Ставить подтверждение платежа
  в зависимость от ещё одного звена — плохой размен.
- **admin / dealer / partner** — не входят в область этой задачи. Кандидаты на
  отдельный шлюз со своим allowlist, если админка нужна из РФ без VPN.
- **`/pay/` приватные ссылки** — браузерные, страдают от той же проблемы;
  выносятся отдельным шагом, чтобы не расширять текущее изменение.

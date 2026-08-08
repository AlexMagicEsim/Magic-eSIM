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
| **QR в письмах клиентам** | `/api/v1/public/retail-esim/{token}/qr.png` | ✅ **добавлен в allowlist** — см. ниже |
| **Telegram client webhook** | `/api/v1/telegram/client-webhook` | ❌ **сломается** — переносится на `origin.` |
| **Админка** | 93 вызова `/api/v1/admin/**` | ❌ **сломается** |
| Dealer API | 11 маршрутов | ❌ сломается |
| Partner portal | 14 маршрутов | ❌ сломается |
| Provider sync (GH Actions) | `/api/v1/admin/providers/**` | ❌ **сломается** — встанут цены |
| **Platega webhook** | `/api/v1/payments/platega/callback` | ❌ **сломается, если он на этом хосте** |
| Приватные ссылки `/pay/` | `/api/v1/public/private-payments/**` | ✅ **добавлены в allowlist** (только публичные) |

Последний пункт критичен: если вебхук перестанет доходить, платежи будут
списываться, но заказы не будут подтверждаться и eSIM не будет выдаваться.

### QR в уже отправленных письмах

`lib/retailEmail.js:67` зашивает в письмо ссылку
`https://api.magicesim.store/api/v1/public/retail-esim/{clientToken}/qr.png`.
Адрес захардкожен, токен не истекает — значит эта ссылка живёт во **всех уже
доставленных** письмах с купленными eSIM. Правка шаблона чинит только будущие
письма, поэтому маршрут добавлен в allowlist шлюза.

Ответ бинарный (`image/png`) и несёт сам секрет установки eSIM, поэтому в
функции:

- тело нигде не декодируется в текст — от Render до ответа шлюза это `Buffer`,
  наружу уходит base64 с `isBase64Encoded: true`;
- пробрасываются `Cache-Control: private, no-store, max-age=0`, `Pragma` и
  `Expires` — backend ставит их намеренно (`lib/sensitiveHeaders.js`), и прокси
  не имеет права ослабить это решение.

Проверено на обоих реальных заказах с выданной eSIM: PNG побайтово идентичен
прямому Render (sha256 совпадает, сигнатура и маркер `IEND` на месте), 404-кейсы
совпадают, JSON от base64-обёртки не пострадал.

### Telegram client webhook

`@magic_esim_support_bot` зарегистрирован через `setWebhook` на
`https://api.magicesim.store/api/v1/telegram/client-webhook`. В allowlist шлюза
не добавляется — переносится на `origin.magicesim.store` вместе с Platega.

При перерегистрации **обязательно** передать `secret_token` со значением
`TELEGRAM_WEBHOOK_SECRET`: проверка в `lib/telegramWebhookAuth.js` fail-closed,
и без секрета все апдейты будут отклоняться с 401.

`@magic_esim_bot` (админский/алерты) вебхука не имеет — миграции не требует.

### Platega webhook: env-переменная тут ни при чём

`PLATEGA_CALLBACK_URL` **не управляет** адресом уведомлений. Она читается в
`getConfig()` (`lib/platega.js:65`) и оттуда попадает только в `safeConfig()` —
представление конфига для логов. `buildCreateTransactionBody()` отправляет в
Platega лишь `paymentDetails`, `description`, `return`, `failedUrl`, `payload`,
`paymentMethod`, `metadata`; поля `callbackUrl` в теле нет, и других
потребителей у переменной в коде тоже нет.

Адрес, куда Platega шлёт callback, зарегистрирован **в кабинете Platega**.
Менять надо там; значение в Render стоит привести в соответствие, чтобы
переменная не расходилась с действительностью, но на поведение это не влияет.

Подтверждено: в production она указывает на `api.magicesim.store`, то есть
вебхук переехать обязан.

## Порядок развёртывания

Витрину переключаем **последней**. Сначала уводим всё остальное на прямой хост.

**1. Новая DNS-запись — прямой путь к Render (ничего не ломает)**

```
Type: CNAME   Host: origin   Value: esim-backend-3wmu.onrender.com   TTL: 300
```

**2. Перевести не-retail потребителей на `origin.magicesim.store`**
   - **Кабинет Platega** — адрес уведомлений на
     `https://origin.magicesim.store/api/v1/payments/platega/callback`
     (это и есть настоящий рычаг, см. выше)
   - Render → Environment: `PLATEGA_CALLBACK_URL` — то же значение, для согласованности
   - **Telegram** — перерегистрировать вебхук клиентского бота, обязательно с
     `secret_token` = `TELEGRAM_WEBHOOK_SECRET`:
     ```
     POST https://api.telegram.org/bot<TELEGRAM_CLIENT_BOT_TOKEN>/setWebhook
     url=https://origin.magicesim.store/api/v1/telegram/client-webhook
     secret_token=<TELEGRAM_WEBHOOK_SECRET>
     ```
   - `~/magicesim-frontend`: `API_BASE`
   - `~/esim-backend/.github/workflows/sync-provider-prices.yml`: `API_BASE` ×2
   - `~/esim-backend/.env.platega.example:30` — привести пример в соответствие
   - Проверить, что админка и sync работают на новом хосте

**3. Развернуть функцию и шлюз**

```bash
cd infra/yandex-api-gateway
yc serverless function create --name magic-esim-retail-proxy
# --service-account-id обязателен: без него логов не будет, см. «Наблюдаемость»
yc serverless function version create --function-name magic-esim-retail-proxy \
  --runtime nodejs18 --entrypoint index.handler --memory 512m \
  --execution-timeout 30s --concurrency 16 \
  --service-account-id <sa-с-ролью-logging.writer> \
  --source-path proxy-function/
yc serverless function set-scaling-policy magic-esim-retail-proxy \
  --tag '$latest' --provisioned-instances-count 1

yc serverless api-gateway create --name magic-esim-retail --spec=retail-proxy.yaml
# INFO-строки доступа шлюза содержат путь целиком, а в трёх маршрутах путь несёт
# токен — см. «Наблюдаемость»
yc serverless api-gateway update --name magic-esim-retail --min-log-level warn
yc serverless api-gateway get --name magic-esim-retail --format json | jq -r .domain
```

`--concurrency 16` и один прогретый инстанс нужны не ради скорости, а чтобы
keep-alive пул жил и большинство запросов не платили за установку соединения.

**4. Проверить шлюз по временному домену** — все 9 маршрутов против Render:
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

### Обязательное условие: сервисный аккаунт

**Без сервисного аккаунта у версии функции её `console.log` в Cloud Logging не
попадает.** В логах видны только строки сборки, и выглядит это как «логирование
работает» — пока не попробуешь найти конкретный запрос. Первая рабочая версия
прокси была развёрнута без аккаунта, и трое суток наблюдаемости фактически не
было; обнаружилось это только при разборе 502.

Нужен отдельный аккаунт ровно с одной ролью:

```bash
yc iam service-account create --name magic-esim-retail-proxy-logger
yc resource-manager folder add-access-binding <folder-id> \
  --role logging.writer --service-account-id <sa-id>
```

`logging.writer` достаточно. `editor`/`admin` не нужны и не должны выдаваться.
Аккаунт указывается при создании версии — см. шаг 3 порядка развёртывания.

Проверить, что он на месте:

```bash
yc serverless function version list --function-name magic-esim-retail-proxy \
  --format json | jq -r '.[0].service_account_id'
```

Пусто — логов не будет.

### Что пишется

По одной структурной строке JSON на запрос:

```json
{"evt":"proxied","method":"GET","path":"/api/v1/retail/packages","status":200,"attempts":1,"bytes":180280,"upstream_ms":237,"total_ms":237}
{"evt":"rejected","method":"GET","path":"/api/v1/admin/packages","status":404}
{"evt":"error","method":"GET","path":"/health","kind":"upstream_unreachable","reason":"connect_timeout","attempts":4,"total_ms":12043}
```

- `attempts` > 1 — первое соединение с Render не встало, спасал повтор. Это
  штатная работа гонки соединений, но рост доли — сигнал деградации связности;
- `evt: error` — запрос не дошёл; витрина в этот момент показывает статический
  каталог;
- `evt: rejected` — попадание мимо allowlist.

Тела запросов и ответов не логируются, заголовки тоже.

### Токены в путях замаскированы

У трёх маршрутов токен лежит **в самом пути**:

```
/api/v1/public/retail-esim/{client_token}/qr.png
/api/v1/public/retail-orders/{client_token}/status
/api/v1/public/private-payments/{public_token}
```

Токен QR — это доступ к секрету установки eSIM, и он не истекает. В Cloud
Logging с его собственным retention и своим кругом читателей такому не место.

Закрыто в двух местах, потому что пишут двое:

**1. Функция** — `logPath()` в `proxy-function/index.js`. Для совпавшего
маршрута в лог идёт сам шаблон из `ROUTES`, поэтому лог токен-безопасен по
построению и не может разойтись с allowlist. Для отклонённого пути (это
произвольный ввод клиента) те же сегменты затираются регуляркой.

**2. Шлюз** — писал собственную access-строку `GET /api/v1/... 404` с **полным**
путём. Маскирование в функции на неё не влияет. Поэтому у шлюза поднят
минимальный уровень:

```bash
yc serverless api-gateway update --name magic-esim-retail --min-log-level warn
```

INFO-строки доступа уходят, предупреждения и ошибки шлюза остаются. Ничего не
теряется: функция и так пишет метод, путь, статус и латентность по каждому
запросу, только с маскированием. Настройка живёт в конфигурации шлюза, а не в
`retail-proxy.yaml` — при пересоздании шлюза её надо выставить заново.

Проверить, что уровень на месте:

```bash
yc serverless api-gateway get --name magic-esim-retail --format json | jq .log_options
# {"folder_id":"...","min_level":"WARN"}
```

### Как читать

```bash
yc logging read --group-name default \
  --since 2026-08-08T07:04:00Z --until 2026-08-08T07:07:00Z \
  --limit 50 --format json
```

Две особенности CLI, на которых легко потерять час:

- записи отдаются **от старых к новым**, и `--limit` обрезает окно с начала.
  `--since 1h --limit 50` вернёт первые 50 записей часа — обычно это логи
  сборки, а не то, что искали. Читать надо узкими окнами по времени;
- при `--limit` больше ~50 команда стабильно подвисает. Окно лучше делить на
  куски по 15–30 секунд.

Доставка запаздывает: запись с меткой 07:12 становится читаемой через несколько
минут. Пустой ответ сразу после запроса ещё ничего не значит.

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
- **admin-часть приватных ссылок** (`/api/v1/admin/private-payment-links/**`) —
  создание, список и отключение ссылок; админская работа, остаётся снаружи.
  Публичные `/api/v1/public/private-payments/{token}` и `.../start` в allowlist
  есть: их вызывает `404.html` из браузера при обслуживании `/pay/`, значит они
  страдают от той же недоступности, что и витрина.

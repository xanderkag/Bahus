# Гайд по переезду Bakhus на Vercel + Supabase + Railway

Этот гайд описывает шаги для полного переноса инфраструктуры с Yandex Cloud (прерываемой ВМ) на современные PaaS-решения.

## 1. Настройка Базы Данных (Supabase)

1. Зарегистрируйтесь на [Supabase](https://supabase.com/) (можно через GitHub).
2. Создайте новый проект (New Project). Установите надежный пароль для базы данных и выберите регион поближе (Frankfurt/London).
3. Дождитесь, пока база данных создастся (это займет около минуты).
4. Перейдите в раздел **SQL Editor** (в левом меню).
5. Нажмите **New Query** и вставьте содержимое файла `db/supabase_master.sql` (лежит в корне репозитория Bakhus).
6. Нажмите **Run** (Выполнить). База данных готова!
7. Перейдите в раздел **Project Settings -> Database** и скопируйте вашу **Connection string** (вкладка URI). Замените строку `[YOUR-PASSWORD]` на пароль, который вы ввели на шаге 2. 
   *(Пример: `postgresql://postgres.[вашид]:[ваш_пароль]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?supa=base-pooler.x`)*

## 2. Настройка Бэкенда (Railway)

1. Зарегистрируйтесь на [Railway.app](https://railway.app/).
2. В дашборде нажмите **New Project** -> **Deploy from GitHub repo**.
3. Выберите свой репозиторий `Bakhus`.
4. Сразу после добавления сервис попытается собраться. Перейдите в настройки этого сервиса:
   - Вкладка **Settings -> Deploy -> Dockerfile Path**: впишите туда `docker/postgres-api.Dockerfile`.
   - Вкладка **Variables**: Нажмите **New Variable**.
     - Имя: `DATABASE_URL`
     - Значение: вставьте ссылку `postgresql://...` из Supabase (шаг 1).
5. Теперь нажмите кнопку **Deploy**. Railway сам соберет Python-бэкенд.
6. В разделе **Settings -> Networking -> Public Networking** нажмите **Generate Domain**. Railway выдаст вам бесплатный домен (например, `bakhus-api.up.railway.app`). Наш бэкенд в облаке!

## 3. Настройка Фронтенда (Vercel)

*Важная деталь: чтобы обойти проблему CORS (блокировку связи между двумя разными доменами) и ничего не переписывать в JS-коде, мы используем механизм **rewrites** (он уже настроен в файле `vercel.json` в репозитории).*

1. Откройте файл `vercel.json` у себя в коде.
2. В строке `"destination": "https://bakhus-api.up.railway.app/api/:match*"` замените адрес `bakhus-api.up.railway.app` на тот уникальный домен, который вам выдал Railway в самом конце шага 2.
3. Отправьте изменения в GitHub (`git commit` -> `git push`).
4. Зарегистрируйтесь на [Vercel](https://vercel.com/) и нажмите **Add New -> Project**.
5. Импортируйте свой GitHub репозиторий `Bakhus`.
6. Оставьте все настройки по умолчанию (Framework Preset: Other) и нажмите **Deploy**.

**Всё готово.** Vercel выдаст вам ссылку, по которой откроется интерфейс, а все API-запросы под капотом будут автоматически улетать на Railway, который, в свою очередь, будет складировать данные в Supabase.

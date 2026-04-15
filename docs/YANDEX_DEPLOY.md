# Деплой проекта Bahus в Yandex Cloud

Этот гайд описывает процесс развертывания проекта Bahus на виртуальной машине (Compute Cloud) в Yandex Cloud.

## 1. Архитектура развертывания

Мы используем минимальную, но надежную архитектуру:
- **Yandex Compute Cloud (VM):** Обычная виртуальная машина на базе Ubuntu/Debian.
- **Docker + Docker Compose:** Весь стек (Postgres, Python Backend, Nginx Frontend) работает в изолированных контейнерах.
- **Nginx (Frontend контейнер):** Раздает статику UI и работает как reverse proxy (`/api/` -> `postgres-api`).
- **Postgres API:** Легковесный backend-сервер, который пишет в БД и общается с n8n.
- **PostgreSQL:** База данных, смонтированная в Volume для сохранности данных.

Эта архитектура позволяет деплоить всё одной командой, легко бэкапить БД и при необходимости переехать на другую инфраструктуру.

## 2. Подготовка виртуальной машины (Yandex Cloud)

1. Зайдите в консоль Yandex Cloud.
2. Перейдите в **Compute Cloud** -> **Создать ВМ**.
3. Выберите образ **Ubuntu 22.04 LTS** или новее.
4. Выберите минимальные ресурсы (2 vCPU, 2-4 ГБ RAM, 20-30 ГБ диск) — этого хватит для старта.
5. Убедитесь, что у ВМ есть **публичный IP-адрес**.
6. Подключитесь к машине по SSH.

## 3. Установка зависимостей на сервере

На новой ВМ нужно установить Docker и Git:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git docker.io docker-compose
sudo systemctl enable --now docker
```

## 4. Загрузка проекта и настройка

Склонируйте репозиторий проекта на сервер:

```bash
# Пример: если проект в закрытом репо, используйте SSH-ключ или Personal Access Token
git clone https://github.com/vash-repo/bahus.git /opt/bahus
cd /opt/bahus
```

Настройте переменные окружения:

```bash
cp .env.example .env
nano .env
```

Обязательно измените в `.env`:
- `PUBLIC_API_URL` — укажите IP вашей машины или домен (например, `http://158.160.x.x`). **Обязательно с http:// или https://, без слэша на конце.** Это нужно, чтобы n8n знал, куда возвращать ответ.
- `POSTGRES_PASSWORD` — придумайте надежный пароль.

## 5. Запуск проекта

Запустите контейнеры в фоновом режиме, используя специальный production compose-файл:

```bash
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

Проверьте статусы контейнеров:

```bash
sudo docker-compose -f docker-compose.prod.yml ps
```

Вы должны увидеть 3 запущенных контейнера: `bakhus-postgres`, `bakhus-postgres-api` и `bakhus-frontend`.

## 6. Проверка и логи

Убедитесь, что сервер отвечает:
```bash
curl -s http://localhost/api/health
```

Посмотреть логи backend-а (например, при отладке webhook'ов от n8n):
```bash
sudo docker logs -f bakhus-postgres-api
```

## 7. Настройка домена и HTTPS (Рекомендуется)

Чтобы интеграция с внешними системами (в т.ч. n8n) работала безопасно, настоятельно рекомендуется настроить домен и HTTPS. 

Самый простой способ — использовать **Caddy** или **Nginx Proxy Manager**, либо настроить бесплатный SSL сертификат от Let's Encrypt (Certbot) поверх нашего nginx. Если вы настроите HTTPS, не забудьте изменить `PUBLIC_API_URL` в `.env` на `https://ваш-домен.ru` и перезапустить сервис:

```bash
sudo docker-compose -f docker-compose.prod.yml up -d
```

## 8. Обновление проекта

Когда вы выкатываете новые изменения (git pull):

```bash
cd /opt/bahus
git pull
sudo docker-compose -f docker-compose.prod.yml up -d --build
```
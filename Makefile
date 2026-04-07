PORT ?= 4173
HOST ?= 127.0.0.1
PID_FILE ?= .local/dev-server.pid
SERVER_MATCH ?= scripts/dev_server.py

.PHONY: install run run-bg stop status health docker-up docker-down docker-logs mock-api real-api up-local db-up db-down db-logs db-psql

install:
	@mkdir -p .local

run: install
	@python3 scripts/dev_server.py --host $(HOST) --port $(PORT)

run-bg: install
	@if [ -f "$(PID_FILE)" ] && ps -p $$(cat "$(PID_FILE)") -o command= 2>/dev/null | grep -F "$(SERVER_MATCH)" >/dev/null; then \
		echo "dev server already running on PID $$(cat "$(PID_FILE)")"; \
	else \
		rm -f "$(PID_FILE)"; \
		nohup python3 scripts/dev_server.py --host $(HOST) --port $(PORT) > .local/dev-server.log 2>&1 & \
		echo $$! > "$(PID_FILE)"; \
		sleep 1; \
		if ps -p $$(cat "$(PID_FILE)") -o command= 2>/dev/null | grep -F "$(SERVER_MATCH)" >/dev/null; then \
			echo "dev server started on http://$(HOST):$(PORT)"; \
		else \
			echo "dev server failed to start; see .local/dev-server.log"; \
			rm -f "$(PID_FILE)"; \
			exit 1; \
		fi; \
	fi

stop:
	@if [ -f "$(PID_FILE)" ] && ps -p $$(cat "$(PID_FILE)") -o command= 2>/dev/null | grep -F "$(SERVER_MATCH)" >/dev/null; then \
		kill $$(cat "$(PID_FILE)"); \
		rm -f "$(PID_FILE)"; \
		echo "dev server stopped"; \
	else \
		rm -f "$(PID_FILE)"; \
		echo "dev server is not running"; \
	fi

status:
	@if [ -f "$(PID_FILE)" ] && ps -p $$(cat "$(PID_FILE)") -o command= 2>/dev/null | grep -F "$(SERVER_MATCH)" >/dev/null; then \
		echo "running: PID $$(cat "$(PID_FILE)")"; \
	else \
		rm -f "$(PID_FILE)"; \
		echo "stopped"; \
	fi

health:
	@python3 scripts/healthcheck.py --host $(HOST) --port $(PORT)

mock-api: install
	@python3 scripts/mock_api.py --host $(HOST) --port 8079

real-api: install
	@python3 scripts/postgres_api.py --host $(HOST) --port 8078

up-local: install
	@python3 scripts/run_local_stack.py --host $(HOST) --frontend-port $(PORT) --api-port 8079

docker-up:
	@docker compose up --build -d

docker-down:
	@docker compose down

docker-logs:
	@docker compose logs -f --tail=100

db-up:
	@docker compose up -d postgres adminer

db-down:
	@docker compose stop postgres adminer

db-logs:
	@docker compose logs -f --tail=100 postgres adminer

db-psql:
	@docker compose exec postgres psql -U bakhus -d bakhus

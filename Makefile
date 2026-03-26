.PHONY: help install install-backend install-frontend backend frontend run stop

# Порты (совпадают с настройками в коде)
BACKEND_PORT ?= 5050
FRONTEND_PORT ?= 3000

help:
	@echo "Доступные команды:"
	@echo "  make install         - установить зависимости backend и frontend"
	@echo "  make install-backend - установить Python-зависимости"
	@echo "  make install-frontend - установить npm-зависимости"
	@echo "  make backend        - запустить бэкенд (порт $(BACKEND_PORT))"
	@echo "  make frontend       - запустить фронтенд (порт $(FRONTEND_PORT))"
	@echo "  make run            - запустить backend + frontend вместе"
	@echo "  make stop           - остановить backend (если запущен через make run)"

install: install-backend install-frontend

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

backend:
	cd backend && python run.py

frontend:
	cd frontend && npm start

run:
	@echo "Запуск backend на порту $(BACKEND_PORT)..."
	@(cd backend && python run.py & echo $$! > ../.backend.pid)
	@sleep 2
	@echo "Запуск frontend на порту $(FRONTEND_PORT)..."
	@cd frontend && (npm start; kill $$(cat ../.backend.pid 2>/dev/null) 2>/dev/null || true; rm -f ../.backend.pid; exit 0)
		exit 0

stop:
	@if [ -f .backend.pid ]; then \
		kill $$(cat .backend.pid) 2>/dev/null && echo "Backend остановлен" || true; \
		rm -f .backend.pid; \
	else \
		echo "Backend не запущен через make run"; \
	fi

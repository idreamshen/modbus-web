SHELL := /bin/bash

.PHONY: dev

dev:
	npm install
	@echo "Starting Modbus TCP proxy and Vite dev server..."
	@trap 'echo; echo "Stopping dev services..."; kill $$proxy_pid $$frontend_pid 2>/dev/null || true; wait $$proxy_pid $$frontend_pid 2>/dev/null || true' INT TERM EXIT; \
	npm run proxy & proxy_pid=$$!; \
	npm run dev & frontend_pid=$$!; \
	wait -n $$proxy_pid $$frontend_pid

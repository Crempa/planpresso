# Planpresso - Development Server
# Usage: make start / make stop / make status

PORT ?= 4000
PID_FILE = .server.pid

.PHONY: start stop status restart

start:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running on http://localhost:$(PORT)"; \
	else \
		nohup python3 -m http.server $(PORT) > /dev/null 2>&1 & echo $$! > $(PID_FILE); \
		sleep 0.5; \
		if kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
			echo "Server started on http://localhost:$(PORT)"; \
		else \
			echo "Failed to start server (port $(PORT) may be in use)"; \
			rm -f $(PID_FILE); \
		fi \
	fi

stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null && echo "Server stopped" || echo "Server not running"; \
		rm -f $(PID_FILE); \
	else \
		echo "No server running"; \
	fi

status:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server running on http://localhost:$(PORT) (PID: $$(cat $(PID_FILE)))"; \
	else \
		echo "Server not running"; \
		rm -f $(PID_FILE) 2>/dev/null; \
	fi

restart: stop start

open: start
	@open http://localhost:$(PORT)

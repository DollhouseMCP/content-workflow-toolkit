# Content Workflow Toolkit - Docker Commands

.PHONY: build up down logs shell dev clean help

# Default target
help:
	@echo "Content Workflow Toolkit - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Production:"
	@echo "  build    Build the Docker image"
	@echo "  up       Start the dashboard (detached)"
	@echo "  down     Stop the dashboard"
	@echo "  logs     View dashboard logs"
	@echo "  shell    Open shell in container"
	@echo ""
	@echo "Development:"
	@echo "  dev      Start in development mode with hot reload"
	@echo "  dev-logs View development logs"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean    Remove containers and images"
	@echo "  restart  Restart the dashboard"

# Build the production image
build:
	docker compose build dashboard

# Start production dashboard
up:
	docker compose up -d dashboard
	@echo ""
	@echo "Dashboard running at http://localhost:3000"

# Stop dashboard
down:
	docker compose down

# View logs
logs:
	docker compose logs -f dashboard

# Open shell in container
shell:
	docker compose exec dashboard sh

# Development mode
dev:
	docker compose --profile dev up dashboard-dev
	@echo ""
	@echo "Development dashboard running at http://localhost:3000"

dev-logs:
	docker compose logs -f dashboard-dev

# Restart
restart: down up

# Clean up
clean:
	docker compose down --rmi local --volumes --remove-orphans
	@echo "Cleaned up containers and images"

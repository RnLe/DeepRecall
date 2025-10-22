.PHONY: run runb down rerun rerunb clean setup-dirs reset-db

# Start Docker containers
run:
	docker compose up

# Start Docker containers with build
runb:
	docker compose up --build

# Stop and remove containers + volumes (fresh start)
down:
	docker compose down -v

# Stop containers (keep volumes - faster restart)
stop:
	docker compose down

# Clean Docker build cache
clean-docker:
	@echo "Cleaning Docker images and build cache..."
	docker system prune -f
	@echo "✅ Docker cleaned!"

# Restart containers (down + run)
rerun: down run

# Restart containers with build (down + runb)
rerunb: down runb

# Set up required directories
setup-dirs:
	@echo "Creating directories..."
	mkdir -p data/library
	@echo "✅ Directories ready!"
	@echo "Add PDFs to data/library/ then run 'make runb'"

# Fix ownership of data directory (if created by Docker as root)
fix-permissions:
	@echo "Fixing data directory permissions..."
	sudo chown -R $(USER):$(USER) data/
	@echo "✅ Permissions fixed!"

# Reset database (keep PDFs)
reset-db:
	@echo "Resetting database..."
	rm -f data/cas.db*
	@echo "✅ Database reset!"
	@echo "Run 'make runb' to rebuild and rescan"

# Clean all generated files and caches
clean:
	@echo "Cleaning apps/web..."
	sudo rm -rf apps/web/node_modules
	sudo rm -rf apps/web/.next
	sudo rm -rf apps/web/.pnpm-store
	sudo rm -f apps/web/pnpm-lock.yaml
	@echo "Cleaning packages..."
	sudo rm -rf packages/*/node_modules
	sudo rm -rf packages/*/.pnpm-store
	@echo "Cleaning root..."
	sudo rm -rf node_modules
	sudo rm -rf .pnpm-store
	sudo rm -f pnpm-lock.yaml
	@echo "Cleaning python..."
	sudo rm -rf python/__pycache__
	sudo rm -rf python/**/__pycache__
	@echo "✅ Clean complete!"

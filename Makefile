.PHONY: run runb down rerun rerunb clean setup-dirs reset-db

# Start Docker containers
run:
	cd frontend
	docker compose up

# Start Docker containers with build
runb:
	cd frontend
	docker compose up --build

# Stop and remove containers + volumes (fresh start)
down:
	cd frontend && docker compose down -v

# Stop containers (keep volumes - faster restart)
stop:
	cd frontend && docker compose down

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
	@echo "Cleaning frontend..."
	sudo rm -rf frontend/node_modules
	sudo rm -rf frontend/.next
	sudo rm -rf frontend/.pnpm-store
	sudo rm -f frontend/pnpm-lock.yaml
	@echo "Cleaning python..."
	sudo rm -rf python/__pycache__
	sudo rm -rf python/**/__pycache__
	@echo "Clean complete!"

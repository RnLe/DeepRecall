.PHONY: run runb down rerun rerunb clean setup-dirs reset-db

# Start Docker containers
run:
	docker compose up

# Start Docker containers with build
runb:
	docker compose up --build

# Stop and remove containers + volumes (fresh start - WIPES ALL DATA)
down:
	docker compose down -v

# Stop containers (keep volumes - preserves Postgres data)
stop:
	docker compose down

# Restart containers preserving data (stop + run)
rerun: stop run

# Restart containers with build preserving data (stop + runb)
rerunb: stop runb

# FULL RESET: Wipe everything including Postgres (down + runb)
reset: down runb

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
	sudo rm -rf apps/*/node_modules
	sudo rm -rf apps/*/.next
	sudo rm -rf apps/*/.pnpm-store
	sudo rm -rf apps/*/dist
	sudo rm -f apps/*/pnpm-lock.yaml
	@echo "Cleaning packages..."
	sudo rm -rf packages/*/node_modules
	sudo rm -rf packages/*/dist
	sudo rm -rf packages/*/.pnpm-store
	@echo "Cleaning root..."
	sudo rm -rf node_modules
	sudo rm -rf .pnpm-store
	sudo rm -f pnpm-lock.yaml
	@echo "Cleaning python..."
	sudo rm -rf python/__pycache__
	sudo rm -rf python/**/__pycache__
	@echo "Cleaning any node_modules..."
	sudo rm -rf **/node_modules
	@echo "Cleaning any Rust build files..."
	sudo rm -rf apps/*/src-tauri/target
	@echo "✅ Clean complete!"

# Build Windows desktop app from WSL2
build-windows:
	@echo "Building Windows desktop app..."
	cd apps/desktop && pnpm tauri build --target x86_64-pc-windows-gnu --no-bundle
	@echo "Copying to Windows Desktop..."
	cp apps/desktop/src-tauri/target/x86_64-pc-windows-gnu/release/deeprecall.exe /mnt/c/Users/renem/Desktop/DeepRecall.exe
	@echo "✅ DeepRecall.exe copied to Windows Desktop!"

# Run migrations on Neon cloud database
migrate-neon:
	@echo "Running Neon database migrations..."
	cd apps/desktop && ./migrate-neon.sh

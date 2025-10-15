.PHONY: run runb down rerun rerunb clean

# Start Docker containers
run:
	cd frontend
	docker compose up

# Start Docker containers with build
runb:
	cd frontend
	docker compose up --build

# Stop and remove containers, volumes
down:
	cd frontend
	docker compose down -v

# Restart containers (down + run)
rerun: down run

# Restart containers with build (down + runb)
rerunb: down runb

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

# ==============================================================================
# MAKEFILE - ECOSISTEMA DE ASISTENCIA EMOCIONAL
# ==============================================================================
# Automatiza las tareas de desarrollo, diagnóstico, pruebas y despliegue.
# ==============================================================================

.PHONY: help install test run check-gpu smoke-test docker-up docker-down docker-logs clean

# Comando predeterminado: mostrar ayuda
help:
	@echo "======================================================================"
	@echo "           Ecosistema de Asistencia Emocional - Comandos"
	@echo "======================================================================"
	@echo "Desarrollo local (Nativo):"
	@echo "  make install       - Ejecuta el instalador setup.sh"
	@echo "  make test          - Ejecuta la suite de pruebas unitarias"
	@echo "  make run           - Corre la demostración interactiva del motor"
	@echo "  make clean         - Limpia archivos temporales y caché de Python"
	@echo ""
	@echo "Diagnóstico y Validación:"
	@echo "  make check-gpu     - Audita el estado de la GPU del host"
	@echo "  make smoke-test    - Valida conectividad básica de Ollama/Chroma"
	@echo ""
	@echo "Contenedores (Docker):"
	@echo "  make docker-up     - Levanta los contenedores en segundo plano"
	@echo "  make docker-down   - Detiene y remueve los contenedores"
	@echo "  make docker-logs   - Muestra logs en tiempo real"
	@echo "======================================================================"

# Ejecutar instalador
install:
	@chmod +x setup.sh scripts/*.sh 2>/dev/null || true
	./setup.sh

# Ejecutar suite de pruebas
test:
	python3 -m unittest tests.test_engine -v

# Ejecutar demo interactiva
run:
	python3 engine.py

# Diagnóstico de hardware/GPU
check-gpu:
	@chmod +x scripts/check_gpu.sh 2>/dev/null || true
	./scripts/check_gpu.sh

# Test de humo de conectividad
smoke-test:
	@chmod +x scripts/smoke_test.sh 2>/dev/null || true
	./scripts/smoke_test.sh

# Contenedores
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# Limpieza
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	rm -rf .pytest_cache

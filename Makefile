.PHONY: help up down infra front api worker logs shell shell-worker migrate revert migrate-show status reset-db

COMPOSE ?= docker compose
SERVICE ?= node
SHELL_BIN ?= sh

help: ## Lista os comandos disponíveis
	@awk 'BEGIN {FS = ":.*##"; printf "\nContext Hub — make targets\n\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\n"

up: ## Sobe toda a infra Docker (db, redis, api, worker)
	$(COMPOSE) up -d --build

infra: ## Sobe só db + redis
	$(COMPOSE) up -d db redis

down: ## Para e remove containers (mantém ./db)
	$(COMPOSE) down

front: ## Sobe o frontend (Vite)
	@mkdir -p apps/web/.vite
	@# Se node_modules ficou root/nobody (install via Docker), corrige dono
	@if [ -d apps/web/node_modules ] && [ ! -w apps/web/node_modules ]; then \
	  echo "Corrigindo permissões de apps/web/node_modules…"; \
	  docker run --rm -v "$(CURDIR):/app" alpine:3.20 \
	    chown -R $$(id -u):$$(id -g) /app/apps/web/node_modules /app/apps/web/.vite /app/node_modules 2>/dev/null \
	    || echo "Não foi possível corrigir permissões automaticamente. Rode: sudo chown -R \$$(whoami) apps/web/node_modules node_modules"; \
	fi
	pnpm --filter @context-hub/web dev

api: ## Sobe/reinicia API + worker
	$(COMPOSE) up -d --build node worker

worker: ## Reinicia só o worker
	$(COMPOSE) up -d --build worker

logs: ## Logs da API e worker (follow)
	$(COMPOSE) logs -f node worker

status: ## Status dos containers
	$(COMPOSE) ps

shell: ## Entra no container da API (node)
	$(COMPOSE) exec -it $(SERVICE) $(SHELL_BIN)

shell-worker: ## Entra no container do worker
	$(COMPOSE) exec -it worker $(SHELL_BIN)

migrate: ## Roda migrations (dentro do container API)
	$(COMPOSE) exec $(SERVICE) pnpm migration:run

revert: ## Reverte a última migration (dentro do container API)
	$(COMPOSE) exec $(SERVICE) pnpm migration:revert

migrate-show: ## Mostra status das migrations
	$(COMPOSE) exec $(SERVICE) pnpm migration:show

reset-db: ## Para tudo e apaga dados do Postgres em ./db (destrutivo)
	$(COMPOSE) down
	@echo "Removendo ./db ..."
	@rm -rf ./db || sudo rm -rf ./db
	$(COMPOSE) up -d --build
	@echo "Aguardando db..."
	@sleep 5
	$(COMPOSE) exec $(SERVICE) pnpm migration:run

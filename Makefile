.PHONY: menu demo test diagrams backend

.DEFAULT_GOAL := menu

menu:
	@bash -c '\
		echo "Select a task:"; \
		echo "  1) demo"; \
		echo "  2) backend"; \
		echo "  3) test"; \
		echo "  4) diagrams"; \
		echo "  q) quit"; \
		read -r -p "> " choice; \
		case "$$choice" in \
			1|demo) $(MAKE) demo ;; \
			2|backend) $(MAKE) backend ;; \
			3|test) $(MAKE) test ;; \
			4|diagrams) $(MAKE) diagrams ;; \
			q|quit|"") echo "Bye." ;; \
			*) echo "Unknown choice: $$choice" ; exit 2 ;; \
		esac'

demo:
	DEMO_TIMEOUT=60 scripts/run-demo.sh

backend:
	GRAPHQL_API_TOKEN=dev-token docker compose up --build

test:
	npm test

diagrams:
	scripts/export-diagrams.sh

.PHONY: menu demo test diagrams

.DEFAULT_GOAL := menu

menu:
	@bash -c '\
		echo "Select a task:"; \
		echo "  1) demo"; \
		echo "  2) test"; \
		echo "  3) diagrams"; \
		echo "  q) quit"; \
		read -r -p "> " choice; \
		case "$$choice" in \
			1|demo) $(MAKE) demo ;; \
			2|test) $(MAKE) test ;; \
			3|diagrams) $(MAKE) diagrams ;; \
			q|quit|"") echo "Bye." ;; \
			*) echo "Unknown choice: $$choice" ; exit 2 ;; \
		esac'

demo:
	DEMO_TIMEOUT=60 scripts/run-demo.sh

test:
	npm test

diagrams:
	scripts/export-diagrams.sh

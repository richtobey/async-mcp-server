.PHONY: demo test diagrams

demo:
	DEMO_TIMEOUT=60 scripts/run-demo.sh

test:
	npm test

diagrams:
	scripts/export-diagrams.sh

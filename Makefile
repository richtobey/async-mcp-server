.PHONY: demo test diagrams

demo:
	scripts/run-demo.sh

test:
	npm test

diagrams:
	scripts/export-diagrams.sh

# Makefile for oepsbanaan.nl
#
# Design principles:
# - The Makefile is an orchestrator: it wires targets together.
# - All procedural logic lives in build/scripts/*.sh (portable, testable).
# - Every target should be safe to re-run (idempotent where possible).

SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:

# -------------------------------------------------
# Project paths
# -------------------------------------------------
HTML_DIR      := html
STAMP_DIR     := .stamps

SITE_STAMP    := $(STAMP_DIR)/site.ok
MEDIA_STAMP   := $(STAMP_DIR)/media.ok
FAVICON_STAMP := $(STAMP_DIR)/favicon.ok

# Combined dependency for targets that need a complete build
BUILD_DEPS := $(SITE_STAMP) $(MEDIA_STAMP) $(FAVICON_STAMP)

# Input lists per concern — each stamp rebuilds only when its own inputs change.
# GIFs are in SITE_INPUTS too so data-banana stays in sync when GIFs are added/removed.
SITE_INPUTS := \
  build/scripts/build-html.sh \
  build/scripts/build-css.sh \
  build/scripts/build-js.sh \
  $(TOOLS_DOCKERFILE) \
  $(shell find assets/site    -type f 2>/dev/null) \
  $(shell find assets/img     -maxdepth 1 -name '*.gif' 2>/dev/null) \
  $(shell find build/config   -type f 2>/dev/null)

MEDIA_INPUTS := \
  build/scripts/build-video.sh \
  $(MEDIA_DOCKERFILE) \
  $(shell find assets/img -maxdepth 1 -name '*.gif' 2>/dev/null)

FAVICON_INPUTS := \
  build/scripts/build-favicon.sh \
  $(MEDIA_DOCKERFILE) \
  $(shell find assets/favicons -type f 2>/dev/null)

# -------------------------------------------------
# Docker image tags (overrideable)
# -------------------------------------------------
ALPINE_TAG ?= 3.23
NODE_TAG   ?= 25-alpine
PW_VERSION ?= 1.48.2

# Image names (overrideable)
TOOLS_IMG     ?= oepsbanaan-tools:node
HTMLCHECK_IMG ?= oepsbanaan-htmlcheck:latest
PW_IMG        ?= oepsbanaan-playwright:$(PW_VERSION)
MEDIA_IMG     ?= oepsbanaan-media:alpine

# Dockerfiles (single source of truth)
TOOLS_DOCKERFILE    := build/docker/Dockerfile.frontend-tools
HTMLCHECK_DOCKERFILE := build/docker/Dockerfile.htmlcheck
PW_DOCKERFILE       := build/docker/Dockerfile.playwright
MEDIA_DOCKERFILE    := build/docker/Dockerfile.media-tools

# -------------------------------------------------
# Serve settings
# -------------------------------------------------
PORT       ?= 8080
SERVE_NAME ?= oepsbanaan-serve

# -------------------------------------------------
# Test settings (overrideable)
# -------------------------------------------------
NO_BUILD       ?= 0
PROJECT_SET    ?= full
PROJECT        ?=
PW_DEBUG_LOGS  ?=
PW_ARGS        ?=

# -------------------------------------------------
# Help text
# -------------------------------------------------
define PRINT_HELP
Targets:

  help                     Show this help

Build:
  build                    Build ./html — three independent stamps (site / media / favicon).
                           Only the parts whose inputs changed are rebuilt.
  clean                    Remove build output (html/) and all stamps

Lint:
  lint                     Run ESLint on site JS and test files (requires tools image)
  lint-css                 Run stylelint on site CSS (requires tools image)

Fast tests (require a complete build):
  test                     Run sanity + links + HTML validation
  sanity                   Verify build output structure and no stray assets/ refs
  links                    Verify all href/src references resolve within ./html
  htmlcheck                Validate built HTML with the Nu HTML Checker

Playwright:
  test-playwright          Run the full Playwright suite in Docker
  pw                       Alias for test-playwright
  pw-pr                    Faster subset for PRs (PROJECT_SET=pr)
  pw-verbose               Enable extra debug logs (PW_DEBUG_LOGS=1)
  pw-headed                Run with a visible browser (PW_ARGS=--headed)
  pw-ui                    Open Playwright UI mode (PW_ARGS=--ui)

Serve (webroot = ./html):
  serve                    Foreground server — Ctrl-C to stop
  serve-start              Start a detached background server
  serve-stop               Stop the background server
  serve-status             Print background server status and port

Docker:
  docker-images            Force-rebuild all Docker images
  docker-images-if-missing Build Docker images only if they do not exist locally

Utilities:
  print-<VAR>              Print any Make variable (e.g. make print-MEDIA_IMG)

Environment variables:
  PORT=8090                Port for serve and Playwright tests (default: 8080)
  NO_BUILD=1               Skip rebuilding html/ before Playwright
  PROJECT=webkit           Run a single Playwright project
  PROJECT_SET=pr           Use the PR subset from playwright.config.js (full|pr)
  PW_DEBUG_LOGS=1          Enable extra debug logs inside Playwright tests
  PW_ARGS="--grep @pr"     Extra arguments passed directly to Playwright
  ALPINE_TAG=3.23          Alpine version used for media-tools image
  NODE_TAG=25-alpine       Node version used for frontend-tools image
  PW_VERSION=1.48.2        Playwright version used for the test image
endef
export PRINT_HELP

# -------------------------------------------------
# Phony targets
# -------------------------------------------------
.PHONY: \
  help clean print-% \
  build lint lint-css \
  test sanity links htmlcheck \
  test-playwright pw pw-pr pw-verbose pw-headed pw-ui \
  serve serve-start serve-stop serve-status \
  docker-images docker-images-if-missing

help:
	@echo "$$PRINT_HELP"

print-%:
	@echo "$*=$($*)"

# -------------------------------------------------
# Stamp directory + per-concern stamp rules
# -------------------------------------------------
$(STAMP_DIR):
	@mkdir -p $@

$(SITE_STAMP): $(SITE_INPUTS) | $(STAMP_DIR)
	@./build/scripts/build-html.sh
	@touch $@

$(MEDIA_STAMP): $(MEDIA_INPUTS) | $(STAMP_DIR)
	@MEDIA_IMG=$(MEDIA_IMG) ./build/scripts/build-video.sh
	@touch $@

$(FAVICON_STAMP): $(FAVICON_INPUTS) | $(STAMP_DIR)
	@MEDIA_IMG=$(MEDIA_IMG) ./build/scripts/build-favicon.sh
	@touch $@

build: $(BUILD_DEPS)

clean:
	@rm -rf $(HTML_DIR) $(STAMP_DIR)

# -------------------------------------------------
# Docker helper macros
# -------------------------------------------------
define DOCKER_BUILD
	docker build -f $(1) $(2) -t $(3) .
endef

define DOCKER_BUILD_IF_MISSING
	@docker image inspect $(3) >/dev/null 2>&1 || $(call DOCKER_BUILD,$(1),$(2),$(3))
endef

# -------------------------------------------------
# Docker images
# -------------------------------------------------
docker-images:
	@echo "==> Rebuilding all docker images"
	@echo "    ALPINE_TAG=$(ALPINE_TAG), NODE_TAG=$(NODE_TAG), PW_VERSION=$(PW_VERSION)"
	@$(call DOCKER_BUILD,$(TOOLS_DOCKERFILE),--build-arg NODE_TAG=$(NODE_TAG),$(TOOLS_IMG))
	@$(call DOCKER_BUILD,$(HTMLCHECK_DOCKERFILE),,$(HTMLCHECK_IMG))
	@$(call DOCKER_BUILD,$(PW_DOCKERFILE),,$(PW_IMG))
	@$(call DOCKER_BUILD,$(MEDIA_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(MEDIA_IMG))

docker-images-if-missing:
	@$(call DOCKER_BUILD_IF_MISSING,$(TOOLS_DOCKERFILE),--build-arg NODE_TAG=$(NODE_TAG),$(TOOLS_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(HTMLCHECK_DOCKERFILE),,$(HTMLCHECK_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(PW_DOCKERFILE),,$(PW_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(MEDIA_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(MEDIA_IMG))

# -------------------------------------------------
# Lint (keep Makefile thin; logic belongs in scripts/containers)
# -------------------------------------------------
lint: docker-images-if-missing
	@docker run --rm -v "$$(pwd):/work" -w /work $(TOOLS_IMG) \
		eslint -c build/config/eslint.config.mjs 'assets/site/js/**/*.js' 'build/tests/**/*.js'

lint-css: docker-images-if-missing
	@docker run --rm -v "$$(pwd):/work" -w /work $(TOOLS_IMG) \
		stylelint -c build/config/stylelint.config.cjs 'assets/site/css/**/*.css'

# -------------------------------------------------
# Fast tests (depend on a complete build)
# -------------------------------------------------
sanity: $(BUILD_DEPS)
	@./build/scripts/test-sanity.sh

links: $(BUILD_DEPS)
	@./build/scripts/test-links.sh

htmlcheck: $(BUILD_DEPS)
	@./build/scripts/test-html.sh

test: sanity links htmlcheck

# -------------------------------------------------
# Playwright tests
# - Respect NO_BUILD=1 to skip rebuilds
# - All heavy logic (starting server, caching deps) is inside the script
# -------------------------------------------------
ifeq ($(NO_BUILD),1)
PW_BUILD_DEPS :=
else
PW_BUILD_DEPS := $(BUILD_DEPS)
endif

test-playwright: $(PW_BUILD_DEPS) docker-images-if-missing
	@NO_BUILD=$(NO_BUILD) \
	PORT=$(PORT) \
	PROJECT_SET=$(PROJECT_SET) \
	PROJECT=$(PROJECT) \
	PW_DEBUG_LOGS=$(PW_DEBUG_LOGS) \
	PW_ARGS='$(PW_ARGS)' \
	./build/scripts/test-playwright.sh

pw: test-playwright

pw-verbose:
	@$(MAKE) test-playwright PW_DEBUG_LOGS=1

pw-pr:
	@$(MAKE) test-playwright PROJECT_SET=pr

pw-headed:
	@$(MAKE) test-playwright PW_ARGS="--headed"

pw-ui:
	@$(MAKE) test-playwright PW_ARGS="--ui"

# -------------------------------------------------
# Serve (webroot = ./html)
# - Foreground: Ctrl-C stops, no noisy logs
# - Background: start/stop/status via scripts (recommended)
# -------------------------------------------------
serve:
	@PORT=$(PORT) ./build/scripts/serve-html.sh

serve-start:
	@PORT=$(PORT) NAME=$(SERVE_NAME) IMG=$(TOOLS_IMG) ./build/scripts/serve-start.sh

serve-stop:
	@NAME=$(SERVE_NAME) ./build/scripts/serve-stop.sh

serve-status:
	@PORT=$(PORT) NAME=$(SERVE_NAME) ./build/scripts/serve-status.sh

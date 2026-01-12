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
BUILD_STAMP   := $(STAMP_DIR)/build.ok

# If you add build inputs, the incremental stamp will rebuild automatically.
# Keep this list broad enough to avoid "why didn't it rebuild?" confusion.
BUILD_INPUTS  := \
  build/scripts/build-html.sh \
  build/scripts/build-css.sh \
  build/scripts/build-js.sh \
  build/scripts/build-video.sh \
  build/scripts/build-favicon.sh \
  build/scripts/test-sanity.sh \
  build/scripts/test-links.sh \
  build/scripts/test-html.sh \
  build/scripts/test-playwright.sh \
  $(shell find assets -type f 2>/dev/null) \
  $(shell find build/docker -type f 2>/dev/null) \
  $(shell find build/config -type f 2>/dev/null)

ifeq (strip $(BUILD_INPUTS)),)
$(warning WARNING: BUILD_INPUTS is empty — source directories missing?)
BUILD_INPUTS := $(MAKEFILE_LIST)
endif

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
GIFSICLE_IMG   ?= oepsbanaan-gifsicle:alpine
FFMPEG_IMG     ?= oepsbanaan-ffmpeg:alpine
FAVICON_IMG    ?= oepsbanaan-favicon:alpine

# Dockerfiles (single source of truth)
TOOLS_DOCKERFILE     := build/docker/Dockerfile.frontend-tools
HTMLCHECK_DOCKERFILE := build/docker/Dockerfile.htmlcheck
PW_DOCKERFILE        := build/docker/Dockerfile.playwright
GIFSICLE_DOCKERFILE := build/docker/Dockerfile.gifsicle
FFMPEG_DOCKERFILE   := build/docker/Dockerfile.ffmpeg
FAVICON_DOCKERFILE  := build/docker/Dockerfile.favicon

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
  build                     Build ./html (incremental via stamp file)
  clean                     Remove build output and stamps

Lint:
  lint                      Run ESLint on source JavaScript (requires tools image)

Fast tests (require a valid build):
  test                      Run sanity + links + HTML validation
  sanity                    Verify build output structure
  links                     Verify href/src references resolve within ./html
  htmlcheck                 Validate built HTML files

Playwright:
  test-playwright           Run Playwright tests in Docker
  pw                        Alias for test-playwright
  pw-pr                     Faster subset (PROJECT_SET=pr)
  pw-verbose                Extra debug logs (PW_DEBUG_LOGS=1)
  pw-headed                 Convenience wrapper (PW_ARGS=--headed)
  pw-ui                     Convenience wrapper (PW_ARGS=--ui)

Serve (webroot = ./html):
  serve                     Foreground server (Ctrl-C stops it)
  serve-start               Background server (detached container)
  serve-stop                Stop background server
  serve-status              Print background server status

Docker:
  docker-images             Force rebuild all Docker images
  docker-images-if-missing  Build Docker images only if they do not exist

Utilities:
  print-<VAR>               Print any Make variable (e.g. make print-PW_IMG)

Environment variables (examples):
  PORT=8090                 Use a different port for serve + tests
  NO_BUILD=0                Skip rebuilding html/ before running Playwright
  PROJECT=webkit            Run a single Playwright project
  PROJECT_SET=pr            Use subset from playwright.config.js (full|pr)
  PW_DEBUG_LOGS=1           Enable extra debug logs in Playwright tests
  PW_ARGS="--grep @pr"      Extra args passed to Playwright
endef
export PRINT_HELP

# -------------------------------------------------
# Phony targets
# -------------------------------------------------
.PHONY: \
  help clean print-% \
  build lint \
  test sanity links htmlcheck \
  test-playwright pw pw-pr pw-verbose pw-headed pw-ui \
  serve serve-start serve-stop serve-status \
  docker-images docker-images-if-missing

help:
	@echo "$$PRINT_HELP"

print-%:
	@echo "$*=$($*)"

# -------------------------------------------------
# Directories / stamp file (incremental build)
# -------------------------------------------------
$(STAMP_DIR):
	@mkdir -p $@

$(BUILD_STAMP): $(BUILD_INPUTS) | $(STAMP_DIR)
	@./build/scripts/build-html.sh
	@touch $@

build: $(BUILD_STAMP)

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
	@$(call DOCKER_BUILD,$(GIFSICLE_DOCKERFILE),,$(GIFSICLE_IMG))
	@$(call DOCKER_BUILD,$(FFMPEG_DOCKERFILE),,$(FFMPEG_IMG))
	@$(call DOCKER_BUILD,$(FAVICON_DOCKERFILE),,$(FAVICON_IMG))

docker-images-if-missing:
	@$(call DOCKER_BUILD_IF_MISSING,$(TOOLS_DOCKERFILE),--build-arg NODE_TAG=$(NODE_TAG),$(TOOLS_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(HTMLCHECK_DOCKERFILE),,$(HTMLCHECK_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(PW_DOCKERFILE),,$(PW_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(GIFSICLE_DOCKERFILE),,$(GIFSICLE_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(FFMPEG_DOCKERFILE),,$(FFMPEG_IMG))
	@$(call DOCKER_BUILD_IF_MISSING,$(FAVICON_DOCKERFILE),,$(FAVICON_IMG))

# -------------------------------------------------
# Lint (keep Makefile thin; logic belongs in scripts/containers)
# -------------------------------------------------
lint: docker-images-if-missing
	@docker run --rm -v "$$(pwd):/work" -w /work $(TOOLS_IMG) \
		eslint -c build/config/eslint.config.mjs 'assets/site/js/**/*.js'

# -------------------------------------------------
# Fast tests (depend on build stamp)
# -------------------------------------------------
sanity: $(BUILD_STAMP)
	@./build/scripts/test-sanity.sh

links: $(BUILD_STAMP)
	@./build/scripts/test-links.sh

htmlcheck: $(BUILD_STAMP)
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
PW_BUILD_DEPS := $(BUILD_STAMP)
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

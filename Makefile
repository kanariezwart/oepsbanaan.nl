SHELL := /bin/bash
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:

# -------------------------------------------------
# Paths
# -------------------------------------------------
HTML_DIR := html
STAMP_DIR := .stamps
BUILD_STAMP := $(STAMP_DIR)/build.ok

# -------------------------------------------------
# Docker images
# -------------------------------------------------
ALPINE_TAG ?= 3.23
NODE_TAG ?= 25-alpine
PW_VERSION ?= 1.48.2
PW_DISTRO  ?= noble

TOOLS_IMG := oepsbanaan-tools:node
TOOLS_DOCKERFILE := build/docker/Dockerfile.frontend-tools

GIFSICLE_IMG := oepsbanaan-gifsicle:alpine
GIFSICLE_DOCKERFILE := build/docker/Dockerfile.gifsicle

FFMPEG_IMG := oepsbanaan-ffmpeg:alpine
FFMPEG_DOCKERFILE := build/docker/Dockerfile.ffmpeg

FAVICON_IMG := oepsbanaan-favicon:alpine
FAVICON_DOCKERFILE := build/docker/Dockerfile.favicon

HTMLCHECK_IMG := oepsbanaan-htmlcheck:latest
HTMLCHECK_DOCKERFILE := build/docker/Dockerfile.htmlcheck

PW_IMG := oepsbanaan-playwright:$(PW_VERSION)
PW_DOCKERFILE := build/docker/Dockerfile.playwright

# -------------------------------------------------
# Build inputs (IMPORTANT)
# Only files that actually affect the build output.
# Do NOT include test artifacts or node_modules.
# -------------------------------------------------
BUILD_INPUTS := \
  $(shell find assets -type f 2>/dev/null) \
  $(shell find build/scripts -type f 2>/dev/null) \
  $(shell find build/docker -type f 2>/dev/null) \
  $(shell find build/config -type f 2>/dev/null)

# -------------------------------------------------
# Defaults for env-vars (can be overridden)
# -------------------------------------------------
PORT ?= 8080
PROJECT ?=
PROJECT_SET ?= full
NO_BUILD ?= 0
PW_DEBUG_LOGS ?=
PW_ARGS ?=

# -------------------------------------------------
# Help text
# -------------------------------------------------
define PRINT_HELP
Usage:
  make <target>

Build targets:
  build                     Build the webroot into ./html (only if inputs changed).
  clean                     Remove build output and stamps (forces rebuild next time).
  lint                      Run ESLint on source JavaScript.

Test targets:
  test                      Run fast tests (sanity, links, HTML validation).
  pw                        Run Playwright tests (alias for test-playwright).
  pw-pr                     Faster subset (PROJECT_SET=pr).
  pw-verbose                Extra debug logs (PW_DEBUG_LOGS=1).
  pw-headed                 Convenience wrapper (PW_ARGS=--headed).
  pw-ui                     Convenience wrapper (PW_ARGS=--ui).

Docker targets:
  docker-images             Rebuild all Docker images (forces rebuild).
  docker-images-if-missing  Build Docker images only if they do not exist.

Utilities:
  print-<VAR>               Print any Make variable (e.g. make print-PW_IMG).

Environment variables:
  NO_BUILD=1                Skip rebuilding html/ before running tests.
  PORT=8080                 Port for the local http-server inside the Playwright container.
  PROJECT=webkit            Run a single Playwright project.
  PROJECT_SET=pr            Use subset from playwright.config.js (full|pr).
  PW_DEBUG_LOGS=1           Enable extra debug logging in Playwright tests.
  PW_ARGS="--grep @pr"      Extra args passed to Playwright (requires tiny script change).
endef
export PRINT_HELP

# -------------------------------------------------
# Phony targets
# -------------------------------------------------
.PHONY: help build clean lint test sanity links htmlcheck \
        docker-images docker-images-if-missing \
        test-playwright pw pw-pr pw-verbose pw-headed pw-ui \
        print-%

# -------------------------------------------------
# Help
# -------------------------------------------------
help:
	@echo "$$PRINT_HELP"

print-%:
	@echo "$*=$($*)"

# -------------------------------------------------
# Directories
# -------------------------------------------------
$(STAMP_DIR):
	@mkdir -p $@

# -------------------------------------------------
# Incremental build using a stamp file
# -------------------------------------------------
$(BUILD_STAMP): $(BUILD_INPUTS) | $(STAMP_DIR)
	./build/scripts/build-html.sh
	@touch $@

build: $(BUILD_STAMP)
	
lint: docker-images-if-missing
	docker run --rm -v "$$(pwd):/work" -w /work $(TOOLS_IMG) \
		eslint -c build/config/eslint.config.mjs 'assets/site/js/**/*.js'

# -------------------------------------------------
# Fast tests (require a valid build)
# -------------------------------------------------
sanity: $(BUILD_STAMP)
	./build/scripts/test-sanity.sh

links: $(BUILD_STAMP)
	./build/scripts/test-links.sh

htmlcheck: $(BUILD_STAMP)
	./build/scripts/test-html.sh

test: sanity links htmlcheck

# -------------------------------------------------
# Docker helpers (macro)
# -------------------------------------------------
define DOCKER_BUILD
	docker build -f $(1) $(2) -t $(3) .
endef

define DOCKER_BUILD_IF_MISSING
	@docker image inspect $(3) >/dev/null 2>&1 || $(call DOCKER_BUILD,$(1),$(2),$(3))
endef

# Rebuild all tooling images (useful after editing Dockerfiles)
docker-images:
	@echo "==> Rebuilding docker images (ALPINE_TAG=$(ALPINE_TAG), NODE_TAG=$(NODE_TAG), PW_VERSION=$(PW_VERSION))"
	$(call DOCKER_BUILD,$(TOOLS_DOCKERFILE),--build-arg NODE_TAG=$(NODE_TAG),$(TOOLS_IMG))
	$(call DOCKER_BUILD,$(GIFSICLE_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(GIFSICLE_IMG))
	$(call DOCKER_BUILD,$(FFMPEG_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(FFMPEG_IMG))
	$(call DOCKER_BUILD,$(FAVICON_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(FAVICON_IMG))
	$(call DOCKER_BUILD,$(HTMLCHECK_DOCKERFILE),,$(HTMLCHECK_IMG))
	$(call DOCKER_BUILD,$(PW_DOCKERFILE),,$(PW_IMG))

# Only build images if missing (fast path for CI or first-time setup)
docker-images-if-missing:
	$(call DOCKER_BUILD_IF_MISSING,$(TOOLS_DOCKERFILE),--build-arg NODE_TAG=$(NODE_TAG),$(TOOLS_IMG))
	$(call DOCKER_BUILD_IF_MISSING,$(GIFSICLE_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(GIFSICLE_IMG))
	$(call DOCKER_BUILD_IF_MISSING,$(FFMPEG_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(FFMPEG_IMG))
	$(call DOCKER_BUILD_IF_MISSING,$(FAVICON_DOCKERFILE),--build-arg ALPINE_TAG=$(ALPINE_TAG),$(FAVICON_IMG))
	$(call DOCKER_BUILD_IF_MISSING,$(HTMLCHECK_DOCKERFILE),,$(HTMLCHECK_IMG))
	$(call DOCKER_BUILD_IF_MISSING,$(PW_DOCKERFILE),,$(PW_IMG))

# -------------------------------------------------
# Playwright tests
# The build is NOT re-run unless inputs changed (or NO_BUILD=1)
# -------------------------------------------------
ifeq ($(NO_BUILD),1)
PW_BUILD_DEPS :=
else
PW_BUILD_DEPS := $(BUILD_STAMP)
endif

test-playwright: $(PW_BUILD_DEPS) docker-images-if-missing
	NO_BUILD=$(NO_BUILD) PORT=$(PORT) PROJECT=$(PROJECT) PROJECT_SET=$(PROJECT_SET) PW_DEBUG_LOGS=$(PW_DEBUG_LOGS) PW_ARGS='$(PW_ARGS)' ./build/scripts/test-playwright.sh

# Convenience aliases
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
# Cleanup
# -------------------------------------------------
clean:
	rm -rf $(HTML_DIR) $(STAMP_DIR)

SHELL := /bin/bash
.DEFAULT_GOAL := help

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

PW_IMG     := oepsbanaan-playwright:$(PW_VERSION)
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

# -------------------------------------------------
# Help text
# -------------------------------------------------
define PRINT_HELP
Usage:
  make <target>

Build targets:
  build                     Build the webroot into ./html (only if inputs changed).
  clean                     Remove build output and stamps (forces rebuild next time).

Test targets:
  test                      Run fast tests (sanity, links, HTML validation).
  test-playwright           Run Playwright tests (multi-browser) using Docker.
  test-playwright-pr        Run a faster PR subset (PROJECT_SET=pr).
  test-playwright-verbose   Same as test-playwright, with extra debug output.

Utility targets:
  docker-images             Build required Docker images if missing.
  help                      Show this help.

Environment variables:
  NO_BUILD=1                Skip rebuilding html/ before running tests.
  PORT=8080                 Port for the local http-server inside the Playwright container.
  PROJECT=webkit            Run a single Playwright project
                           (chromium | firefox | webkit | pixel-5 | iphone-13 | iphone-13-landscape).
  PROJECT_SET=pr            Use the faster project subset defined in playwright.config.js
                           (full | pr). Default: full.
  PW_DEBUG_LOGS=1           Enable extra debug logging in Playwright tests.
endef
export PRINT_HELP

# -------------------------------------------------
# Phony targets
# -------------------------------------------------
.PHONY: help build clean test sanity links htmlcheck \
        test-playwright test-playwright-pr test-playwright-verbose docker-images

# -------------------------------------------------
# Help
# -------------------------------------------------
help:
	@echo "$$PRINT_HELP"

# -------------------------------------------------
# Incremental build using a stamp file
# -------------------------------------------------
$(BUILD_STAMP): $(BUILD_INPUTS)
	@mkdir -p $(STAMP_DIR)
	./build/scripts/build-html.sh
	@touch $@

build: $(BUILD_STAMP)

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
# Docker images
# -------------------------------------------------
.PHONY: docker-images docker-images-if-missing

# Rebuild all tooling images (useful after editing Dockerfiles)
docker-images:
	@echo "==> Rebuilding docker images (ALPINE_TAG=$(ALPINE_TAG), NODE_TAG=$(NODE_TAG))"
	docker build -f $(TOOLS_DOCKERFILE)   --build-arg NODE_TAG=$(NODE_TAG)     -t $(TOOLS_IMG) .
	docker build -f $(GIFSICLE_DOCKERFILE) --build-arg ALPINE_TAG=$(ALPINE_TAG) -t $(GIFSICLE_IMG) .
	docker build -f $(FFMPEG_DOCKERFILE)   --build-arg ALPINE_TAG=$(ALPINE_TAG) -t $(FFMPEG_IMG) .
	docker build -f $(FAVICON_DOCKERFILE)  --build-arg ALPINE_TAG=$(ALPINE_TAG) -t $(FAVICON_IMG) .
	docker build -f $(HTMLCHECK_DOCKERFILE)                                  -t $(HTMLCHECK_IMG) .
	docker build -f $(PW_DOCKERFILE)                                         -t $(PW_IMG) .

# Only build images if missing (fast path for CI or first-time setup)
docker-images-if-missing:
	@docker image inspect $(TOOLS_IMG) >/dev/null 2>&1 || docker build -f $(TOOLS_DOCKERFILE) --build-arg NODE_TAG=$(NODE_TAG) -t $(TOOLS_IMG) .
	@docker image inspect $(GIFSICLE_IMG) >/dev/null 2>&1 || docker build -f $(GIFSICLE_DOCKERFILE) --build-arg ALPINE_TAG=$(ALPINE_TAG) -t $(GIFSICLE_IMG) .
	@docker image inspect $(FFMPEG_IMG) >/dev/null 2>&1 || docker build -f $(FFMPEG_DOCKERFILE) --build-arg ALPINE_TAG=$(ALPINE_TAG) -t $(FFMPEG_IMG) .
	@docker image inspect $(FAVICON_IMG) >/dev/null 2>&1 || docker build -f $(FAVICON_DOCKERFILE) --build-arg ALPINE_TAG=$(ALPINE_TAG) -t $(FAVICON_IMG) .
	@docker image inspect $(HTMLCHECK_IMG) >/dev/null 2>&1 || docker build -f $(HTMLCHECK_DOCKERFILE) -t $(HTMLCHECK_IMG) .
	@docker image inspect $(PW_IMG) >/dev/null 2>&1 || docker build -f $(PW_DOCKERFILE) -t $(PW_IMG) .

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
	NO_BUILD=$(NO_BUILD) PORT=$(PORT) PROJECT=$(PROJECT) PROJECT_SET=$(PROJECT_SET) ./build/scripts/test-playwright.sh

test-playwright-verbose: $(PW_BUILD_DEPS) docker-images-if-missing
	PW_DEBUG_LOGS=1 NO_BUILD=$(NO_BUILD) PORT=$(PORT) PROJECT=$(PROJECT) PROJECT_SET=$(PROJECT_SET) ./build/scripts/test-playwright.sh

test-playwright-pr: PROJECT_SET=pr
test-playwright-pr: test-playwright

# -------------------------------------------------
# Cleanup
# -------------------------------------------------
clean:
	rm -rf $(HTML_DIR) $(STAMP_DIR)

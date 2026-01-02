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
PW_IMG := oepsbanaan-playwright:1.48.2
PW_DOCKERFILE := build/docker/Dockerfile.playwright

# -------------------------------------------------
# Build inputs (IMPORTANT)
# Only files that actually affect the build output.
# Do NOT include test artifacts or node_modules.
# -------------------------------------------------
BUILD_INPUTS := \
  $(shell find assets -type f 2>/dev/null) \
  $(shell find build/scripts -type f 2>/dev/null) \
  $(shell find build/docker -type f 2>/dev/null)

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
  test-playwright-verbose   Same as test-playwright, with extra debug output.

Utility targets:
  docker-images             Build required Docker images if missing.
  help                      Show this help.

Environment variables:
  PW_DEBUG_LOGS=1           Enable extra debug logging in Playwright tests.
  PROJECT=webkit            Run a single Playwright project
                           (chromium | firefox | webkit | iphone-13).
endef
export PRINT_HELP

# -------------------------------------------------
# Phony targets
# -------------------------------------------------
.PHONY: help build clean test sanity links htmlcheck \
        test-playwright test-playwright-verbose docker-images

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
docker-images:
	@docker image inspect $(PW_IMG) >/dev/null 2>&1 || \
	  docker build -f $(PW_DOCKERFILE) -t $(PW_IMG) .

# -------------------------------------------------
# Playwright tests
# The build is NOT re-run unless inputs changed.
# -------------------------------------------------

ifeq ($(NO_BUILD),1)
PW_BUILD_DEPS :=
else
PW_BUILD_DEPS := $(BUILD_STAMP)
endif

test-playwright: $(PW_BUILD_DEPS) docker-images
	NO_BUILD=$(NO_BUILD) PROJECT=$(PROJECT) ./build/scripts/test-playwright.sh

test-playwright-verbose: $(PW_BUILD_DEPS) docker-images
	PW_DEBUG_LOGS=1 NO_BUILD=$(NO_BUILD) PROJECT=$(PROJECT) ./build/scripts/test-playwright.sh

# -------------------------------------------------
# Cleanup
# -------------------------------------------------
clean:
	rm -rf $(HTML_DIR) $(STAMP_DIR)

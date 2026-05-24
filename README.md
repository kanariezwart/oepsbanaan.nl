# oepsbanaan.nl

A small static website with a fully Docker-based build and test pipeline.

The project focuses on:
- Optimized media delivery (WebM → MP4 → GIF fallback)
- Zero local tooling requirements (everything runs in Docker)
- Incremental builds via `make` — only changed parts rebuild
- Browser-level smoke testing using Playwright

---

## Repository structure

```
assets/
  site/
    css/              # Source CSS
    js/               # Source JavaScript
    index.html        # Source HTML template
  img/                # Source GIFs (1.gif .. N.gif)
  favicons/           # Favicon source image (svg/png/jpg)

build/
  config/             # ESLint and stylelint configuration
  docker/             # Dockerfiles for build and test tooling
  scripts/            # Build, test, and serve scripts
  tests/              # Playwright tests, helpers, and config

html/                 # Generated webroot (build output, gitignored)
```

`html/` is the only directory that needs to be deployed.

---

## Requirements

- Docker (with BuildKit)
- GNU Make

No local Node.js, npm, ffmpeg, gifsicle, or Playwright installation is required.

---

## Docker images

The build uses four Docker images, all built locally:

| Image                   | Based on                     | Purpose                                           |
|-------------------------|------------------------------|---------------------------------------------------|
| `oepsbanaan-tools`      | Node Alpine                  | ESLint, stylelint, terser, csso, http-server      |
| `oepsbanaan-media`      | Alpine                       | gifsicle, ffmpeg, imagemagick (GIF/video/favicon) |
| `oepsbanaan-htmlcheck`  | Eclipse Temurin JRE          | Nu HTML Checker (vnu.jar)                         |
| `oepsbanaan-playwright` | mcr.microsoft.com/playwright | Playwright test runner                            |

Build all images (first time or after a Dockerfile change):
```
make docker-images
```

---

## Incremental build

`make build` runs three independent stamp-based steps. Each step only rebuilds when its own inputs change:

| Stamp        | Rebuilds when                                                  | Output                                     |
|--------------|----------------------------------------------------------------|--------------------------------------------|
| `site.ok`    | `assets/site/**`, CSS/JS configs, or GIF count changes         | `html/index.html`, `html/css/`, `html/js/` |
| `media.ok`   | `assets/img/*.gif` or `Dockerfile.media-tools` changes         | `html/img/` (optimized GIFs, WebM, MP4)    |
| `favicon.ok` | `assets/favicons/source.*` or `Dockerfile.media-tools` changes | `html/favicons/`, `html/favicon.ico`       |

A CSS change rebuilds only `site.ok` (seconds). A GIF change rebuilds `site.ok` (data-banana count) and `media.ok` (video conversion). `make clean` resets everything.

---

## Quick start

### Build the site
```
make build
```

### Lint
```
make lint        # ESLint on site JS and test files
make lint-css    # stylelint on site CSS
```

### Run fast tests
```
make test
```

### Serve locally
```
make serve              # Foreground — Ctrl-C to stop
make serve-start        # Detached background container
make serve-status       # Check if the background server is running
make serve-stop         # Stop the background server
```

### Run Playwright tests
```
make pw                 # Full suite
make pw-pr              # Fast PR subset
make pw-verbose         # Extra debug logging
make pw-headed          # Visible browser
make pw-ui              # Playwright UI mode
```

### Skip rebuilding before Playwright
```
NO_BUILD=1 make pw
```

### Run a single browser
```
PROJECT=webkit make pw
```

---

## Environment variables

| Variable        | Default     | Description                                                 |
|-----------------|-------------|-------------------------------------------------------------|
| `PORT`          | `8080`      | Port for `serve` and Playwright tests                       |
| `NO_BUILD`      | `0`         | Set to `1` to skip rebuilding before Playwright             |
| `PROJECT`       | _(all)_     | Run a single Playwright project (e.g. `webkit`, `chromium`) |
| `PROJECT_SET`   | `full`      | Playwright project set: `full` or `pr`                      |
| `PW_DEBUG_LOGS` | _(off)_     | Set to `1` for extra debug logs in tests                    |
| `PW_ARGS`       | _(none)_    | Extra arguments passed directly to Playwright               |
| `ALPINE_TAG`    | `3.23`      | Alpine version for the media-tools image                    |
| `NODE_TAG`      | `25-alpine` | Node version for the frontend-tools image                   |
| `PW_VERSION`    | `1.48.2`    | Playwright version for the test image                       |

---

## Deployment

The output is a static webroot in `html/`.

Example:
```
rsync -av --delete html/ user@server:/var/www/oepsbanaan.nl/
```

---

## License

MIT

# oepsbanaan.nl

A small static website with a fully Docker-based build and test pipeline.

The project focuses on:
- Optimized media delivery (WebM → MP4 → GIF fallback)
- Zero local tooling requirements (everything runs in Docker)
- Incremental builds via `make`
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
  favicons/           # Favicon source (svg/png/jpg)

build/
  docker/             # Dockerfiles for build/test tooling
  scripts/            # Build & test scripts
  tests/              # Playwright tests and config

html/                 # Generated webroot (build output)
```

`html/` is the only directory that needs to be deployed.

---

## Requirements

- Docker (with BuildKit)
- GNU Make

No local Node.js, npm, ffmpeg, gifsicle, or Playwright installation is required.

---

## Quick start

### Build the site
```
make build
```

### Run fast tests
```
make test
```

### Run Playwright smoke tests
```
make pw
```

### Verbose Playwright run
```
make pw-verbose
```

### Run Playwright UI mode
```
make pw-ui
```

### Run Playwright in headed mode
```
make pw-headed
```

### Skip rebuilding
```
NO_BUILD=1 make pw
```

### Run a single browser
```
PROJECT=webkit make pw
```

---

## Environment Variables

- `NO_BUILD=1`: Skip rebuilding `html/` before running tests.
- `PORT=8080`: Port for the local http-server inside the Playwright container.
- `PROJECT=webkit`: Run a single Playwright project (e.g., `chromium`, `firefox`, `webkit`).
- `PROJECT_SET=pr`: Use subset from `playwright.config.js` (`full`|`pr`).
- `PW_DEBUG_LOGS=1`: Enable extra debug logging in Playwright tests.
- `PW_ARGS`: Extra arguments passed to Playwright (e.g., `PW_ARGS="--grep @pr"`).

---

## Linting

To run ESLint on the source JavaScript:
```
make lint
```

---

## Deployment

The output is a static webroot in `html/`.

Example:
```
rsync -av --delete html/ user@server:/var/www/oepsbanaan.nl/
rsync -av --delete html/ user@server:/var/www/oepsbanaan.nl/html
```

---

## License

MIT

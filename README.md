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
make test-playwright
```

### Verbose Playwright run
```
make test-playwright-verbose
```

### Skip rebuilding
```
NO_BUILD=1 make test-playwright
```

### Run a single browser
```
PROJECT=webkit make test-playwright
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

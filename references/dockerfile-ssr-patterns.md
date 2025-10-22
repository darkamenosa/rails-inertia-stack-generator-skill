# Dockerfile SSR Modifications

For Inertia SSR to work, you need Node.js in production. That's it. Two simple additions to the standard Rails 8 Dockerfile.

## Required Changes

### 1. Install Node.js in Base Stage

Add after installing base packages, BEFORE bundler installation:

```dockerfile
# Install JavaScript runtime (prebuilt Node per-arch)
ARG NODE_VERSION=25.0.0
ARG TARGETARCH
ENV PATH=/usr/local/node/bin:$PATH
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y xz-utils && \
    case "${TARGETARCH}" in \
      amd64) NODEARCH=x64 ;; \
      arm64) NODEARCH=arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac && \
    mkdir -p /usr/local/node && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODEARCH}.tar.xz" | \
      tar -xJ -C /usr/local/node --strip-components=1 && \
    /usr/local/node/bin/node -v && \
    /usr/local/node/bin/npm -v && \
    apt-get purge -y --auto-remove xz-utils && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

**Why:**
- Downloads prebuilt binaries (fast, no compilation)
- Supports multi-arch (amd64/arm64)
- Installing in base stage means it's in final stage automatically

### 2. Lock Bundler Version

Add AFTER Node.js installation, BEFORE "Set production environment":

```dockerfile
# Ensure the Bundler version matches Gemfile.lock to avoid per-build upgrades.
RUN gem install bundler -v 2.7.2 -N
```

**Important:** Check `Gemfile.lock` bottom for version:
```bash
tail Gemfile.lock
# BUNDLED WITH
#    2.7.2
```

Update `-v 2.7.2` to match your lock file.

## That's All!

- **Build stage**: No changes needed (Vite Ruby handles npm install)
- **Final stage**: No changes needed (Node.js from base is already there)

## Common Mistakes

❌ Installing Node.js only in build stage - gets discarded
❌ Running npm ci separately - Vite Ruby does it
❌ Not locking bundler version - breaks caching
✅ Just add Node.js + bundler to base stage - done!

## Verify

```bash
docker build -t myapp .
docker run --rm myapp node --version
```

Should output: `v25.0.0`

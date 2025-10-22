# Dockerfile SSR Patterns for Inertia Rails

## Core Pattern: Node.js in Production

The critical requirement for Inertia SSR is keeping Node.js in the production image. The blog's approach uses `node-build` to install Node.js in the base stage.

## Base Stage Modifications

### 1. Install Node.js (applies to all databases)

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

**Why this approach:**
- Downloads prebuilt Node.js binaries directly from nodejs.org (faster than compiling from source)
- Uses Docker's `TARGETARCH` to automatically select the correct architecture (amd64/arm64)
- Supports multi-architecture builds for both Intel/AMD and Apple Silicon
- Installing in base stage means Node.js is automatically copied to the final stage (since final stage uses `FROM base`)

### 2. Install Bundler with Locked Version

Add AFTER Node.js installation, BEFORE "Set production environment":

```dockerfile
# Ensure the Bundler version matches Gemfile.lock to avoid per-build upgrades.
RUN gem install bundler -v 2.7.2 -N
```

**Important:**
- Check your `Gemfile.lock` for the BUNDLED WITH version at the bottom
- Update the version number to match (e.g., if lock shows 2.5.4, use `-v 2.5.4`)
- This prevents bundler upgrades during builds that can break caching
- The `-N` flag skips documentation installation for smaller image size

**How to find your bundler version:**
```bash
# Check Gemfile.lock bottom section
tail Gemfile.lock

# Output should show something like:
# BUNDLED WITH
#    2.7.2
```

## Build Stage Modifications

**No npm installation needed!** Vite Ruby automatically installs node modules during `assets:precompile`.

This change simplifies the build process and avoids running npm twice.

## Database-Specific Configurations

### PostgreSQL

**Base stage** - Install PostgreSQL client:
```dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 libvips postgresql-client && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

**Build stage** - Install PostgreSQL development libraries:
```dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libpq-dev libyaml-dev pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

### MySQL

**Base stage** - Install MySQL client:
```dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 libvips default-mysql-client && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

**Build stage** - Install MySQL development libraries:
```dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libmysqlclient-dev libyaml-dev pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

### SQLite

**Base stage** - No database client needed:
```dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 libvips && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

**Build stage** - No additional database libraries:
```dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

## Final Stage

**No changes needed!** Node.js is already present from the base image.

The final stage remains:
```dockerfile
FROM base

# Copy built artifacts: gems, application
COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

# ... rest of final stage unchanged
```

## Common Mistakes

❌ **Installing Node.js only in build stage** - Gets discarded
❌ **Using apt install nodejs** - Version mismatch issues
❌ **Removing Node.js after asset compilation** - Breaks SSR
❌ **Running npm ci separately in build stage** - Vite Ruby handles it
❌ **Not locking bundler version** - Causes cache invalidation on every build
✅ **Using prebuilt Node.js binaries in base stage** - Fast, multi-arch support, persistent across stages
✅ **Locking bundler to match Gemfile.lock** - Prevents unnecessary rebuilds

## Verification

After building the Docker image, verify Node.js is present:

```bash
docker build -t myapp .
docker run --rm myapp node --version
```

Should output the Node.js version (e.g., `v25.0.0`).

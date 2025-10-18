# Dockerfile SSR Patterns for Inertia Rails

## Core Pattern: Node.js in Production

The critical requirement for Inertia SSR is keeping Node.js in the production image. The blog's approach uses `node-build` to install Node.js in the base stage.

## Base Stage Modifications

### Install Node.js (applies to all databases)

Add after installing base packages, BEFORE "Set production environment":

```dockerfile
# Install JavaScript dependencies
ARG NODE_VERSION=22.13.1
ENV PATH=/usr/local/node/bin:$PATH
RUN curl -sL https://github.com/nodenv/node-build/archive/master.tar.gz | tar xz -C /tmp/ && \
    /tmp/node-build-master/bin/node-build "${NODE_VERSION}" /usr/local/node && \
    rm -rf /tmp/node-build-master
```

**Why this location:** Installing in base stage means Node.js is automatically copied to the final stage (since final stage uses `FROM base`).

## Build Stage Modifications

### Install npm Dependencies

Add after installing gems, BEFORE "Copy application code":

```dockerfile
# Install node modules
COPY package.json package-lock.json ./
RUN npm ci && \
    rm -rf ~/.npm
```

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
✅ **Using node-build in base stage** - Persistent across stages

## Verification

After building the Docker image, verify Node.js is present:

```bash
docker build -t myapp .
docker run --rm myapp node --version
```

Should output the Node.js version (e.g., `v22.13.1`).

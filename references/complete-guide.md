# Complete Inertia Rails + ShadcnUI + TypeScript + SSR Implementation Guide

## Overview

This guide documents the complete, production-ready setup for an Inertia.js Rails application with:
- **Rails 8+** with PostgreSQL/MySQL/SQLite
- **Inertia.js** for SPA-like experience
- **React + TypeScript** frontend
- **Vite Ruby** for modern asset pipeline
- **Server-Side Rendering (SSR)** for SEO and performance
- **Tailwind CSS v4** for styling
- **ShadcnUI** component library
- **Kamal** deployment to any server

---

## Part 1: Rails Project Initialization

### Step 1.1: Create New Rails Project

**PostgreSQL (Recommended for Production):**
```bash
rails new PROJECT_NAME -d postgresql --skip-javascript
```

**MySQL:**
```bash
rails new PROJECT_NAME -d mysql --skip-javascript
```

**SQLite (Development/Small Apps):**
```bash
rails new PROJECT_NAME --skip-javascript
# SQLite is the default database
```

**What Gets Created:**
- Rails 8+ application structure
- `Dockerfile` (standard, needs SSR modifications)
- `config/deploy.yml` (Kamal configuration)
- `.kamal/secrets` (environment variables template)
- `bin/dev` (process manager for development)

---

### Step 1.2: Add Inertia Rails

```bash
cd PROJECT_NAME
bundle add inertia_rails
```

---

### Step 1.3: Install Inertia Frontend Stack

**CRITICAL: Use `--no-interactive` to avoid prompts**

```bash
bin/rails generate inertia:install \
  --framework=react \
  --typescript \
  --vite \
  --tailwind \
  --no-interactive
```

**When prompted about `bin/dev` conflict, choose `Y` to overwrite.**

**What This Does:**
1. Installs `vite_rails` gem
2. Adds TypeScript packages
3. Installs Tailwind CSS v4
4. Installs Inertia.js + React
5. Creates `app/frontend/` structure
6. Generates `vite.config.ts`
7. Creates `config/vite.json`
8. Adds example route: `/inertia-example`

**Key Files Created:**
- `app/frontend/entrypoints/inertia.ts` - Client entry
- `app/frontend/entrypoints/application.css` - Tailwind
- `app/frontend/pages/InertiaExample.tsx` - Example page
- `config/initializers/inertia_rails.rb` - Inertia config
- `vite.config.ts` - Vite configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`

---

### Step 1.4: Database Setup

```bash
bin/rails db:setup
bin/rails db:migrate
```

---

### Step 1.5: Fix Development Configuration

**Fix 1: Procfile.dev (Rails on port 3000)**

```diff
- vite: bin/vite dev
- web: bin/rails s
+ web: bin/rails s
+ vite: bin/vite dev
```

**Why:** First process gets port 3000. Swapping order ensures Rails runs on port 3000.

---

**Fix 2: config/vite.json (Allow 127.0.0.1)**

```json
{
  "development": {
    "autoBuild": true,
    "publicOutputDir": "vite-dev",
    "port": 3036,
    "host": "127.0.0.1"  // ← Add this line
  }
}
```

**Why:** Prevents "failed to connect to Vite dev server" when accessing via `127.0.0.1`.

---

## Part 2: ShadcnUI Setup

### Step 2.1: Configure TypeScript for ShadcnUI

**CRITICAL: Must update BOTH files**

**tsconfig.app.json:**
```json
{
  "compilerOptions": {
    // ... existing config ...

    /* ShadcnUI */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./app/frontend/*"]
    }
  }
}
```

**tsconfig.json:**
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],

  /* Required for shadcn-ui/ui */
  "compilerOptions": {
    "baseUrl": "./app/frontend",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

### Step 2.2: Configure Vite Path Aliases

**vite.config.ts:**
```typescript
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig } from 'vite'
import RubyPlugin from 'vite-plugin-ruby'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    RubyPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app/frontend'),
    },
  },
})
```

---

### Step 2.3: Initialize ShadcnUI

**CRITICAL: Use `--defaults --yes` to avoid prompts**

```bash
npx shadcn@latest init --defaults --yes
npx shadcn@latest add button --yes --overwrite
```

**What Gets Created:**
- `components.json` - ShadcnUI configuration
- `app/frontend/lib/utils.ts` - Utility functions
- `app/frontend/components/ui/button.tsx` - Button component
- Updates `application.css` with CSS variables

---

## Part 3: Server-Side Rendering (SSR) Setup

### Step 3.1: Create SSR Entry Point

**Create: `app/frontend/ssr/ssr.tsx`**

```typescript
import { createInertiaApp } from '@inertiajs/react'
import createServer from '@inertiajs/react/server'
import ReactDOMServer from 'react-dom/server'

createServer((page) =>
  createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      return pages[`../pages/${name}.tsx`]
    },
    setup: ({ App, props }) => <App {...props} />,
  }),
)
```

---

### Step 3.2: Enable Client-Side Hydration

**Edit: `app/frontend/entrypoints/inertia.ts`**

```typescript
import { createInertiaApp } from '@inertiajs/react'
import { createElement, ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'  // ← Add hydrateRoot

// ... type definitions ...

createInertiaApp({
  resolve: (name) => { /* ... */ },

  setup({ el, App, props }) {
    if (el) {
      // ← SSR hydration in production, normal render in development
      if (import.meta.env.MODE === "production") {
        hydrateRoot(el, createElement(App, props))
      } else {
        createRoot(el).render(createElement(App, props))
      }
    } else {
      console.error('Missing root element...')
    }
  },
})
```

**Why This Pattern:**
- **Production:** `hydrateRoot` attaches React to server-rendered HTML
- **Development:** `createRoot` for faster dev experience without SSR

---

### Step 3.3: Enable SSR in Vite Configuration

**Edit: `config/vite.json`**

```json
{
  "all": {
    "sourceCodeDir": "app/frontend",
    "watchAdditionalPaths": []
  },
  "production": {
    "ssrBuildEnabled": true  // ← Enable SSR builds
  },
  "development": {
    "autoBuild": true,
    "publicOutputDir": "vite-dev",
    "port": 3036,
    "host": "127.0.0.1"
  },
  "test": {
    "autoBuild": true,
    "publicOutputDir": "vite-test",
    "port": 3037
  }
}
```

---

### Step 3.4: Enable SSR in Inertia Rails

**Edit: `config/initializers/inertia_rails.rb`**

```ruby
InertiaRails.configure do |config|
  config.version = ViteRuby.digest
  config.encrypt_history = true
  config.always_include_errors_hash = true
  config.ssr_enabled = ViteRuby.config.ssr_build_enabled  # ← Enable SSR
end
```

---

### Step 3.5: Test SSR Build

```bash
export RAILS_ENV=production
./bin/rails assets:precompile
```

**Expected Output:**
```
Building with Vite ⚡️
vite v7.x.x building for production...
✓ built in XXXms

Building with Vite ⚡️
vite v7.x.x building SSR bundle for production...
✓ built in XXms
```

**Verify:**
```bash
ls public/vite-ssr/ssr.js  # SSR bundle should exist
```

**IMPORTANT:** `rails assets:precompile` handles BOTH client and SSR builds. Do NOT run `bin/vite build --ssr` separately.

---

## Part 4: Dockerfile for SSR

### Key Changes from Standard Rails 8 Dockerfile

**Two critical modifications:**
1. **Install Node.js in base stage** using prebuilt binaries with multi-architecture support
2. **Lock Bundler version** to match Gemfile.lock to prevent build cache invalidation

**Edit: `Dockerfile`**

**1. Install Node.js in base stage (keeps it in final image):**

```dockerfile
# Install base packages
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 libvips postgresql-client && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

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

# Ensure the Bundler version matches Gemfile.lock to avoid per-build upgrades.
RUN gem install bundler -v 2.7.2 -N
```

**Important:** Check your `Gemfile.lock` for the `BUNDLED WITH` version at the bottom and update to match:

```bash
tail Gemfile.lock
# BUNDLED WITH
#    2.7.2
```

**2. No changes to build stage needed!**

Vite Ruby automatically installs node modules during `rails assets:precompile`, so there's no need for a separate npm ci step.

**3. No changes to final stage needed!**

Node.js is already in the base image, so it's automatically in the final stage.

**Database Client Variations:**

```dockerfile
# PostgreSQL
RUN apt-get install --no-install-recommends -y curl libjemalloc2 libvips postgresql-client

# MySQL
RUN apt-get install --no-install-recommends -y curl libjemalloc2 libvips default-mysql-client

# SQLite (no client needed, built into Rails)
RUN apt-get install --no-install-recommends -y curl libjemalloc2 libvips
```

**Build stage database libraries:**

```dockerfile
# PostgreSQL
RUN apt-get install --no-install-recommends -y build-essential git libpq-dev libyaml-dev pkg-config

# MySQL
RUN apt-get install --no-install-recommends -y build-essential git libmysqlclient-dev libyaml-dev pkg-config

# SQLite (no additional library needed)
RUN apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config
```

---

## Part 5: Kamal Deployment Configuration

### Step 5.1: Update deploy.yml

**Edit: `config/deploy.yml`**

**Add Vite SSR Server:**

```yaml
servers:
  web:
    - 192.168.0.1
  vite:
    hosts:
      - 192.168.0.1
    cmd: bin/vite ssr
    options:
      init: true
      network-alias: vite_ssr
```

**Update Environment Variables:**

```yaml
env:
  secret:
    - RAILS_MASTER_KEY
    - POSTGRES_PASSWORD  # or MYSQL_ROOT_PASSWORD for MySQL
  clear:
    SOLID_QUEUE_IN_PUMA: true  # Omit if using --skip-solid
    DB_HOST: PROJECT_NAME-db
    INERTIA_SSR_URL: http://vite_ssr:13714
```

**Note:** `SOLID_QUEUE_IN_PUMA: true` should be included only if the project was created WITH Solid (default). If you used `--skip-solid` flag, omit this variable.

**Add Database Accessory (PostgreSQL):**

```yaml
accessories:
  db:
    image: postgres:18  # Latest stable version
    host: 192.168.0.1
    port: "127.0.0.1:5432:5432"  # localhost only
    env:
      clear:
        POSTGRES_USER: PROJECT_NAME
        POSTGRES_DB: PROJECT_NAME_production
      secret:
        - POSTGRES_PASSWORD
    files:
      - db/production.sql:/docker-entrypoint-initdb.d/setup.sql
    directories:
      - data:/var/lib/postgresql/data
```

**For MySQL instead:**

```yaml
accessories:
  db:
    image: mysql:9.4.0  # Latest Innovation release. Use mysql:8.4 for LTS (Long-Term Support) version
    host: 192.168.0.1
    port: "127.0.0.1:3306:3306"
    env:
      clear:
        MYSQL_ROOT_HOST: '%'
        MYSQL_DATABASE: PROJECT_NAME_production
        MYSQL_USER: PROJECT_NAME
      secret:
        - MYSQL_ROOT_PASSWORD
    files:
      - db/production.sql:/docker-entrypoint-initdb.d/setup.sql
    directories:
      - data:/var/lib/mysql
```

**For SQLite (no accessory needed):**

SQLite doesn't need a database server. Use volumes for persistence:

```yaml
volumes:
  - "PROJECT_NAME_storage:/rails/storage"  # ← SQLite files stored here in Rails 8+
```

**Important:** Rails 8+ stores SQLite production database in `storage/production.sqlite3`, not in `db/`. Check your `config/database.yml` to verify the path.

---

### Step 5.2: Create Production Database Setup

**Create: `db/production.sql`**

**For PostgreSQL:**
```sql
CREATE DATABASE PROJECT_NAME_production_cache;
CREATE DATABASE PROJECT_NAME_production_queue;
CREATE DATABASE PROJECT_NAME_production_cable;
```

**For MySQL:**
```sql
CREATE DATABASE IF NOT EXISTS PROJECT_NAME_production_cache;
CREATE DATABASE IF NOT EXISTS PROJECT_NAME_production_queue;
CREATE DATABASE IF NOT EXISTS PROJECT_NAME_production_cable;
```

**For SQLite:** Not needed (no SQL init file)

---

### Step 5.3: Update database.yml

**Edit: `config/database.yml`**

```yaml
production:
  primary: &primary_production
    <<: *default
    host: <%= ENV["DB_HOST"] %>
    database: PROJECT_NAME_production
    username: PROJECT_NAME
    password: <%= ENV["POSTGRES_PASSWORD"] %>  # or ENV["MYSQL_ROOT_PASSWORD"]
  cache:
    <<: *primary_production
    database: PROJECT_NAME_production_cache
    migrations_paths: db/cache_migrate
  queue:
    <<: *primary_production
    database: PROJECT_NAME_production_queue
    migrations_paths: db/queue_migrate
  cable:
    <<: *primary_production
    database: PROJECT_NAME_production_cable
    migrations_paths: db/cable_migrate
```

**For SQLite in production (if using):**

```yaml
production:
  primary: &primary_production
    <<: *default
    database: storage/production.sqlite3
  cache:
    <<: *primary_production
    database: storage/production_cache.sqlite3
    migrations_paths: db/cache_migrate
  queue:
    <<: *primary_production
    database: storage/production_queue.sqlite3
    migrations_paths: db/queue_migrate
  cable:
    <<: *primary_production
    database: storage/production_cable.sqlite3
    migrations_paths: db/cable_migrate
```

---

### Step 5.4: Configure Secrets

**Create: `.env` (git-ignored)**

```bash
POSTGRES_PASSWORD=your-secure-password
KAMAL_REGISTRY_PASSWORD=your-docker-hub-token
```

**Update: `.kamal/secrets`**

```bash
KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$(cat config/master.key)
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
```

**Load secrets:**

```bash
export $(grep -v '^#' .env | xargs)
```

---

### Step 5.5: Deploy

```bash
# Commit changes
git add .
git commit -m "Setup Inertia Rails with SSR"

# Initial setup
kamal setup

# Deploy
kamal deploy
```

---

## Complete File Structure

```
project/
├── app/
│   ├── frontend/
│   │   ├── entrypoints/
│   │   │   ├── inertia.ts           # Client entry with hydration
│   │   │   └── application.css      # Tailwind CSS
│   │   ├── ssr/
│   │   │   └── ssr.tsx              # SSR server entry
│   │   ├── pages/
│   │   │   └── **/*.tsx             # Inertia pages
│   │   ├── components/
│   │   │   └── ui/                  # ShadcnUI components
│   │   └── lib/
│   │       └── utils.ts             # cn() helper
│   └── controllers/
│       └── inertia_example_controller.rb
├── config/
│   ├── vite.json                    # Enable SSR builds
│   ├── deploy.yml                   # Kamal with vite_ssr
│   ├── database.yml                 # Database configuration
│   └── initializers/
│       └── inertia_rails.rb         # Enable SSR
├── db/
│   └── production.sql               # DB init for accessories
├── vite.config.ts                   # Path aliases
├── components.json                  # ShadcnUI config
├── tsconfig.json                    # TypeScript (shadcn paths)
├── tsconfig.app.json                # TypeScript (shadcn paths)
├── Dockerfile                       # Node.js for SSR
├── Procfile.dev                     # web first, then vite
└── .kamal/
    └── secrets                      # Environment variables
```

---

## Critical Configuration Summary

### 1. SSR Requires Node.js in Production
- ✅ Install Node.js in Dockerfile base stage
- ✅ Node.js automatically copied to final stage
- ❌ Do NOT remove Node.js after build

### 2. SSR Build Process
- ✅ Use `rails assets:precompile` (handles client + SSR)
- ❌ Do NOT run `bin/vite build --ssr` separately

### 3. Kamal SSR Architecture
```
Web Container (Rails) ←→ vite_ssr Container (Node.js SSR)
                   via http://vite_ssr:13714
```

### 4. ShadcnUI Non-Interactive
```bash
npx shadcn@latest init --defaults --yes
npx shadcn@latest add COMPONENT --yes --overwrite
```

### 5. Database Flexibility
- **PostgreSQL:** Production recommended, use `postgres:18` accessory (latest stable)
- **MySQL:** Use `mysql:9.4.0` (Innovation) or `mysql:8.4` (LTS) accessory, change client libraries
- **SQLite:** No accessory, use volumes, simpler for small apps

---

## Common Pitfalls

1. ❌ **Forgetting to update BOTH tsconfig files** for ShadcnUI
2. ❌ **Using interactive shadcn commands** (missing `--defaults --yes`)
3. ❌ **Running `bin/vite build --ssr` separately** (redundant)
4. ❌ **Removing Node.js from Dockerfile** (breaks SSR)
5. ❌ **Missing `network-alias: vite_ssr`** (Rails can't connect)
6. ❌ **Wrong Procfile.dev order** (Rails on port 3100 instead of 3000)
7. ❌ **Missing `host: "127.0.0.1"` in vite.json** (127.0.0.1 fails)
8. ❌ **Not updating database.yml** with `DB_HOST` and password ENV vars
9. ❌ **Wrong SQLite volume path** (use `/rails/storage` not `/rails/db`)
10. ❌ **Bundler version mismatch** (lock version to match `Gemfile.lock`)

---

## Testing SSR Works

```bash
# Build for production
export RAILS_ENV=production
./bin/rails assets:precompile

# Check SSR bundle exists
ls -lh public/vite-ssr/ssr.js

# Start Rails in production
bin/rails s -e production

# In another terminal: Start SSR server
bin/vite ssr

# Test SSR (should see rendered HTML, not empty div)
curl http://localhost:3000/inertia-example | grep "count is"
```

If you see rendered content in curl output, SSR is working!

---

## Database Migration Guide

### From SQLite to PostgreSQL:

1. **Update Gemfile:**
   ```ruby
   gem 'pg'  # Remove or comment sqlite3
   ```

2. **Update Dockerfile:**
   ```dockerfile
   # Change client
   RUN apt-get install --no-install-recommends -y curl libjemalloc2 libvips postgresql-client

   # Change build library
   RUN apt-get install --no-install-recommends -y build-essential git libpq-dev libyaml-dev pkg-config
   ```

3. **Update deploy.yml:** Add PostgreSQL accessory (see Part 5.1)

4. **Update database.yml:** Add host/username/password (see Part 5.3)

5. **Create db/production.sql** (see Part 5.2)

### From PostgreSQL to MySQL:

1. **Update Gemfile:**
   ```ruby
   gem 'mysql2'  # Replace pg
   ```

2. **Update Dockerfile:**
   ```dockerfile
   # Change client
   RUN apt-get install --no-install-recommends -y curl libjemalloc2 libvips default-mysql-client

   # Change build library
   RUN apt-get install --no-install-recommends -y build-essential git libmysqlclient-dev libyaml-dev pkg-config
   ```

3. **Update deploy.yml:** Change to MySQL accessory with `MYSQL_ROOT_PASSWORD`

4. **Update database.yml:** Change adapter to `mysql2`

5. **Update db/production.sql:** Use MySQL syntax

---

## Next Steps

- Add more ShadcnUI components: `npx shadcn@latest add COMPONENT --yes --overwrite`
- Configure custom domain in `config/deploy.yml` → `proxy.host`
- Add Valkey accessory for caching/background jobs (use `valkey/valkey:9` image instead of Redis)
- Set up CI/CD with GitHub Actions
- Configure monitoring and logging
- Add health checks to deploy.yml

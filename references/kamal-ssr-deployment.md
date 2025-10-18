# Kamal SSR Deployment Configuration

## Core SSR Requirements

For Inertia SSR to work with Kamal, three components must be configured:

1. **Vite SSR server** - Runs Node.js process for server-side rendering
2. **Network alias** - Fixed hostname for Rails to connect to SSR server
3. **Environment variable** - Tells Inertia where to find SSR server

## Essential Configuration

###servers Section

Add `vite` server alongside `web`:

```yaml
servers:
  web:
    - 192.168.0.1
  vite:
    hosts:
      - 192.168.0.1
    cmd: bin/vite ssr
    options:
      network-alias: vite_ssr
```

**Key points:**
- `cmd: bin/vite ssr` - Starts the SSR Node.js server
- `network-alias: vite_ssr` - Creates fixed hostname in Docker network
- Should deploy to same host(s) as web for reliability

### env Section

Add SSR URL to environment variables:

```yaml
env:
  clear:
    SOLID_QUEUE_IN_PUMA: true
    DB_HOST: PROJECT_NAME-db
    INERTIA_SSR_URL: http://vite_ssr:13714
```

**Why `http://vite_ssr:13714`:**
- `vite_ssr` matches the `network-alias` from vite server config
- `13714` is the default SSR server port
- `http://` prefix is required

## Database Accessories

### PostgreSQL Configuration

```yaml
accessories:
  db:
    image: postgres:18  # Latest stable version
    host: 192.168.0.1
    port: "127.0.0.1:5432:5432"  # localhost only for security
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

env:
  secret:
    - RAILS_MASTER_KEY
    - POSTGRES_PASSWORD
  clear:
    DB_HOST: PROJECT_NAME-db
    INERTIA_SSR_URL: http://vite_ssr:13714
```

**Port mapping `127.0.0.1:5432:5432`:**
- Exposes PostgreSQL only to localhost
- More secure than `5432:5432` which exposes publicly
- Rails connects via Docker network, not localhost

### MySQL Configuration

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

env:
  secret:
    - RAILS_MASTER_KEY
    - MYSQL_ROOT_PASSWORD
  clear:
    DB_HOST: PROJECT_NAME-db
    INERTIA_SSR_URL: http://vite_ssr:13714
```

### SQLite Configuration (No Accessory)

For SQLite, use volumes instead of database accessory:

```yaml
volumes:
  - "PROJECT_NAME_storage:/rails/storage"
  - "PROJECT_NAME_db:/rails/db"  # Persistent SQLite files

env:
  secret:
    - RAILS_MASTER_KEY
  clear:
    SOLID_QUEUE_IN_PUMA: true
    INERTIA_SSR_URL: http://vite_ssr:13714
```

**No DB_HOST needed** - SQLite uses local files.

## Database Initialization Files

### PostgreSQL (db/production.sql)

```sql
CREATE DATABASE PROJECT_NAME_production_cache;
CREATE DATABASE PROJECT_NAME_production_queue;
CREATE DATABASE PROJECT_NAME_production_cable;
```

### MySQL (db/production.sql)

```sql
CREATE DATABASE IF NOT EXISTS PROJECT_NAME_production_cache;
CREATE DATABASE IF NOT EXISTS PROJECT_NAME_production_queue;
CREATE DATABASE IF NOT EXISTS PROJECT_NAME_production_cable;
```

### SQLite

No initialization file needed.

## Complete Example: PostgreSQL

```yaml
service: myapp
image: username/myapp

servers:
  web:
    - 192.168.0.1
  vite:
    hosts:
      - 192.168.0.1
    cmd: bin/vite ssr
    options:
      network-alias: vite_ssr

proxy:
  ssl: true
  host: app.example.com

registry:
  username: username
  password:
    - KAMAL_REGISTRY_PASSWORD

env:
  secret:
    - RAILS_MASTER_KEY
    - POSTGRES_PASSWORD
  clear:
    SOLID_QUEUE_IN_PUMA: true
    DB_HOST: myapp-db
    INERTIA_SSR_URL: http://vite_ssr:13714

aliases:
  console: app exec --interactive --reuse "bin/rails console"
  shell: app exec --interactive --reuse "bash"
  logs: app logs -f
  dbc: app exec --interactive --reuse "bin/rails dbconsole"

volumes:
  - "myapp_storage:/rails/storage"

asset_path: /rails/public/assets

builder:
  arch: amd64

accessories:
  db:
    image: postgres:18  # Latest stable version
    host: 192.168.0.1
    port: "127.0.0.1:5432:5432"
    env:
      clear:
        POSTGRES_USER: myapp
        POSTGRES_DB: myapp_production
      secret:
        - POSTGRES_PASSWORD
    files:
      - db/production.sql:/docker-entrypoint-initdb.d/setup.sql
    directories:
      - data:/var/lib/postgresql/data
```

## Architecture Diagram

```
┌─────────────────┐         ┌──────────────────┐
│   Web Server    │────────▶│   Vite SSR       │
│   (Rails)       │  HTTP   │   (Node.js)      │
│   Port 80       │         │   Port 13714     │
└────────┬────────┘         └──────────────────┘
         │                           ▲
         │                           │
         │                    network-alias:
         │                     vite_ssr
         │
         ▼
┌─────────────────┐
│   Database      │
│   (PostgreSQL/  │
│    MySQL)       │
└─────────────────┘
```

**Communication flow:**
1. User request → Web server (Rails)
2. Rails → SSR server via `http://vite_ssr:13714`
3. SSR server renders React → Returns HTML
4. Rails embeds HTML → Returns to user
5. Client hydrates with JavaScript

## Secrets Configuration

**.env file (git-ignored):**
```bash
POSTGRES_PASSWORD=secure-password-here
KAMAL_REGISTRY_PASSWORD=docker-hub-access-token
```

**.kamal/secrets:**
```bash
KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$(cat config/master.key)
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
```

**Load before deployment:**
```bash
export $(grep -v '^#' .env | xargs)
```

## Deployment Commands

```bash
# Initial setup (first time)
kamal setup

# Regular deployment
kamal deploy

# Check SSR server logs
kamal app logs -r vite

# Restart SSR server only
kamal app restart -r vite

# Check database accessory
kamal accessory details db
kamal accessory logs db
```

## Troubleshooting

### SSR Server Not Starting

Check logs:
```bash
kamal app logs -r vite
```

Common issues:
- Node.js not in Docker image
- Missing `app/frontend/ssr/ssr.tsx`
- npm dependencies not installed

### Rails Can't Connect to SSR

Verify network alias:
```bash
kamal app exec -r web "ping -c 1 vite_ssr"
```

Should resolve to the vite container's IP.

Check environment variable:
```bash
kamal app exec -r web "env | grep INERTIA"
```

Should show: `INERTIA_SSR_URL=http://vite_ssr:13714`

### Database Connection Fails

Check DB_HOST matches accessory name:
```bash
# If service is "myapp", DB_HOST should be "myapp-db"
kamal accessory details db
```

Verify accessory is running and healthy.

## Multi-Server Setup

For production with multiple servers:

```yaml
servers:
  web:
    - 192.168.0.1
    - 192.168.0.2
  vite:
    hosts:
      - 192.168.0.1
      - 192.168.0.2
    cmd: bin/vite ssr
    options:
      network-alias: vite_ssr
```

**Important:** Each web server should have a corresponding vite server on the same host for low-latency SSR.

## Updating Inertia Version

When Inertia.js releases updates:

1. Update npm packages: `npm update @inertiajs/react`
2. Check for SSR API changes in release notes
3. Update `app/frontend/ssr/ssr.tsx` if needed
4. Test locally with production build
5. Deploy: `kamal deploy`

Kamal automatically rebuilds the Docker image with new dependencies.

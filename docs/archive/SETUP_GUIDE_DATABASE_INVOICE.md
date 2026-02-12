# Setup Guide - Database & Invoice System

## Based on E1-Story1-2-Configuration-Bases-Donnees.md

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone and Install

```bash
cd c:\Users\sofia\Desktop\TwinMCP-master

# Install dependencies
npm install --legacy-peer-deps
```

### 2. Start Database Services

```bash
# Start PostgreSQL, Redis, and other services
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# twinmcp-postgres   running   0.0.0.0:5432->5432/tcp
# twinmcp-redis      running   0.0.0.0:6379->6379/tcp
# twinmcp-pgadmin    running   0.0.0.0:5050->80/tcp
```

### 3. Configure Environment

Create `.env` file:

```bash
# Database
DATABASE_URL="postgresql://twinmcp_user:twinmcp_password@localhost:5432/twinmcp_dev"
DIRECT_DATABASE_URL="postgresql://twinmcp_user:twinmcp_password@localhost:5432/twinmcp_dev"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_DB="0"
REDIS_SESSION_DB="1"

# Invoice Configuration
INVOICE_TAX_RATE=0.20
INVOICE_DUE_DAYS=30
INVOICE_CURRENCY=EUR

# Email (for invoice sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=billing@twinmcp.com
INVOICE_EMAIL_FROM=billing@twinmcp.com

# Encryption
ENCRYPTION_KEY_ID=billing-default
ENCRYPTION_MASTER_KEY=your-32-byte-encryption-key-here

# Company Info (for PDF invoices)
COMPANY_NAME=TwinMCP
COMPANY_ADDRESS=123 Business Street
COMPANY_CITY=Paris
COMPANY_POSTAL_CODE=75001
COMPANY_COUNTRY=France
COMPANY_VAT=FR12345678901
COMPANY_EMAIL=support@twinmcp.com
```

### 4. Run Database Migrations

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### 5. Verify Setup

```bash
# Open Prisma Studio to view database
npm run db:studio
# Access at http://localhost:5555

# Open PgAdmin
# Access at http://localhost:5050
# Email: admin@twinmcp.dev
# Password: admin
```

---

## 📊 Database Schema Overview

### Core Tables (from E1-Story1-2)

1. **users** - User accounts
2. **api_keys** - API authentication
3. **libraries** - Documentation libraries
4. **library_versions** - Version tracking
5. **documentation_chunks** - Content chunks
6. **usage_logs** - Usage tracking

### Invoice System Tables

1. **user_profiles** - Billing information
2. **invoices** - Invoice records
3. **payments** - Payment tracking
4. **subscriptions** - Subscription management
5. **credits** - User credits
6. **billing_alerts** - Billing notifications
7. **plans** - Pricing plans

---

## 🔧 Configuration Files

### Prisma Configuration

**File**: `prisma/schema.prisma`

Key settings:
- Generator: `prisma-client-js`
- Output: `../generated/prisma`
- Provider: `postgresql`
- Relations: Properly defined with cascades

### Database Configuration

**File**: `src/config/database.ts`

Features:
- Prisma client with logging
- Connection management
- Health checks
- Query logging in development

### Redis Configuration

**File**: `src/config/redis.ts`

Features:
- Cache client (DB 0)
- Session client (DB 1)
- Connection pooling
- Health checks
- CacheService utility

---

## 🧪 Testing

### Run All Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=database
npm test -- --testPathPattern=invoice
npm test -- --testPathPattern=billing

# Run with coverage
npm run test:coverage
```

### Manual Testing

#### Test PostgreSQL Connection

```bash
# Using psql
psql postgresql://twinmcp_user:twinmcp_password@localhost:5432/twinmcp_dev

# List tables
\dt

# Check invoice table
SELECT * FROM invoices LIMIT 5;
```

#### Test Redis Connection

```bash
# Using redis-cli
redis-cli

# Test cache
SET test:key "test:value"
GET test:key
DEL test:key

# Check sessions (DB 1)
SELECT 1
KEYS *
```

---

## 📋 Common Commands

### Docker Management

```bash
# Start services
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs

# Restart specific service
docker-compose restart postgres
docker-compose restart redis
```

### Database Management

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate

# Reset database (WARNING: deletes all data)
npm run db:reset

# Seed test data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

### Health Checks

```bash
# Check PostgreSQL
npm run health:db

# Check Redis
npm run health:redis

# Check all services
curl http://localhost:3000/health
```

---

## 🔐 Security Best Practices

### Following E1-Story1-2 Guidelines

1. **Environment Variables**
   - Never commit `.env` files
   - Use `.env.example` as template
   - Rotate encryption keys regularly

2. **Database Security**
   - Use SSL/TLS in production
   - Implement connection pooling
   - Regular backups

3. **Redis Security**
   - Use password authentication in production
   - Separate DBs for different purposes
   - Configure maxmemory policies

4. **Invoice Data**
   - Encrypt PII at rest
   - Audit all access
   - GDPR compliance

---

## 🐛 Troubleshooting

### PostgreSQL Issues

**Issue**: Cannot connect to database
```bash
# Check if service is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart service
docker-compose restart postgres
```

**Issue**: Migration fails
```bash
# Reset and retry
npm run db:reset
npm run db:migrate
```

### Redis Issues

**Issue**: Redis connection refused
```bash
# Check if service is running
docker-compose ps redis

# Test connection
redis-cli ping

# Restart service
docker-compose restart redis
```

### Prisma Issues

**Issue**: Prisma client not generated
```bash
# Regenerate client
npm run db:generate

# Check output directory
ls -la generated/prisma/
```

---

## 📈 Performance Optimization

### Database Indexes

Already configured in Prisma schema:
- User lookups
- Invoice queries
- Payment tracking
- Usage logs

### Redis Caching Strategy

```typescript
// Cache user data (5 min)
await CacheService.set('user:email:test@example.com', user, 300);

// Cache invoice list (15 min)
await CacheService.set('invoices:user:123', invoices, 900);

// Cache library search (15 min)
await CacheService.set('libraries:search:mongodb', results, 900);
```

### Connection Pooling

Prisma handles connection pooling automatically with optimal settings.

---

## 🔄 Migration Guide

### From Raw SQL to Prisma

**Before** (using Pool):
```typescript
const result = await pool.query(
  'SELECT * FROM invoices WHERE user_id = $1',
  [userId]
);
```

**After** (using Prisma):
```typescript
const invoices = await prisma.invoice.findMany({
  where: { userId }
});
```

### Benefits
- Type safety
- Auto-completion
- Relationship handling
- Migration management

---

## 📚 API Usage Examples

### Generate Invoice

```bash
curl -X POST http://localhost:3000/api/billing/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "period": {
      "type": "monthly",
      "startDate": "2026-01-01",
      "endDate": "2026-01-31"
    },
    "options": {
      "sendImmediately": true
    }
  }'
```

### List Invoices

```bash
curl http://localhost:3000/api/billing/invoices?userId=user-123&status=PAID
```

### Download Invoice PDF

```bash
curl http://localhost:3000/api/billing/invoices/invoice-id/pdf?userId=user-123 \
  -o invoice.pdf
```

---

## ✅ Validation Checklist

### Database Setup
- [ ] Docker services running
- [ ] PostgreSQL accessible
- [ ] Redis accessible
- [ ] PgAdmin accessible
- [ ] Prisma client generated
- [ ] Migrations applied
- [ ] Test data seeded

### Invoice System
- [ ] Invoice models in schema
- [ ] API routes created
- [ ] PDF generation working
- [ ] Email sending configured
- [ ] Security services integrated
- [ ] Tests passing

### Configuration
- [ ] `.env` file created
- [ ] Environment variables set
- [ ] Encryption keys configured
- [ ] SMTP credentials added
- [ ] Company info updated

---

## 🎯 Next Steps

1. **Development**
   - Start building features
   - Add custom business logic
   - Implement additional endpoints

2. **Testing**
   - Write integration tests
   - Add E2E tests
   - Performance testing

3. **Deployment**
   - Configure production database
   - Set up Redis cluster
   - Enable SSL/TLS
   - Configure backups

---

## 📞 Support

### Resources
- Prisma Docs: https://www.prisma.io/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Redis Docs: https://redis.io/documentation
- Docker Docs: https://docs.docker.com/

### Files Reference
- Database config: `src/config/database.ts`
- Redis config: `src/config/redis.ts`
- Prisma schema: `prisma/schema.prisma`
- Docker Compose: `docker-compose.yml`
- Init script: `scripts/init-db.sql`

---

## ✅ Summary

Your database and invoice system is configured according to **E1-Story1-2** requirements:

✅ PostgreSQL 15 with Prisma ORM
✅ Redis 7 for caching
✅ Complete invoice schema
✅ Docker containerization
✅ Automated migrations
✅ Health monitoring
✅ Security features
✅ Testing framework

**Status**: Ready for development 🚀

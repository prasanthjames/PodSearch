# Deployment Architecture

## Overview

Production-ready deployment architecture for Tell Me More podcast playlist app.

---

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION DEPLOYMENT                            │
└─────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Cloudflare   │
                              │      DNS       │
                              │   (Global)     │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │    Vercel      │ │    Vercel       │ │   Railway/      │
          │   (Frontend)   │ │   (Preview)    │ │   Render        │
          │   (Web App)   │ │   (PR Deploys) │ │   (Backend)    │
          └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                   │                   │                   │
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       │
                                       ▼
                          ┌─────────────────────┐
                          │   API Gateway      │
                          │   (Kong/AWS GW)   │
                          └─────────┬───────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Auth Service  │       │ Playlist Service│       │  Search Service│
│   (Node/Go)    │       │   (Node/Go)    │       │   (Node/Go)    │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                      │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │         Pinecone           │ │
│  │  (Neon)    │  │  (Upstash)  │  │       (Vector DB)          │ │
│  │  Primary   │  │   Cache     │  │       (Production)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    AWS S3 (Object Storage)                    │  │
│  │  - Audio files (temp)                                       │  │
│  │  - Transcripts                                              │  │
│  │  - Embeddings                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PROCESSING WORKERS                                  │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ Transcriber    │  │ Summarizer     │  │ Embedding       │   │
│  │ (whisper.cpp) │  │ (GPT-4o-mini) │  │ (Sentence-      │   │
│  │ (GPU Instance) │  │  (API)         │  │  Transformers) │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │              RabbitMQ (Message Queue)                       │    │
│  │  - Episode processing queue                                │    │
│  │  - Dead letter queue for failures                         │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                   │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Apple       │  │  OpenAI     │  │   SendGrid / Resend   │   │
│  │ Podcasts    │  │  API        │  │   (Email)             │   │
│  │  API        │  │             │  │                        │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

### Development (Local)

```yaml
# docker-compose.yml (Development)
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: tellmemore_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: dev
      MINIO_ROOT_PASSWORD: dev
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Staging (Cloud)

```yaml
# railway.yml (Staging)
services:
  web:
    build: .
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: staging
      - key: DATABASE_URL
        fromDatabase:
          name: tellmemore-staging
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: redis-staging
          property: connectionString

  redis:
    image: redis:7-alpine
    persist: true

variables:
  - key: NODE_ENV
    value: staging
```

### Production (Cloud)

```yaml
# railway.yml (Production)
services:
  web:
    build: .
    startCommand: npm run start
    numReplicas: 3
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: tellmemore-prod
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: redis-prod
          property: connectionString
      - key: JWT_SECRET
        generateValue: true

  worker:
    build: ./workers
    numReplicas: 2
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: tellmemore-prod
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: redis-prod
          property: connectionString

variables:
  - key: NODE_ENV
    value: production
```

---

## Deployment Pipeline

### CI/CD Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Run linting
        run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t tellmemore:${{ github.sha }} .

  deploy-staging:
    needs: build
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to Railway (Staging)
        run: |
          railway deploy --environment staging

  deploy-production:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Railway (Production)
        run: |
          railway deploy --environment production
      
      - name: Notify Slack
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"Tell Me More deployed to production!"}' \
            ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Deployment Checklist

```markdown
## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Monitoring alerts configured

### Deployment
- [ ] Blue/green deployment ready
- [ ] Rollback plan documented
- [ ] Canary deployment enabled (10%)
- [ ] Health checks passing
- [ ] Logs streaming

### Post-Deployment
- [ ] Smoke tests passing
- [ ] No critical errors in logs
- [ ] Performance benchmarks met
- [ ] User feedback collected
- [ ] Documentation updated
```

---

## Infrastructure as Code

### Terraform (AWS)

```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "tellmemore_vpc" {
  cidr_block = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support = true
  
  tags = {
    Name = "tellmemore-vpc"
    Environment = "production"
  }
}

# Subnets
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.tellmemore_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  
  tags = {
    Name = "tellmemore-public-1"
  }
}

resource "aws_subnet" "private_1" {
  vpc_id                  = aws_vpc.tellmemore_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1a"
  
  tags = {
    Name = "tellmemore-private-1"
  }
}

# Security Groups
resource "aws_security_group" "web_sg" {
  name        = "tellmemore-web-sg"
  description = "Web tier security group"
  vpc_id      = aws_vpc.tellmemore_vpc.id
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS Instance
resource "aws_db_instance" "postgres" {
  identifier        = "tellmemore-db"
  engine           = "postgres"
  engine_version   = "15.4"
  instance_class   = "db.t3.micro"
  allocated_storage = 20
  db_name          = "tellmemore"
  
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.default.name
  
  backup_retention_period = 7
  skip_final_snapshot    = false
  
  tags = {
    Name = "tellmemore-db"
  }
}

# ElastiCache (Redis)
resource "aws_elasticache_cluster" "redis" {
  cluster_id      = "tellmemore-redis"
  engine         = "redis"
  node_type      = "cache.t3.micro"
  num_cache_nodes = 1
  parameter_group_name = "default.redis7"
  
  engine_version = "7.0"
  port          = 6379
  
  subnet_group_name  = aws_elasticache_subnet_group.default.name
  security_group_ids = [aws_security_group.redis_sg.id]
}

# S3 Bucket
resource "aws_s3_bucket" "media" {
  bucket = "tellmemore-media"
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    enabled = true
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# Outputs
output "endpoint" {
  value = aws_lb.web_alb.dns_name
}
```

---

## Kubernetes (Production Scale)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tellmemore-api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: tellmemore-api
  template:
    metadata:
      labels:
        app: tellmemore-api
    spec:
      containers:
      - name: api
        image: tellmemore/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: tellmemore-api
---
apiVersion: v1
kind: Service
metadata:
  name: tellmemore-api
  namespace: production
spec:
  selector:
    app: tellmemore-api
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tellmemore-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tellmemore-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MONITORING STACK                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    APPLICATION METRICS                               │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │  Prometheus │  │  Grafana    │  │   Datadog              │   │
│  │  (Metrics)  │  │  (Dashboards│  │   (APM + Logs)         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Key Metrics                               │  │
│  │  - Request latency (P50, P95, P99)                         │  │
│  │  - Error rate (%)                                           │  │
│  │  - Throughput (requests/second)                            │  │
│  │  - Database query time                                      │  │
│  │  - Cache hit rate                                           │  │
│  │  - Vector search latency                                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ALERTING                                      │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │   PagerDuty │  │   Slack     │  │   Email               │   │
│  │  (Critical) │  │  (Warnings) │  │  (Daily Digest)       │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
│                                                                      │
│  Alert Rules:                                                       │
│  - Error rate > 1% → Warning                                       │
│  - Error rate > 5% → Critical (Page)                               │
│  - Latency P95 > 1s → Warning                                      │
│  - Latency P99 > 3s → Critical                                     │
│  - CPU > 80% → Warning                                             │
│  - Memory > 90% → Critical                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cost Breakdown (Production)

| Service | Provider | Monthly Cost | Notes |
|---------|----------|--------------|-------|
| Frontend | Vercel | $20 | Pro plan |
| Backend | Railway | $100 | 3 services, 3 replicas |
| Database | Neon | $50 | Production tier |
| Vector DB | Pinecone | $150 | Production index |
| Cache | Upstash | $50 | 1GB Redis |
| Storage | AWS S3 | $30 | 100GB + CDN |
| GPU | AWS (spot) | $100 | Whisper processing |
| Monitoring | Datadog | $100 | APM + Logs |
| SSL/DNS | Cloudflare | $0 | Free tier |
| **Total** | | **$600/month** | |

### Cost Optimization Strategies

1. **Use spot instances for GPU processing** → Save 60%
2. **Implement aggressive caching** → Reduce DB load 50%
3. **Auto-scale based on demand** → Save 30% off-peak
4. **Use reserved capacity for Pinecone** → Save 20%

---

## Disaster Recovery

### Backup Strategy

```yaml
# Daily Backups
- PostgreSQL: Daily automated backups (7-day retention)
- Redis: RDB snapshots every hour
- S3: Versioning enabled, lifecycle rules for Glacier
- Pinecone: Daily index snapshots

# Recovery Time Objective (RTO): 4 hours
# Recovery Point Objective (RPO): 1 hour
```

### Failover Plan

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FAILOVER PROCEDURE                             │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Detect Failure
├── Health check fails (3 consecutive checks)
├── Alert on-call engineer (PagerDuty)
└── Engineer acknowledges within 15 minutes

Step 2: Assess Impact
├── Check dashboard for scope of outage
├── Identify affected services
└── Determine root cause

Step 3: Execute Recovery
├── For database: Promote read replica to primary
├── For application: Route traffic to healthy region
└── For infrastructure: Launch backup instances

Step 4: Validate
├── Run smoke tests
├── Check error rates
└── Monitor latency metrics

Step 5: Post-Mortem
├── Document incident
├── Identify prevention measures
└── Update runbook
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Network Security                                         │
│  - CloudFlare WAF (Web Application Firewall)                       │
│  - DDoS protection                                                  │
│  - Rate limiting (100 req/min per user)                             │
│  - IP allowlisting for admin routes                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Layer 2: Application Security                                     │
│  - HTTPS everywhere (TLS 1.3)                                      │
│  - JWT with short expiry (15 min) + refresh token                  │
│  - bcrypt password hashing (cost 12)                               │
│  - Input validation (Zod schemas)                                  │
│  - SQL injection prevention (Prisma ORM)                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: Data Security                                            │
│  - Encryption at rest (AWS S3, RDS)                                │
│  - Encryption in transit (TLS)                                      │
│  - Sensitive data masking in logs                                   │
│  - GDPR compliance (data export/delete)                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Layer 4: Infrastructure Security                                  │
│  - Secrets management (AWS Secrets Manager)                         │
│  - IAM roles with least privilege                                   │
│  - Audit logging (CloudTrail)                                      │
│  - Regular security patches                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Rollback Strategy

```bash
# Kubernetes Rollback
kubectl rollout undo deployment/tellmemore-api

# Database Rollback
# 1. Take backup of current state
# 2. Run migration down script
# 3. Verify application works

# CDN Rollback
# 1. Revert to previous cache invalidation
# 2. Roll back CDN configuration
```

---

## Go-Live Checklist

```markdown
## Production Go-Live Checklist

### Infrastructure
- [ ] All services deployed and healthy
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] CDN configured and caching
- [ ] DNS propagated

### Security
- [ ] WAF rules configured
- [ ] Rate limiting enabled
- [ ] Security headers set
- [ ] Audit logging active

### Monitoring
- [ ] Dashboards created
- [ ] Alerts configured
- [ ] On-call rotation set
- [ ] Runbook documented

### Testing
- [ ] Load test completed (1000 concurrent)
- [ ] Security scan passed
- [ ] Smoke tests passing
- [ ] User acceptance testing complete

### Communication
- [ ] Stakeholders notified
- [ ] Support team trained
- [ ] Status page configured
- [ ] Rollback plan tested
```

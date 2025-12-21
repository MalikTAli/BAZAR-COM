# Bazar.com - Lab 2: Replication, Caching, and Consistency

A distributed online bookstore implementing microservices architecture with replication, caching, load balancing, and strong consistency.

## 📚 Features

- **Microservices Architecture**: Frontend, Catalog, and Order services
- **Service Replication**: 2 replicas each for Catalog and Order services
- **Load Balancing**: Round-robin distribution across replicas
- **In-Memory Caching**: NodeCache with TTL and LRU support
- **Strong Consistency**: Server-push cache invalidation before writes
- **Replica Synchronization**: Automatic sync across catalog replicas
- **Docker Support**: Full containerization with Docker Compose and Swarm
- **Performance Monitoring**: Built-in metrics and health checks

## 🏗️ Architecture

```
Client
  ↓
Frontend Service (Port 3002)
  - Load Balancer
  - Cache Manager
  ↓
├─→ Catalog Service (Port 3001) - Replica 1 & 2
│     - Book Database
│     - Search & Info
│
└─→ Order Service (Port 3000) - Replica 1 & 2
      - Order Processing
      - Purchase Logic
```

## 📖 Book Catalog

| ID | Title | Topic | Price | Stock |
|----|-------|-------|-------|-------|
| 1 | How to get a good grade in DOS in 40 minutes a day | Distributed Systems | $100 | 18 |
| 2 | RPCs for Noobs | Distributed Systems | $100 | 19 |
| 3 | Xen and the Art of Surviving Undergraduate School | Undergraduate | $25 | 10 |
| 4 | Cooking for the Impatient Undergrad | Undergraduate | $20 | 9 |
| 5 | **How to finish Project 3 on time** | Project Management | $150 | 15 |
| 6 | **Why theory classes are so hard** | Theory | $120 | 20 |
| 7 | **Spring in the Pioneer Valley** | Spring | $80 | 25 |

*Books 5-7 added in Lab 2*

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (Windows/Mac/Linux)
- PowerShell (for Windows testing scripts)
- Git

### Option 1: Docker Compose (Development)

```bash
# Clone the repository
git clone <your-repo-url>
cd BAZAR-COM

# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Docker Swarm (Production)

```bash
# Initialize swarm
docker swarm init

# Build images
./build-images.sh

# Deploy with replicas
./deploy-swarm.sh

# Scale services
./scale-services.sh

# Check status
docker service ls

# Remove deployment
docker stack rm bazar
```

## 📡 API Endpoints

### Frontend Service (http://localhost:3002)

| Method | Endpoint | Description | Cached |
|--------|----------|-------------|--------|
| GET | `/search/:topic` | Search books by topic | ✅ Yes |
| GET | `/info/:id` | Get book details | ✅ Yes |
| POST | `/purchase/:id` | Purchase a book | ❌ No |
| POST | `/invalidate-cache` | Invalidate cache entry | - |
| GET | `/health` | Health check | ❌ No |
| GET | `/cache-stats` | Cache statistics | ❌ No |

### Catalog Service (http://localhost:3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search/:topic` | Search books by topic |
| GET | `/info/:id` | Get book information |
| PUT | `/update/:id` | Update book (price/stock) |
| POST | `/sync-update/:id` | Replica sync endpoint |
| GET | `/health` | Health check |

### Order Service (http://localhost:3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/purchase/:id` | Purchase a book |
| GET | `/orders` | Get all orders |
| GET | `/health` | Health check |

## 🧪 Testing

### Manual Testing

```powershell
# Search for books
Invoke-RestMethod -Uri "http://localhost:3002/search/distributed systems"

# Get book details
Invoke-RestMethod -Uri "http://localhost:3002/info/1"

# Purchase a book
Invoke-RestMethod -Uri "http://localhost:3002/purchase/5" -Method POST

# View orders
Invoke-RestMethod -Uri "http://localhost:3000/orders"

# Check cache stats
Invoke-RestMethod -Uri "http://localhost:3002/cache-stats"

# Health checks
Invoke-RestMethod -Uri "http://localhost:3002/health"
```

### Performance Testing

```powershell
# Run comprehensive performance tests
.\test-performance.ps1

# Results will be saved to docs/performance-results.csv
```

Performance tests measure:
- Response time with and without caching
- Cache hit/miss rates
- Cache invalidation overhead
- Load balancing distribution
- Purchase operation latency

## 📊 Performance Results

| Metric | Without Cache | With Cache | Improvement |
|--------|---------------|------------|-------------|
| Search Requests | 45ms | 8ms | **82%** ↓ |
| Info Requests | 42ms | 6ms | **86%** ↓ |
| Cache Hit Rate | - | 70-75% | - |
| Purchase Latency | 125ms | - | - |
| Invalidation Overhead | - | 47ms | 38% of write |

See [PERFORMANCE.md](docs/PERFORMANCE.md) for detailed analysis.

## 🔧 Configuration

### Environment Variables

**Frontend:**
```bash
PORT=3002
CATALOG_REPLICAS=http://catalog1:3001,http://catalog2:3001
ORDER_REPLICAS=http://order1:3000,http://order2:3000
```

**Catalog:**
```bash
PORT=3001
FRONTEND_URL=http://frontend:3002
REPLICA_URLS=http://catalog2:3001
```

**Order:**
```bash
PORT=3000
CATALOG_SERVICE_URL=http://catalog:3001
FRONTEND_URL=http://frontend:3002
```

### Cache Configuration

Edit `frontend-server/app.js`:
```javascript
const cache = new NodeCache({
  stdTTL: 300,    // Time to live (seconds)
  maxKeys: 100,   // Maximum cache entries
});
```

## 📁 Project Structure

```
BAZAR-COM/
├── catalog-server/
│   ├── app.js              # Catalog service
│   ├── catalog.csv         # Book database
│   ├── Dockerfile
│   └── package.json
├── order-server/
│   ├── app.js              # Order service
│   ├── orders.csv          # Orders database
│   ├── Dockerfile
│   └── package.json
├── frontend-server/
│   ├── app.js              # Frontend + Cache + LB
│   ├── Dockerfile
│   └── package.json
├── docs/
│   ├── DESIGN.md           # Design document
│   └── PERFORMANCE.md      # Performance results
├── docker-compose.yml      # Development setup
├── docker-swarm.yml        # Production setup
├── build-images.sh         # Build Docker images
├── deploy-swarm.sh         # Deploy to Swarm
├── scale-services.sh       # Scale replicas
└── test-performance.ps1    # Performance tests
```

## 🎯 Key Implementation Details

### 1. Load Balancing
- **Algorithm**: Round-Robin
- **Implementation**: Frontend maintains replica indices
- **Distribution**: Even distribution across replicas
- **Failover**: Not implemented (can be added)

```javascript
function getNextCatalogReplica() {
  const replica = CATALOG_REPLICAS[catalogReplicaIndex];
  catalogReplicaIndex = (catalogReplicaIndex + 1) % CATALOG_REPLICAS.length;
  return replica;
}
```

### 2. Caching Strategy
- **Location**: Integrated into Frontend
- **Type**: In-memory (NodeCache)
- **TTL**: 5 minutes
- **Eviction**: LRU policy
- **Scope**: Search and info requests only

### 3. Cache Invalidation
- **Method**: Server-Push (Strong Consistency)
- **Trigger**: Before any database write
- **Flow**: Backend → POST `/invalidate-cache` → Frontend
- **Timing**: Synchronous (blocking)
- **Overhead**: ~47ms per invalidation

### 4. Replica Synchronization
- **Scope**: Catalog service replicas
- **Method**: HTTP POST to `/sync-update/:id`
- **Timing**: After primary write
- **Protocol**: Prevent circular updates with `X-Replica-Sync` header
- **Error Handling**: Non-blocking, logged failures

## 📝 Documentation

- **[Design Document](docs/DESIGN.md)**: Architecture, design decisions, and trade-offs
- **[Performance Results](docs/PERFORMANCE.md)**: Detailed performance measurements and analysis

## 🐛 Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker ps

# View logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose up --build
```

### Cache not working
```bash
# Check frontend logs
docker-compose logs frontend

# Test cache endpoint
Invoke-RestMethod -Uri "http://localhost:3002/cache-stats"
```

### Replica not syncing
```bash
# Check catalog logs
docker-compose logs catalog

# Verify REPLICA_URLS is set correctly
docker exec catalog-service env | grep REPLICA
```

## 🚧 Known Limitations

1. **CSV File Storage**: Not suitable for production (use PostgreSQL/MongoDB)
2. **No Authentication**: API is publicly accessible
3. **No Request Validation**: Limited input sanitization
4. **Frontend Single Point**: Frontend not replicated
5. **Sync Failures**: Replica sync failures are logged but not retried
6. **No Circuit Breaker**: Failed replicas not automatically bypassed

## 🔮 Future Improvements

- [ ] Replace CSV with proper database
- [ ] Add frontend replication with shared cache (Redis)
- [ ] Implement circuit breaker pattern
- [ ] Add authentication and authorization
- [ ] Implement request rate limiting
- [ ] Add distributed tracing (OpenTelemetry)
- [ ] Implement consensus protocol (Raft) for replicas
- [ ] Add monitoring dashboard (Grafana)
- [ ] Implement automated testing (Jest/Mocha)
- [ ] Add CI/CD pipeline

## 📄 License

This project is created for educational purposes as part of Distributed Operating Systems coursework.

## 👥 Contributors

[Your Name/Team]

## 📮 Contact

For questions or issues, please contact [your-email]

---

**Lab 2 - Distributed Operating Systems**  
**Fall 2020**  
**Topic**: Replication, Caching, and Consistency

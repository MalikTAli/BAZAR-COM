"# BAZAR-COM

A microservices-based online bookstore application built with Node.js and Docker. The system consists of three independent services that communicate via REST APIs.

## 🏗️ Architecture

The application follows a microservices architecture with three main services:

- **Catalog Service** (Port 3001): Manages book inventory, search, and stock updates
- **Order Service** (Port 3000): Handles purchase orders and order history
- **Frontend Service** (Port 3002): Acts as an API gateway, routing requests to backend services

## 📋 Prerequisites

- Node.js 18+ (for local development)
- Docker and Docker Compose
- Git

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/MalikTAli/BAZAR-COM.git
   cd BAZAR-COM
   ```

2. **Start all services**
   ```bash
   docker-compose up --build
   ```

3. **Access the services**
   - Frontend API: http://localhost:3002
   - Catalog Service: http://localhost:3001
   - Order Service: http://localhost:3000

### Local Development

#### Catalog Service
```bash
cd catalog-server
npm install
npm start
```

#### Order Service
```bash
cd order-server
npm install
# Set environment variable
$env:PORT="3000"
$env:CATALOG_SERVICE_URL="http://localhost:3001"
npm start
```

#### Frontend Service
```bash
cd frontend-server
npm install
# Set environment variables
$env:PORT="3002"
$env:CATALOG_SERVICE_URL="http://localhost:3001"
$env:ORDER_SERVICE_URL="http://localhost:3000"
node app.js
```

## 📡 API Endpoints

### Frontend Service (API Gateway)

#### Search Books
```http
GET /search/:topic
```
Search for books by topic.

**Example:**
```bash
curl http://localhost:3002/search/distributed%20systems
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "1",
      "title": "How to get a good grade in DOS in 40 minutes a day"
    }
  ]
}
```

#### Get Book Info
```http
GET /info/:id
```
Get detailed information about a specific book.

**Example:**
```bash
curl http://localhost:3002/info/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "How to get a good grade in DOS in 40 minutes a day",
    "quantity": 10,
    "price": 30
  }
}
```

#### Purchase Book
```http
POST /purchase/:id
```
Purchase a book by ID.

**Example:**
```bash
curl -X POST http://localhost:3002/purchase/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Purchase successful",
    "book": "How to get a good grade in DOS in 40 minutes a day",
    "orderId": "1732819200000",
    "price": 30
  }
}
```

#### Health Check
```http
GET /health
```
Check service health and dependencies.

**Example:**
```bash
curl http://localhost:3002/health
```

### Catalog Service

#### Search by Topic
```http
GET /search/:topic
```

#### Get Book Details
```http
GET /info/:id
```

#### Update Book
```http
PUT /update/:id
Body: { "price": 25, "stock": 15 }
```

### Order Service

#### Create Purchase Order
```http
POST /purchase/:id
```

#### Get All Orders
```http
GET /orders
```

## 🗂️ Project Structure

```
BAZAR-COM/
├── catalog-server/
│   ├── app.js              # Catalog service implementation
│   ├── catalog.csv         # Book inventory data
│   ├── Dockerfile          # Catalog service Docker config
│   └── package.json
├── order-server/
│   ├── app.js              # Order service implementation
│   ├── orders.csv          # Order history data
│   ├── Dockerfile          # Order service Docker config
│   ├── package.json
│   └── utils/
│       └── formatDate.js   # Date formatting utility
├── frontend-server/
│   ├── app.js              # Frontend API gateway
│   ├── Dockerfile          # Frontend service Docker config
│   └── package.json
├── docker-compose.yml      # Docker Compose configuration
└── REDME.md               # This file
```

## 🐳 Docker Services

### Service Configuration

| Service  | Port | Container Name     | Health Check |
|----------|------|--------------------|--------------|
| Catalog  | 3001 | catalog-service    | ✅           |
| Order    | 3000 | order-service      | ✅           |
| Frontend | 3002 | frontend-service   | ✅           |

### Environment Variables

#### Catalog Service
- `PORT=3001` - Service port
- `NODE_ENV=production` - Environment mode

#### Order Service
- `PORT=3000` - Service port
- `CATALOG_SERVICE_URL=http://catalog:3001` - Catalog service URL
- `NODE_ENV=production` - Environment mode

#### Frontend Service
- `PORT=3002` - Service port
- `CATALOG_SERVICE_URL=http://catalog:3001` - Catalog service URL
- `ORDER_SERVICE_URL=http://order:3000` - Order service URL
- `NODE_ENV=production` - Environment mode

## 🛠️ Docker Commands

### Build and start services
```bash
docker-compose up --build
```

### Start services in background
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f
```

### View specific service logs
```bash
docker-compose logs -f frontend
```

### Restart a service
```bash
docker-compose restart catalog
```

### Check service status
```bash
docker-compose ps
```

## 📊 Features

- ✅ **Microservices Architecture**: Independent, scalable services
- ✅ **Docker Support**: Full containerization with Docker Compose
- ✅ **Health Checks**: Built-in health monitoring for all services
- ✅ **Error Handling**: Comprehensive error handling and validation
- ✅ **Request Logging**: Detailed request/response logging
- ✅ **Retry Logic**: Automatic retry for failed requests
- ✅ **Graceful Shutdown**: Proper cleanup on service termination
- ✅ **CORS Enabled**: Cross-origin resource sharing support
- ✅ **CSV Persistence**: File-based data storage
- ✅ **Service Discovery**: Services communicate via Docker network

## 🔒 Best Practices Implemented

- Input validation on all endpoints
- Proper HTTP status codes
- Structured error responses
- Request timeout handling
- Container health checks
- Graceful shutdown handling
- Environment-based configuration
- Service dependency management
- Request/response logging
- Proper CORS configuration

## 🧪 Testing

### Test the services manually

```bash
# Search for books
curl http://localhost:3002/search/distributed%20systems

# Get book information
curl http://localhost:3002/info/1

# Purchase a book
curl -X POST http://localhost:3002/purchase/1

# Check health
curl http://localhost:3002/health

# Get all orders
curl http://localhost:3000/orders
```

## 📝 Data Format

### catalog.csv
```csv
ID,TOPIC,TITLE,PRICE,STOCK
1,distributed systems,How to get a good grade in DOS in 40 minutes a day,30,10
```

### orders.csv
```csv
ORDER_ID,BOOK_ID,TITLE,QUANTITY,TOTAL_PRICE,TIMESTAMP
1732819200000,1,How to get a good grade in DOS in 40 minutes a day,1,30,2024-11-28 10:30:00
```

## 🐛 Troubleshooting

### Services can't connect to each other
- Ensure all services are on the same Docker network
- Check that service names match in environment variables
- Verify health checks are passing

### Port conflicts
- Check if ports 3000, 3001, 3002 are available
- Modify port mappings in `docker-compose.yml` if needed

### CSV file not found
- Ensure CSV files exist in respective service directories
- Check volume mappings in `docker-compose.yml`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👤 Author
**Nassar Harashi**
 - GitHub: [@nassarharashi](https://github.com/nassarharashi)
   
**Malik T. Ali**
- GitHub: [@MalikTAli](https://github.com/MalikTAli)

## 🙏 Acknowledgments

- Built with Express.js
- Containerized with Docker
- CSV processing with csv-parser and csv-writer" 

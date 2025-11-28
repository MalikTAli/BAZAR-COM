const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Use environment variables for Docker, fallback to localhost
const CATALOG_SERVICE = process.env.CATALOG_SERVICE_URL || "http://localhost:3001";
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || "http://localhost:3000";

// Configure axios with timeout and retry logic
const axiosInstance = axios.create({
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Axios retry interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    if (config.retry < 3 && error.code === 'ECONNABORTED') {
      config.retry += 1;
      console.log(`⚠️  Retrying request (${config.retry}/3)...`);
      return axiosInstance(config);
    }
    return Promise.reject(error);
  }
);

// GET /search/:topic - Search books by topic
app.get("/search/:topic", async (req, res) => {
  try {
    const { topic } = req.params;
    
    // Validate input
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ error: "Topic parameter is required" });
    }
    
    if (topic.length > 100) {
      return res.status(400).json({ error: "Topic parameter too long" });
    }

    console.log(`🔍 Frontend: Searching for topic "${topic}"`);
    const response = await axiosInstance.get(`${CATALOG_SERVICE}/search/${encodeURIComponent(topic)}`);
    
    console.log(`✅ Found ${response.data.length} books`);
    res.json({
      success: true,
      count: response.data.length,
      data: response.data
    });
  } catch (error) {
    console.error("❌ Search failed:", error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: "Search failed",
        message: error.response.data.error || error.message 
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: "Catalog service timeout" });
    }
    
    res.status(503).json({ error: "Catalog service unavailable" });
  }
});

// GET /info/:id - Get book details
app.get("/info/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Invalid book ID. Must be a number." });
    }

    console.log(`ℹ️  Frontend: Getting info for book ${id}`);
    const response = await axiosInstance.get(`${CATALOG_SERVICE}/info/${id}`);
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error("❌ Info request failed:", error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: "Info request failed",
        message: error.response.data.error || error.message 
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: "Catalog service timeout" });
    }
    
    res.status(503).json({ error: "Catalog service unavailable" });
  }
});

// POST /purchase/:id - Purchase a book
app.post("/purchase/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Invalid book ID. Must be a number." });
    }

    console.log(`🛒 Frontend: Purchase request for book ${id}`);
    const response = await axiosInstance.post(`${ORDER_SERVICE}/purchase/${id}`);
    
    console.log(`✅ Purchase successful: ${response.data.book}`);
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error("❌ Purchase failed:", error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: "Purchase failed",
        message: error.response.data.error || error.message 
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: "Order service timeout" });
    }
    
    res.status(503).json({ error: "Order service unavailable" });
  }
});

// Health check with dependency checks
app.get("/health", async (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    services: {
      catalog: { url: CATALOG_SERVICE, status: "unknown" },
      order: { url: ORDER_SERVICE, status: "unknown" }
    }
  };

  // Check catalog service
  try {
    await axiosInstance.get(`${CATALOG_SERVICE}/health`, { timeout: 2000 });
    health.services.catalog.status = "healthy";
  } catch (error) {
    health.services.catalog.status = "unhealthy";
    health.services.catalog.error = error.message;
    health.status = "degraded";
  }

  // Check order service
  try {
    await axiosInstance.get(`${ORDER_SERVICE}/health`, { timeout: 2000 });
    health.services.order.status = "healthy";
  } catch (error) {
    health.services.order.status = "unhealthy";
    health.services.order.error = error.message;
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness check
app.get("/ready", (req, res) => {
  res.json({ 
    ready: true,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Frontend API",
    version: "1.0.0",
    endpoints: [
      "GET /search/:topic - Search books by topic",
      "GET /info/:id - Get book details",
      "POST /purchase/:id - Purchase a book",
      "GET /health - Health check",
      "GET /ready - Readiness check"
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Frontend service running on port ${PORT}`);
  console.log(`📚 Catalog service: ${CATALOG_SERVICE}`);
  console.log(`🛒 Order service: ${ORDER_SERVICE}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`✅ Server is ready to accept connections`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('👋 Frontend service shut down gracefully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
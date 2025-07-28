const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const universityRoutes = require('./routes/universities');
const searchRoutes = require('./routes/search');
const scrapeRoutes = require('./routes/scrape');
const statsRoutes = require('./routes/stats');

// Import middleware
const { globalErrorHandler } = require('./middleware/errorHandler');
const logger = require('./services/logger');

const app = express();

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_scraper';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Verbose startup configuration log to help diagnose crashes
logger.info('Server startup configuration', { PORT, MONGODB_URI, NODE_ENV });

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'https://university-scraper.netlify.app',
      'https://university-scraper.vercel.app'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // Support legacy browsers
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Apply rate limiting to all requests
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (NODE_ENV === 'production') {
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
} else {
  app.use(morgan('dev'));
}

// Health check endpoint (before other routes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/universities', universityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/stats', statsRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'AI University Web Scraper API',
    version: '1.0.0',
    documentation: {
      universities: {
        'GET /api/universities': 'List all universities',
        'GET /api/universities/:id': 'Get university by ID',
        'POST /api/universities': 'Create new university',
        'PUT /api/universities/:id': 'Update university',
        'DELETE /api/universities/:id': 'Delete university'
      },
      search: {
        'GET /api/search/universities': 'Search universities',
        'GET /api/search/programs': 'Search programs',
        'GET /api/search/scholarships': 'Search scholarships'
      },
      scraping: {
        'POST /api/scrape/university/:id': 'Start scraping university',
        'GET /api/scrape/status/:id': 'Get scraping status',
        'POST /api/scrape/bulk': 'Bulk scraping operation'
      },
      stats: {
        'GET /api/stats/overview': 'Get system overview',
        'GET /api/stats/universities': 'Get university statistics',
        'GET /api/stats/scraping': 'Get scraping statistics'
      }
    },
    endpoints: {
      health: '/health',
      api_info: '/api'
    }
  });
});

// Serve static files in production
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  // Catch all handler: send back React's index.html file for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api',
      'GET /api/universities',
      'GET /api/search/*',
      'POST /api/scrape/*',
      'GET /api/stats/*'
    ]
  });
});

// Global error handler (must be last)
app.use(globalErrorHandler);

// Database connection
async function connectToDatabase() {
  try {
    // Modern Mongoose (v8+) no longer needs deprecated options like useNewUrlParser or useUnifiedTopology.
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    
    logger.info('Connected to MongoDB successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    console.error('Failed to connect to MongoDB:', error); // <--- explicit console output
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await connectToDatabase();
    
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API documentation available at http://localhost:${PORT}/api`);
      logger.info(`💓 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        mongoose.connection.close(() => {
          logger.info('Database connection closed');
          process.exit(0);
        });
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('Failed to start server:', error); // <--- explicit console output
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app; 
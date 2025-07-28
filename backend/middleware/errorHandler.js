const logger = require('../services/logger');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle different types of errors and convert them to AppError instances
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

/**
 * Send error response in development mode
 */
const sendErrorDev = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: 'error',
      error: err,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    });
  }

  // B) RENDERED WEBSITE
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message
  });
};

/**
 * Send error response in production mode
 */
const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
    }
    
    // Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error('ERROR 💥', err);
    logger.logError(err, req);
    
    // 2) Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }

  // B) RENDERED WEBSITE
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message
    });
  }
  
  // Programming or other unknown error: don't leak error details
  // 1) Log error
  console.error('ERROR 💥', err);
  logger.logError(err, req);
  
  // 2) Send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.'
  });
};

/**
 * Main error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  // Set default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error
  logger.logError(err, req);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

/**
 * Async error wrapper to catch async errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Handle 404 errors for unmatched routes
 */
const handleNotFound = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

/**
 * Validation error handler for Joi validation
 */
const handleValidationError = (error, req, res, next) => {
  if (error.isJoi) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      details: errorMessage,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }
  next(error);
};

/**
 * Rate limit error handler
 */
const handleRateLimitError = (req, res) => {
  const error = new AppError('Too many requests from this IP, please try again later!', 429);
  
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.originalUrl,
    userAgent: req.get('User-Agent')
  });
  
  res.status(429).json({
    status: 'error',
    message: error.message,
    retryAfter: Math.ceil(15 * 60), // 15 minutes in seconds
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
};

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleNotFound,
  handleValidationError,
  handleRateLimitError
}; 
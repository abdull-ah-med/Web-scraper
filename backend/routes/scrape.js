const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const University = require('../models/University');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../services/logger');

const router = express.Router();

// Global tracking of active scraping processes
const activeScrapingProcesses = new Map();

// Helper function to execute Python scraper
const runPythonScraper = (command, args = []) => {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scraperPath = path.join(__dirname, '../../scraper/main.py');
    
    const process = spawn(pythonPath, [scraperPath, ...args], {
      cwd: path.join(__dirname, '../../scraper'),
      env: {
        ...process.env,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
        MONGODB_URI: process.env.MONGODB_URI
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout, error: null });
      } else {
        reject({ success: false, output: stdout, error: stderr });
      }
    });
    
    process.on('error', (error) => {
      reject({ success: false, output: '', error: error.message });
    });
    
    return process;
  });
};

// @route   POST /api/scrape/university/:id
// @desc    Start scraping a specific university
// @access  Private
router.post('/university/:id', catchAsync(async (req, res, next) => {
  const universityId = req.params.id;
  
  // Check if university exists
  const university = await University.findById(universityId);
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  // Check if university is already being scraped
  if (activeScrapingProcesses.has(universityId)) {
    return next(new AppError('University is already being scraped', 409));
  }
  
  // Check if university was recently scraped (within last hour)
  if (university.last_scraped) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (university.last_scraped > oneHourAgo) {
      return next(new AppError('University was recently scraped. Please wait before scraping again.', 429));
    }
  }
  
  try {
    // Update university status to 'scraping'
    await university.updateScrapingStatus('scraping');
    
    // Start scraping process
    logger.logScraping('start_single', universityId, { 
      universityName: university.name,
      url: university.url 
    });
    
    // Create custom university data for scraper
    const scraperArgs = ['--scrape-url', university.url];
    
    // Start the scraping process
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scraperPath = path.join(__dirname, '../../scraper/main.py');
    
    const scrapingProcess = spawn(pythonPath, [scraperPath, ...scraperArgs], {
      cwd: path.join(__dirname, '../../scraper'),
      env: {
        ...process.env,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
        MONGODB_URI: process.env.MONGODB_URI
      },
      detached: false
    });
    
    // Store the process
    activeScrapingProcesses.set(universityId, {
      process: scrapingProcess,
      startTime: new Date(),
      universityName: university.name
    });
    
    let scraperOutput = '';
    let scraperError = '';
    
    scrapingProcess.stdout.on('data', (data) => {
      scraperOutput += data.toString();
    });
    
    scrapingProcess.stderr.on('data', (data) => {
      scraperError += data.toString();
    });
    
    scrapingProcess.on('close', async (code) => {
      // Remove from active processes
      activeScrapingProcesses.delete(universityId);
      
      try {
        if (code === 0) {
          // Success - update university status
          await university.updateScrapingStatus('completed');
          logger.logScraping('completed_single', universityId, { 
            output: scraperOutput.substring(0, 500) 
          });
        } else {
          // Failed - update university status
          await university.updateScrapingStatus('failed', scraperError);
          logger.logScraping('failed_single', universityId, { 
            error: scraperError.substring(0, 500) 
          });
        }
      } catch (updateError) {
        logger.error('Error updating university status after scraping', updateError);
      }
    });
    
    scrapingProcess.on('error', async (error) => {
      activeScrapingProcesses.delete(universityId);
      await university.updateScrapingStatus('failed', error.message);
      logger.logScraping('error_single', universityId, { error: error.message });
    });
    
    res.json({
      status: 'success',
      message: 'Scraping started successfully',
      data: {
        universityId: universityId,
        universityName: university.name,
        status: 'scraping',
        startTime: new Date().toISOString()
      }
    });
    
  } catch (error) {
    // Reset university status on error
    await university.updateScrapingStatus('failed', error.message);
    activeScrapingProcesses.delete(universityId);
    
    logger.logScraping('error_single', universityId, { error: error.message });
    return next(new AppError('Failed to start scraping process', 500));
  }
}));

// @route   GET /api/scrape/status/:id
// @desc    Get scraping status for a university
// @access  Public
router.get('/status/:id', catchAsync(async (req, res, next) => {
  const universityId = req.params.id;
  
  const university = await University.findById(universityId).select(
    'name scraping_status last_scraped next_scrape_scheduled scraping_history'
  );
  
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  const isActivelyBeingScraped = activeScrapingProcesses.has(universityId);
  const activeProcess = activeScrapingProcesses.get(universityId);
  
  res.json({
    status: 'success',
    data: {
      university: {
        id: universityId,
        name: university.name
      },
      scraping_status: university.scraping_status,
      is_actively_scraping: isActivelyBeingScraped,
      last_scraped: university.last_scraped,
      next_scrape_scheduled: university.next_scrape_scheduled,
      active_process: activeProcess ? {
        startTime: activeProcess.startTime,
        duration: new Date() - activeProcess.startTime
      } : null,
      recent_history: university.scraping_history.slice(-3) // Last 3 attempts
    }
  });
}));

// @route   POST /api/scrape/stop/:id
// @desc    Stop scraping process for a university
// @access  Private
router.post('/stop/:id', catchAsync(async (req, res, next) => {
  const universityId = req.params.id;
  
  if (!activeScrapingProcesses.has(universityId)) {
    return next(new AppError('No active scraping process found for this university', 404));
  }
  
  const processInfo = activeScrapingProcesses.get(universityId);
  
  try {
    // Kill the process
    processInfo.process.kill('SIGTERM');
    
    // Remove from active processes
    activeScrapingProcesses.delete(universityId);
    
    // Update university status
    const university = await University.findById(universityId);
    if (university) {
      await university.updateScrapingStatus('paused', 'Stopped by user');
    }
    
    logger.logScraping('stopped', universityId, { 
      universityName: processInfo.universityName,
      duration: new Date() - processInfo.startTime
    });
    
    res.json({
      status: 'success',
      message: 'Scraping process stopped successfully',
      data: {
        universityId: universityId,
        universityName: processInfo.universityName,
        status: 'stopped'
      }
    });
    
  } catch (error) {
    logger.error('Error stopping scraping process', error);
    return next(new AppError('Failed to stop scraping process', 500));
  }
}));

// @route   POST /api/scrape/bulk
// @desc    Start bulk scraping operation
// @access  Private
router.post('/bulk', catchAsync(async (req, res, next) => {
  const { 
    university_ids, 
    scrape_all = false, 
    delay_between = 45,
    filter_by_priority = false,
    min_priority = 5
  } = req.body;
  
  let universitiesToScrape = [];
  
  if (scrape_all) {
    // Get all active universities
    const query = { is_active: true, scraping_status: { $ne: 'scraping' } };
    
    if (filter_by_priority) {
      query.scraping_priority = { $gte: min_priority };
    }
    
    universitiesToScrape = await University.find(query)
      .sort({ scraping_priority: -1, last_scraped: 1 })
      .limit(20); // Limit bulk operations
      
  } else if (university_ids && Array.isArray(university_ids)) {
    universitiesToScrape = await University.find({
      _id: { $in: university_ids },
      is_active: true,
      scraping_status: { $ne: 'scraping' }
    });
  } else {
    return next(new AppError('Please provide either university_ids array or set scrape_all to true', 400));
  }
  
  if (universitiesToScrape.length === 0) {
    return next(new AppError('No universities available for scraping', 404));
  }
  
  try {
    // Start bulk scraping process
    const bulkProcessId = `bulk_${Date.now()}`;
    
    logger.logScraping('start_bulk', bulkProcessId, { 
      universitiesCount: universitiesToScrape.length,
      delayBetween: delay_between
    });
    
    // Use Python scraper with --scrape-all
    const scraperArgs = ['--scrape-all', '--delay', delay_between.toString()];
    
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scraperPath = path.join(__dirname, '../../scraper/main.py');
    
    const bulkProcess = spawn(pythonPath, [scraperPath, ...scraperArgs], {
      cwd: path.join(__dirname, '../../scraper'),
      env: {
        ...process.env,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
        MONGODB_URI: process.env.MONGODB_URI
      },
      detached: false
    });
    
    // Store the bulk process
    activeScrapingProcesses.set(bulkProcessId, {
      process: bulkProcess,
      startTime: new Date(),
      type: 'bulk',
      universitiesCount: universitiesToScrape.length
    });
    
    let scraperOutput = '';
    let scraperError = '';
    
    bulkProcess.stdout.on('data', (data) => {
      scraperOutput += data.toString();
      // Log progress periodically
      if (scraperOutput.length % 1000 === 0) {
        logger.info('Bulk scraping progress', { processId: bulkProcessId, outputLength: scraperOutput.length });
      }
    });
    
    bulkProcess.stderr.on('data', (data) => {
      scraperError += data.toString();
    });
    
    bulkProcess.on('close', (code) => {
      activeScrapingProcesses.delete(bulkProcessId);
      
      if (code === 0) {
        logger.logScraping('completed_bulk', bulkProcessId, { 
          output: scraperOutput.substring(-500) 
        });
      } else {
        logger.logScraping('failed_bulk', bulkProcessId, { 
          error: scraperError.substring(0, 500) 
        });
      }
    });
    
    bulkProcess.on('error', (error) => {
      activeScrapingProcesses.delete(bulkProcessId);
      logger.logScraping('error_bulk', bulkProcessId, { error: error.message });
    });
    
    res.json({
      status: 'success',
      message: 'Bulk scraping started successfully',
      data: {
        processId: bulkProcessId,
        universitiesCount: universitiesToScrape.length,
        estimatedDuration: universitiesToScrape.length * delay_between / 60, // minutes
        status: 'scraping',
        startTime: new Date().toISOString(),
        universities: universitiesToScrape.map(u => ({
          id: u._id,
          name: u.name,
          priority: u.scraping_priority
        }))
      }
    });
    
  } catch (error) {
    logger.error('Error starting bulk scraping', error);
    return next(new AppError('Failed to start bulk scraping process', 500));
  }
}));

// @route   GET /api/scrape/active
// @desc    Get all active scraping processes
// @access  Public
router.get('/active', catchAsync(async (req, res) => {
  const activeProcesses = [];
  
  for (const [processId, processInfo] of activeScrapingProcesses.entries()) {
    activeProcesses.push({
      processId,
      type: processInfo.type || 'single',
      universityName: processInfo.universityName || null,
      universitiesCount: processInfo.universitiesCount || 1,
      startTime: processInfo.startTime,
      duration: new Date() - processInfo.startTime,
      isRunning: !processInfo.process.killed
    });
  }
  
  res.json({
    status: 'success',
    data: {
      activeProcessCount: activeProcesses.length,
      processes: activeProcesses
    }
  });
}));

// @route   POST /api/scrape/stop-all
// @desc    Stop all active scraping processes
// @access  Private
router.post('/stop-all', catchAsync(async (req, res) => {
  const stoppedProcesses = [];
  
  for (const [processId, processInfo] of activeScrapingProcesses.entries()) {
    try {
      processInfo.process.kill('SIGTERM');
      stoppedProcesses.push({
        processId,
        universityName: processInfo.universityName || 'Bulk Process',
        duration: new Date() - processInfo.startTime
      });
    } catch (error) {
      logger.error(`Error stopping process ${processId}:`, error);
    }
  }
  
  // Clear all active processes
  activeScrapingProcesses.clear();
  
  // Update any universities that were being scraped
  await University.updateMany(
    { scraping_status: 'scraping' },
    { 
      scraping_status: 'paused',
      $push: {
        scraping_history: {
          status: 'partial',
          timestamp: new Date(),
          error_message: 'Stopped by admin'
        }
      }
    }
  );
  
  logger.logScraping('stopped_all', 'admin', { 
    processesCount: stoppedProcesses.length 
  });
  
  res.json({
    status: 'success',
    message: `Stopped ${stoppedProcesses.length} scraping processes`,
    data: {
      stoppedProcesses
    }
  });
}));

// @route   GET /api/scrape/queue
// @desc    Get scraping queue (universities pending scraping)
// @access  Public
router.get('/queue', catchAsync(async (req, res) => {
  const queuedUniversities = await University.getScrapingQueue(50);
  
  res.json({
    status: 'success',
    data: {
      queueLength: queuedUniversities.length,
      universities: queuedUniversities.map(u => ({
        id: u._id,
        name: u.name,
        city: u.city,
        type: u.type,
        scraping_status: u.scraping_status,
        scraping_priority: u.scraping_priority,
        last_scraped: u.last_scraped,
        data_completeness: u.data_completeness
      }))
    }
  });
}));

// @route   POST /api/scrape/validate-environment
// @desc    Validate scraping environment and dependencies
// @access  Private
router.post('/validate-environment', catchAsync(async (req, res) => {
  const validationResults = {
    python_available: false,
    scraper_accessible: false,
    claude_api_configured: false,
    mongodb_connected: false,
    dependencies_installed: false
  };
  
  try {
    // Check Python availability
    await new Promise((resolve, reject) => {
      exec('python3 --version', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          validationResults.python_available = true;
          resolve(stdout);
        }
      });
    });
  } catch (error) {
    // Python not available
  }
  
  // Check scraper file
  const scraperPath = path.join(__dirname, '../../scraper/main.py');
  try {
    require('fs').accessSync(scraperPath);
    validationResults.scraper_accessible = true;
  } catch (error) {
    // Scraper not accessible
  }
  
  // Check Claude API key
  validationResults.claude_api_configured = !!process.env.CLAUDE_API_KEY;
  
  // Check MongoDB connection
  const mongoose = require('mongoose');
  validationResults.mongodb_connected = mongoose.connection.readyState === 1;
  
  const allValid = Object.values(validationResults).every(result => result === true);
  
  res.json({
    status: allValid ? 'success' : 'warning',
    message: allValid ? 'Environment validation passed' : 'Some validation checks failed',
    data: {
      isValid: allValid,
      checks: validationResults,
      recommendations: allValid ? [] : [
        !validationResults.python_available && 'Install Python 3.8+',
        !validationResults.scraper_accessible && 'Ensure scraper files are present',
        !validationResults.claude_api_configured && 'Set CLAUDE_API_KEY environment variable',
        !validationResults.mongodb_connected && 'Check MongoDB connection'
      ].filter(Boolean)
    }
  });
}));

module.exports = router; 
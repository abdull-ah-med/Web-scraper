const express = require('express');
const Joi = require('joi');
const University = require('../models/University');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../services/logger');

const router = express.Router();

// Validation schemas
const createUniversitySchema = Joi.object({
  name: Joi.string().required().min(2).max(200),
  url: Joi.string().uri().required(),
  city: Joi.string().required().min(2).max(100),
  type: Joi.string().valid('public', 'private').default('public'),
  country: Joi.string().default('Pakistan'),
  contact_info: Joi.object({
    phone: Joi.string(),
    email: Joi.string().email(),
    address: Joi.string()
  }).default({}),
  programs_offered: Joi.array().items(Joi.string()).default([]),
  description: Joi.string().max(1000),
  keywords: Joi.array().items(Joi.string()).default([]),
  scraping_priority: Joi.number().min(1).max(10).default(5)
});

const updateUniversitySchema = Joi.object({
  name: Joi.string().min(2).max(200),
  url: Joi.string().uri(),
  city: Joi.string().min(2).max(100),
  type: Joi.string().valid('public', 'private'),
  country: Joi.string(),
  contact_info: Joi.object({
    phone: Joi.string(),
    email: Joi.string().email(),
    address: Joi.string()
  }),
  programs_offered: Joi.array().items(Joi.string()),
  description: Joi.string().max(1000),
  keywords: Joi.array().items(Joi.string()),
  scraping_priority: Joi.number().min(1).max(10),
  is_active: Joi.boolean()
});

// Helper function to build query filters
const buildQueryFilters = (queryParams) => {
  const filters = { is_active: true };
  
  if (queryParams.city) {
    filters.city = new RegExp(queryParams.city, 'i');
  }
  
  if (queryParams.type) {
    filters.type = queryParams.type;
  }
  
  if (queryParams.country) {
    filters.country = new RegExp(queryParams.country, 'i');
  }
  
  if (queryParams.scraping_status) {
    filters.scraping_status = queryParams.scraping_status;
  }
  
  if (queryParams.search) {
    filters.$text = { $search: queryParams.search };
  }
  
  if (queryParams.has_data === 'true') {
    filters.$or = [
      { 'data.admission_dates.0': { $exists: true } },
      { 'data.criteria.0': { $exists: true } },
      { 'data.fee_structure.0': { $exists: true } },
      { 'data.scholarships.0': { $exists: true } }
    ];
  }
  
  return filters;
};

// Helper function for pagination
const buildPaginationOptions = (queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = Math.min(parseInt(queryParams.limit) || 20, 100); // Max 100 per page
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

// @route   GET /api/universities
// @desc    Get all universities with filtering and pagination
// @access  Public
router.get('/', catchAsync(async (req, res) => {
  const filters = buildQueryFilters(req.query);
  const { page, limit, skip } = buildPaginationOptions(req.query);
  
  // Build sort options
  let sortOptions = {};
  if (req.query.sort) {
    const sortFields = req.query.sort.split(',');
    sortFields.forEach(field => {
      if (field.startsWith('-')) {
        sortOptions[field.substring(1)] = -1;
      } else {
        sortOptions[field] = 1;
      }
    });
  } else {
    sortOptions = { name: 1 }; // Default sort by name
  }
  
  // Execute query
  const [universities, totalCount] = await Promise.all([
    University.find(filters)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    University.countDocuments(filters)
  ]);
  
  logger.logDatabase('READ', 'universities', { 
    count: universities.length, 
    filters: Object.keys(filters),
    page
  });
  
  res.json({
    status: 'success',
    results: universities.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    },
    data: universities
  });
}));

// @route   GET /api/universities/:id
// @desc    Get university by ID
// @access  Public
router.get('/:id', catchAsync(async (req, res, next) => {
  const university = await University.findById(req.params.id);
  
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  logger.logDatabase('READ', 'universities', { universityId: req.params.id });
  
  res.json({
    status: 'success',
    data: university
  });
}));

// @route   POST /api/universities
// @desc    Create new university
// @access  Private (for now, could add authentication later)
router.post('/', catchAsync(async (req, res, next) => {
  // Validate request body
  const { error, value } = createUniversitySchema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  
  // Check if university with same name or URL already exists
  const existingUniversity = await University.findOne({
    $or: [
      { name: value.name },
      { url: value.url }
    ]
  });
  
  if (existingUniversity) {
    return next(new AppError('University with this name or URL already exists', 409));
  }
  
  // Create university
  const university = await University.create(value);
  
  logger.logDatabase('CREATE', 'universities', { 
    universityId: university._id,
    name: university.name 
  });
  
  res.status(201).json({
    status: 'success',
    message: 'University created successfully',
    data: university
  });
}));

// @route   PUT /api/universities/:id
// @desc    Update university
// @access  Private
router.put('/:id', catchAsync(async (req, res, next) => {
  // Validate request body
  const { error, value } = updateUniversitySchema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  
  // Check if university exists
  const university = await University.findById(req.params.id);
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  // Check for duplicate name/URL (excluding current university)
  if (value.name || value.url) {
    const duplicateQuery = { _id: { $ne: req.params.id } };
    
    if (value.name && value.url) {
      duplicateQuery.$or = [{ name: value.name }, { url: value.url }];
    } else if (value.name) {
      duplicateQuery.name = value.name;
    } else if (value.url) {
      duplicateQuery.url = value.url;
    }
    
    const existingUniversity = await University.findOne(duplicateQuery);
    if (existingUniversity) {
      return next(new AppError('University with this name or URL already exists', 409));
    }
  }
  
  // Update university
  const updatedUniversity = await University.findByIdAndUpdate(
    req.params.id,
    value,
    { new: true, runValidators: true }
  );
  
  logger.logDatabase('UPDATE', 'universities', { 
    universityId: req.params.id,
    updatedFields: Object.keys(value)
  });
  
  res.json({
    status: 'success',
    message: 'University updated successfully',
    data: updatedUniversity
  });
}));

// @route   DELETE /api/universities/:id
// @desc    Delete university (soft delete by setting is_active to false)
// @access  Private
router.delete('/:id', catchAsync(async (req, res, next) => {
  const university = await University.findById(req.params.id);
  
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  // Soft delete by setting is_active to false
  await University.findByIdAndUpdate(req.params.id, { is_active: false });
  
  logger.logDatabase('SOFT_DELETE', 'universities', { universityId: req.params.id });
  
  res.status(204).json({
    status: 'success',
    message: 'University deleted successfully'
  });
}));

// @route   GET /api/universities/:id/data
// @desc    Get only the scraped data for a university
// @access  Public
router.get('/:id/data', catchAsync(async (req, res, next) => {
  const university = await University.findById(req.params.id).select('name url data data_last_updated');
  
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  res.json({
    status: 'success',
    data: {
      university: {
        id: university._id,
        name: university.name,
        url: university.url
      },
      data: university.data,
      data_last_updated: university.data_last_updated,
      data_completeness: university.data_completeness
    }
  });
}));

// @route   GET /api/universities/:id/history
// @desc    Get scraping history for a university
// @access  Public
router.get('/:id/history', catchAsync(async (req, res, next) => {
  const university = await University.findById(req.params.id).select('name scraping_history');
  
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  res.json({
    status: 'success',
    data: {
      university: {
        id: university._id,
        name: university.name
      },
      scraping_history: university.scraping_history
    }
  });
}));

// @route   PATCH /api/universities/:id/priority
// @desc    Update scraping priority for a university
// @access  Private
router.patch('/:id/priority', catchAsync(async (req, res, next) => {
  const { priority } = req.body;
  
  if (!priority || priority < 1 || priority > 10) {
    return next(new AppError('Priority must be a number between 1 and 10', 400));
  }
  
  const university = await University.findByIdAndUpdate(
    req.params.id,
    { scraping_priority: priority },
    { new: true, runValidators: true }
  );
  
  if (!university) {
    return next(new AppError('University not found', 404));
  }
  
  logger.logDatabase('UPDATE', 'universities', { 
    universityId: req.params.id,
    newPriority: priority
  });
  
  res.json({
    status: 'success',
    message: 'Scraping priority updated successfully',
    data: {
      university: university.name,
      scraping_priority: university.scraping_priority
    }
  });
}));

// @route   GET /api/universities/stats/overview
// @desc    Get overview statistics for universities
// @access  Public
router.get('/stats/overview', catchAsync(async (req, res) => {
  const [
    totalCount,
    activeCount,
    publicCount,
    privateCount,
    statusCounts,
    cityCounts,
    recentlyScraped
  ] = await Promise.all([
    University.countDocuments(),
    University.countDocuments({ is_active: true }),
    University.countDocuments({ type: 'public', is_active: true }),
    University.countDocuments({ type: 'private', is_active: true }),
    University.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$scraping_status', count: { $sum: 1 } } }
    ]),
    University.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    University.find({ is_active: true, last_scraped: { $ne: null } })
      .sort({ last_scraped: -1 })
      .limit(5)
      .select('name last_scraped scraping_status')
  ]);
  
  const statusMap = {};
  statusCounts.forEach(item => {
    statusMap[item._id] = item.count;
  });
  
  res.json({
    status: 'success',
    data: {
      totals: {
        total: totalCount,
        active: activeCount,
        public: publicCount,
        private: privateCount
      },
      scraping_status: {
        pending: statusMap.pending || 0,
        scraping: statusMap.scraping || 0,
        completed: statusMap.completed || 0,
        failed: statusMap.failed || 0,
        paused: statusMap.paused || 0
      },
      top_cities: cityCounts,
      recently_scraped: recentlyScraped
    }
  });
}));

module.exports = router; 
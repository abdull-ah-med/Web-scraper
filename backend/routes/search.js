const express = require('express');
const University = require('../models/University');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../services/logger');

const router = express.Router();

const buildPaginationOptions = (queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

router.get('/universities', catchAsync(async (req, res) => {
  const { q, city, type, country, min_completeness } = req.query;
  const { page, limit, skip } = buildPaginationOptions(req.query);
  
  const searchQuery = { is_active: true };
  
  if (q) {
    searchQuery.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { keywords: { $regex: q, $options: 'i' } },
      { 'programs_offered': { $regex: q, $options: 'i' } }
    ];
  }
  
  // Filter by city
  if (city) {
    searchQuery.city = { $regex: city, $options: 'i' };
  }
  
  // Filter by type
  if (type && ['public', 'private'].includes(type)) {
    searchQuery.type = type;
  }
  
  // Filter by country
  if (country) {
    searchQuery.country = { $regex: country, $options: 'i' };
  }
  
  let aggregationPipeline = [
    { $match: searchQuery }
  ];
  
  // Add data completeness filter if specified
  if (min_completeness) {
    const minScore = parseInt(min_completeness);
    if (minScore >= 0 && minScore <= 100) {
      aggregationPipeline.push({
        $addFields: {
          data_completeness_score: {
            $add: [
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$data.admission_dates", []] } }, 0] }, 25, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$data.criteria", []] } }, 0] }, 25, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$data.fee_structure", []] } }, 0] }, 25, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ["$data.scholarships", []] } }, 0] }, 25, 0] }
            ]
          }
        }
      });
      
      aggregationPipeline.push({
        $match: { data_completeness_score: { $gte: minScore } }
      });
    }
  }
  
  // Add sorting
  aggregationPipeline.push({
    $sort: { name: 1 }
  });
  
  // Execute aggregation for total count
  const countPipeline = [...aggregationPipeline, { $count: "total" }];
  const [countResult] = await University.aggregate(countPipeline);
  const totalCount = countResult ? countResult.total : 0;
  
  // Add pagination
  aggregationPipeline.push(
    { $skip: skip },
    { $limit: limit }
  );
  
  const universities = await University.aggregate(aggregationPipeline);
  
  logger.info('University search performed', {
    query: q,
    filters: { city, type, country, min_completeness },
    results: universities.length,
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

// @route   GET /api/search/programs
// @desc    Search programs across all universities
// @access  Public
router.get('/programs', catchAsync(async (req, res) => {
  const { q, city, type, university } = req.query;
  const { page, limit, skip } = buildPaginationOptions(req.query);
  
  // Build match query
  const matchQuery = { is_active: true };
  
  if (city) {
    matchQuery.city = { $regex: city, $options: 'i' };
  }
  
  if (type && ['public', 'private'].includes(type)) {
    matchQuery.type = type;
  }
  
  if (university) {
    matchQuery.name = { $regex: university, $options: 'i' };
  }
  
  // Build aggregation pipeline
  let pipeline = [
    { $match: matchQuery },
    { $unwind: "$programs_offered" }
  ];
  
  // Add program name filter
  if (q) {
    pipeline.push({
      $match: {
        programs_offered: { $regex: q, $options: 'i' }
      }
    });
  }
  
  // Group by program to get universities offering each program
  pipeline.push({
    $group: {
      _id: "$programs_offered",
      universities: {
        $push: {
          id: "$_id",
          name: "$name",
          city: "$city",
          type: "$type",
          url: "$url"
        }
      },
      university_count: { $sum: 1 }
    }
  });
  
  // Sort by university count (most popular programs first)
  pipeline.push({
    $sort: { university_count: -1, _id: 1 }
  });
  
  // Get total count
  const countPipeline = [...pipeline, { $count: "total" }];
  const [countResult] = await University.aggregate(countPipeline);
  const totalCount = countResult ? countResult.total : 0;
  
  // Add pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  );
  
  const programs = await University.aggregate(pipeline);
  
  logger.info('Program search performed', {
    query: q,
    filters: { city, type, university },
    results: programs.length,
    page
  });
  
  res.json({
    status: 'success',
    results: programs.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    },
    data: programs.map(program => ({
      program_name: program._id,
      university_count: program.university_count,
      universities: program.universities
    }))
  });
}));

// @route   GET /api/search/scholarships
// @desc    Search scholarships across all universities
// @access  Public
router.get('/scholarships', catchAsync(async (req, res) => {
  const { q, min_amount, max_amount, renewable, university, city } = req.query;
  const { page, limit, skip } = buildPaginationOptions(req.query);
  
  // Build match query
  const matchQuery = { 
    is_active: true,
    'data.scholarships': { $exists: true, $ne: [] }
  };
  
  if (city) {
    matchQuery.city = { $regex: city, $options: 'i' };
  }
  
  if (university) {
    matchQuery.name = { $regex: university, $options: 'i' };
  }
  
  // Build aggregation pipeline
  let pipeline = [
    { $match: matchQuery },
    { $unwind: "$data.scholarships" }
  ];
  
  // Build scholarship filters
  const scholarshipFilters = {};
  
  if (q) {
    scholarshipFilters.$or = [
      { 'data.scholarships.name': { $regex: q, $options: 'i' } },
      { 'data.scholarships.eligibility': { $regex: q, $options: 'i' } },
      { 'data.scholarships.coverage': { $regex: q, $options: 'i' } }
    ];
  }
  
  if (renewable !== undefined) {
    scholarshipFilters['data.scholarships.renewable'] = renewable === 'true';
  }
  
  // Amount filtering is complex due to string format, so we'll do basic filtering
  if (min_amount || max_amount) {
    // This is a simplified filter - in practice, you'd want to parse amounts properly
    if (min_amount) {
      scholarshipFilters['data.scholarships.amount'] = { 
        $regex: new RegExp(`\\b([${min_amount.charAt(0)}-9]\\d*)`, 'i')
      };
    }
  }
  
  if (Object.keys(scholarshipFilters).length > 0) {
    pipeline.push({ $match: scholarshipFilters });
  }
  
  // Project the results
  pipeline.push({
    $project: {
      university: {
        id: "$_id",
        name: "$name",
        city: "$city",
        type: "$type",
        url: "$url"
      },
      scholarship: "$data.scholarships"
    }
  });
  
  // Sort by scholarship name
  pipeline.push({
    $sort: { 'scholarship.name': 1 }
  });
  
  // Get total count
  const countPipeline = [...pipeline, { $count: "total" }];
  const [countResult] = await University.aggregate(countPipeline);
  const totalCount = countResult ? countResult.total : 0;
  
  // Add pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  );
  
  const scholarships = await University.aggregate(pipeline);
  
  logger.info('Scholarship search performed', {
    query: q,
    filters: { min_amount, max_amount, renewable, university, city },
    results: scholarships.length,
    page
  });
  
  res.json({
    status: 'success',
    results: scholarships.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    },
    data: scholarships
  });
}));

// @route   GET /api/search/admission-dates
// @desc    Search upcoming admission dates
// @access  Public
router.get('/admission-dates', catchAsync(async (req, res) => {
  const { term, type_filter, university, city, upcoming_only } = req.query;
  const { page, limit, skip } = buildPaginationOptions(req.query);
  
  // Build match query
  const matchQuery = { 
    is_active: true,
    'data.admission_dates': { $exists: true, $ne: [] }
  };
  
  if (city) {
    matchQuery.city = { $regex: city, $options: 'i' };
  }
  
  if (university) {
    matchQuery.name = { $regex: university, $options: 'i' };
  }
  
  // Build aggregation pipeline
  let pipeline = [
    { $match: matchQuery },
    { $unwind: "$data.admission_dates" }
  ];
  
  // Build admission date filters
  const dateFilters = {};
  
  if (term) {
    dateFilters['data.admission_dates.term'] = { $regex: term, $options: 'i' };
  }
  
  if (type_filter) {
    dateFilters['data.admission_dates.type'] = type_filter;
  }
  
  if (upcoming_only === 'true') {
    dateFilters['data.admission_dates.deadline'] = { $gte: new Date() };
  }
  
  if (Object.keys(dateFilters).length > 0) {
    pipeline.push({ $match: dateFilters });
  }
  
  // Project the results
  pipeline.push({
    $project: {
      university: {
        id: "$_id",
        name: "$name",
        city: "$city",
        type: "$type",
        url: "$url"
      },
      admission_date: "$data.admission_dates"
    }
  });
  
  // Sort by deadline
  pipeline.push({
    $sort: { 'admission_date.deadline': 1 }
  });
  
  // Get total count
  const countPipeline = [...pipeline, { $count: "total" }];
  const [countResult] = await University.aggregate(countPipeline);
  const totalCount = countResult ? countResult.total : 0;
  
  // Add pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  );
  
  const admissionDates = await University.aggregate(pipeline);
  
  logger.info('Admission dates search performed', {
    filters: { term, type_filter, university, city, upcoming_only },
    results: admissionDates.length,
    page
  });
  
  res.json({
    status: 'success',
    results: admissionDates.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    },
    data: admissionDates
  });
}));

// @route   GET /api/search/fees
// @desc    Search fee structures across universities
// @access  Public
router.get('/fees', catchAsync(async (req, res) => {
  const { program, max_fee, university, city, type } = req.query;
  const { page, limit, skip } = buildPaginationOptions(req.query);
  
  // Build match query
  const matchQuery = { 
    is_active: true,
    'data.fee_structure': { $exists: true, $ne: [] }
  };
  
  if (city) {
    matchQuery.city = { $regex: city, $options: 'i' };
  }
  
  if (university) {
    matchQuery.name = { $regex: university, $options: 'i' };
  }
  
  if (type && ['public', 'private'].includes(type)) {
    matchQuery.type = type;
  }
  
  // Build aggregation pipeline
  let pipeline = [
    { $match: matchQuery },
    { $unwind: "$data.fee_structure" }
  ];
  
  // Build fee filters
  const feeFilters = {};
  
  if (program) {
    feeFilters['data.fee_structure.program'] = { $regex: program, $options: 'i' };
  }
  
  // Note: Fee filtering by amount would require proper parsing of fee strings
  // This is a simplified version
  if (max_fee) {
    // Basic filter - in practice, you'd want to parse and compare numeric values
    feeFilters['data.fee_structure.total_per_semester'] = { 
      $not: { $regex: new RegExp(`\\b([${parseInt(max_fee) + 1}-9]\\d{4,})`, 'i') }
    };
  }
  
  if (Object.keys(feeFilters).length > 0) {
    pipeline.push({ $match: feeFilters });
  }
  
  // Project the results
  pipeline.push({
    $project: {
      university: {
        id: "$_id",
        name: "$name",
        city: "$city",
        type: "$type",
        url: "$url"
      },
      fee_structure: "$data.fee_structure"
    }
  });
  
  // Sort by program name
  pipeline.push({
    $sort: { 'fee_structure.program': 1 }
  });
  
  // Get total count
  const countPipeline = [...pipeline, { $count: "total" }];
  const [countResult] = await University.aggregate(countPipeline);
  const totalCount = countResult ? countResult.total : 0;
  
  // Add pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  );
  
  const fees = await University.aggregate(pipeline);
  
  logger.info('Fee structure search performed', {
    filters: { program, max_fee, university, city, type },
    results: fees.length,
    page
  });
  
  res.json({
    status: 'success',
    results: fees.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalResults: totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    },
    data: fees
  });
}));

module.exports = router; 
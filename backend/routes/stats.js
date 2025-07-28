const express = require('express');
const University = require('../models/University');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../services/logger');

const router = express.Router();

// @route   GET /api/stats/overview
// @desc    Get system overview statistics
// @access  Public
router.get('/overview', catchAsync(async (req, res) => {
  const [
    totalUniversities,
    activeUniversities,
    universitiesWithData,
    recentlyScraped,
    scrapingStatusCounts,
    dataTypeCounts
  ] = await Promise.all([
    University.countDocuments(),
    University.countDocuments({ is_active: true }),
    University.countDocuments({
      is_active: true,
      $or: [
        { 'data.admission_dates.0': { $exists: true } },
        { 'data.criteria.0': { $exists: true } },
        { 'data.fee_structure.0': { $exists: true } },
        { 'data.scholarships.0': { $exists: true } }
      ]
    }),
    University.countDocuments({
      is_active: true,
      last_scraped: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }),
    University.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$scraping_status', count: { $sum: 1 } } }
    ]),
    University.aggregate([
      { $match: { is_active: true } },
      {
        $project: {
          has_admission_dates: { $gt: [{ $size: { $ifNull: ['$data.admission_dates', []] } }, 0] },
          has_criteria: { $gt: [{ $size: { $ifNull: ['$data.criteria', []] } }, 0] },
          has_fee_structure: { $gt: [{ $size: { $ifNull: ['$data.fee_structure', []] } }, 0] },
          has_scholarships: { $gt: [{ $size: { $ifNull: ['$data.scholarships', []] } }, 0] }
        }
      },
      {
        $group: {
          _id: null,
          admission_dates: { $sum: { $cond: ['$has_admission_dates', 1, 0] } },
          criteria: { $sum: { $cond: ['$has_criteria', 1, 0] } },
          fee_structure: { $sum: { $cond: ['$has_fee_structure', 1, 0] } },
          scholarships: { $sum: { $cond: ['$has_scholarships', 1, 0] } }
        }
      }
    ])
  ]);
  
  // Convert scraping status counts to object
  const statusMap = {};
  scrapingStatusCounts.forEach(item => {
    statusMap[item._id] = item.count;
  });
  
  const dataTypes = dataTypeCounts[0] || {
    admission_dates: 0,
    criteria: 0,
    fee_structure: 0,
    scholarships: 0
  };
  
  res.json({
    status: 'success',
    data: {
      universities: {
        total: totalUniversities,
        active: activeUniversities,
        with_data: universitiesWithData,
        recently_scraped: recentlyScraped,
        data_coverage: ((universitiesWithData / activeUniversities) * 100).toFixed(2)
      },
      scraping_status: {
        pending: statusMap.pending || 0,
        scraping: statusMap.scraping || 0,
        completed: statusMap.completed || 0,
        failed: statusMap.failed || 0,
        paused: statusMap.paused || 0
      },
      data_types: {
        admission_dates: dataTypes.admission_dates,
        criteria: dataTypes.criteria,
        fee_structure: dataTypes.fee_structure,
        scholarships: dataTypes.scholarships
      },
      system: {
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      }
    }
  });
}));

// @route   GET /api/stats/universities
// @desc    Get detailed university statistics
// @access  Public
router.get('/universities', catchAsync(async (req, res) => {
  const [
    cityDistribution,
    typeDistribution,
    completenessDistribution,
    topUniversitiesByData,
    scrapingHistory
  ] = await Promise.all([
    // City distribution
    University.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    
    // Type distribution
    University.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    
    // Data completeness distribution
    University.aggregate([
      { $match: { is_active: true } },
      {
        $addFields: {
          completeness_score: {
            $add: [
              { $cond: [{ $gt: [{ $size: { $ifNull: ['$data.admission_dates', []] } }, 0] }, 25, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ['$data.criteria', []] } }, 0] }, 25, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ['$data.fee_structure', []] } }, 0] }, 25, 0] },
              { $cond: [{ $gt: [{ $size: { $ifNull: ['$data.scholarships', []] } }, 0] }, 25, 0] }
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$completeness_score',
          boundaries: [0, 25, 50, 75, 100, 101],
          default: 'other',
          output: { count: { $sum: 1 } }
        }
      }
    ]),
    
    // Top universities by data volume
    University.aggregate([
      { $match: { is_active: true } },
      {
        $addFields: {
          total_data_items: {
            $add: [
              { $size: { $ifNull: ['$data.admission_dates', []] } },
              { $size: { $ifNull: ['$data.criteria', []] } },
              { $size: { $ifNull: ['$data.fee_structure', []] } },
              { $size: { $ifNull: ['$data.scholarships', []] } }
            ]
          }
        }
      },
      { $match: { total_data_items: { $gt: 0 } } },
      { $sort: { total_data_items: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          city: 1,
          type: 1,
          total_data_items: 1,
          last_scraped: 1
        }
      }
    ]),
    
    // Recent scraping activity
    University.aggregate([
      { $match: { is_active: true, last_scraped: { $ne: null } } },
      {
        $project: {
          name: 1,
          last_scraped: 1,
          scraping_status: 1,
          day: { $dateToString: { format: '%Y-%m-%d', date: '$last_scraped' } }
        }
      },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 7 } // Last 7 days
    ])
  ]);
  
  res.json({
    status: 'success',
    data: {
      city_distribution: cityDistribution,
      type_distribution: typeDistribution,
      completeness_distribution: completenessDistribution.map(bucket => ({
        range: `${bucket._id}-${bucket._id + 24}%`,
        count: bucket.count
      })),
      top_universities_by_data: topUniversitiesByData,
      recent_scraping_activity: scrapingHistory
    }
  });
}));

// @route   GET /api/stats/scraping
// @desc    Get scraping performance statistics
// @access  Public
router.get('/scraping', catchAsync(async (req, res) => {
  const [
    successRateStats,
    averageScrapingTimes,
    errorAnalysis,
    dataExtractionStats,
    priorityDistribution
  ] = await Promise.all([
    // Success rate statistics
    University.aggregate([
      { $match: { is_active: true, scraping_history: { $exists: true, $ne: [] } } },
      { $unwind: '$scraping_history' },
      {
        $group: {
          _id: '$scraping_history.status',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Average scraping times (simplified - would need more detailed tracking)
    University.aggregate([
      { $match: { is_active: true, last_scraped: { $ne: null } } },
      {
        $group: {
          _id: null,
          avg_time_between_scrapes: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$last_scraped'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        }
      }
    ]),
    
    // Error analysis
    University.aggregate([
      { $match: { is_active: true, scraping_history: { $exists: true } } },
      { $unwind: '$scraping_history' },
      { $match: { 'scraping_history.status': 'failed', 'scraping_history.error_message': { $ne: null } } },
      {
        $group: {
          _id: {
            $substr: ['$scraping_history.error_message', 0, 50] // First 50 chars of error
          },
          count: { $sum: 1 },
          recent_occurrence: { $max: '$scraping_history.timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    
    // Data extraction statistics
    University.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: null,
          total_admission_dates: { $sum: { $size: { $ifNull: ['$data.admission_dates', []] } } },
          total_criteria: { $sum: { $size: { $ifNull: ['$data.criteria', []] } } },
          total_fee_structures: { $sum: { $size: { $ifNull: ['$data.fee_structure', []] } } },
          total_scholarships: { $sum: { $size: { $ifNull: ['$data.scholarships', []] } } },
          avg_admission_dates_per_uni: { $avg: { $size: { $ifNull: ['$data.admission_dates', []] } } },
          avg_criteria_per_uni: { $avg: { $size: { $ifNull: ['$data.criteria', []] } } },
          avg_fee_structures_per_uni: { $avg: { $size: { $ifNull: ['$data.fee_structure', []] } } },
          avg_scholarships_per_uni: { $avg: { $size: { $ifNull: ['$data.scholarships', []] } } }
        }
      }
    ]),
    
    // Priority distribution
    University.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$scraping_priority', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ])
  ]);
  
  // Process success rate data
  const successRateMap = {};
  successRateStats.forEach(item => {
    successRateMap[item._id] = item.count;
  });
  
  const totalAttempts = Object.values(successRateMap).reduce((sum, count) => sum + count, 0);
  const successRate = totalAttempts > 0 ? 
    ((successRateMap.success || 0) / totalAttempts * 100).toFixed(2) : 0;
  
  const extractionStats = dataExtractionStats[0] || {};
  
  res.json({
    status: 'success',
    data: {
      success_rate: {
        overall_percentage: successRate,
        successful_attempts: successRateMap.success || 0,
        failed_attempts: successRateMap.failed || 0,
        partial_attempts: successRateMap.partial || 0,
        total_attempts: totalAttempts
      },
      performance: {
        average_days_since_last_scrape: averageScrapingTimes[0]?.avg_time_between_scrapes?.toFixed(2) || 0
      },
      common_errors: errorAnalysis.map(error => ({
        error_snippet: error._id,
        occurrence_count: error.count,
        last_seen: error.recent_occurrence
      })),
      data_extraction: {
        totals: {
          admission_dates: extractionStats.total_admission_dates || 0,
          criteria: extractionStats.total_criteria || 0,
          fee_structures: extractionStats.total_fee_structures || 0,
          scholarships: extractionStats.total_scholarships || 0
        },
        averages_per_university: {
          admission_dates: (extractionStats.avg_admission_dates_per_uni || 0).toFixed(2),
          criteria: (extractionStats.avg_criteria_per_uni || 0).toFixed(2),
          fee_structures: (extractionStats.avg_fee_structures_per_uni || 0).toFixed(2),
          scholarships: (extractionStats.avg_scholarships_per_uni || 0).toFixed(2)
        }
      },
      priority_distribution: priorityDistribution
    }
  });
}));

// @route   GET /api/stats/data-freshness
// @desc    Get data freshness statistics
// @access  Public
router.get('/data-freshness', catchAsync(async (req, res) => {
  const now = new Date();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  
  const [
    dataAgeCounts,
    stalestUniversities,
    newestUniversities
  ] = await Promise.all([
    // Data age distribution
    University.aggregate([
      { $match: { is_active: true } },
      {
        $project: {
          name: 1,
          last_scraped: 1,
          age_category: {
            $switch: {
              branches: [
                { case: { $gte: ['$last_scraped', oneDayAgo] }, then: 'very_fresh' },
                { case: { $gte: ['$last_scraped', oneWeekAgo] }, then: 'fresh' },
                { case: { $gte: ['$last_scraped', oneMonthAgo] }, then: 'moderate' },
                { case: { $ne: ['$last_scraped', null] }, then: 'stale' }
              ],
              default: 'never_scraped'
            }
          }
        }
      },
      {
        $group: {
          _id: '$age_category',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Universities with stalest data
    University.find({
      is_active: true,
      last_scraped: { $ne: null }
    })
      .sort({ last_scraped: 1 })
      .limit(10)
      .select('name city last_scraped scraping_status'),
    
    // Universities with newest data
    University.find({
      is_active: true,
      last_scraped: { $ne: null }
    })
      .sort({ last_scraped: -1 })
      .limit(10)
      .select('name city last_scraped scraping_status')
  ]);
  
  const ageCounts = {};
  dataAgeCounts.forEach(item => {
    ageCounts[item._id] = item.count;
  });
  
  res.json({
    status: 'success',
    data: {
      data_age_distribution: {
        very_fresh: ageCounts.very_fresh || 0, // < 1 day
        fresh: ageCounts.fresh || 0, // 1-7 days
        moderate: ageCounts.moderate || 0, // 7-30 days
        stale: ageCounts.stale || 0, // > 30 days
        never_scraped: ageCounts.never_scraped || 0
      },
      stalest_universities: stalestUniversities,
      newest_universities: newestUniversities,
      recommendations: {
        need_immediate_scraping: ageCounts.never_scraped || 0,
        need_refresh: (ageCounts.stale || 0) + (ageCounts.moderate || 0),
        up_to_date: (ageCounts.very_fresh || 0) + (ageCounts.fresh || 0)
      }
    }
  });
}));

// @route   GET /api/stats/search-analytics
// @desc    Get search and usage analytics
// @access  Public
router.get('/search-analytics', catchAsync(async (req, res) => {
  const [
    mostSearchedPrograms,
    popularScholarships,
    upcomingDeadlines,
    feeRangeDistribution
  ] = await Promise.all([
    // Most offered programs
    University.aggregate([
      { $match: { is_active: true, programs_offered: { $exists: true, $ne: [] } } },
      { $unwind: '$programs_offered' },
      { $group: { _id: '$programs_offered', universities_count: { $sum: 1 } } },
      { $sort: { universities_count: -1 } },
      { $limit: 15 }
    ]),
    
    // Most common scholarships
    University.aggregate([
      { $match: { is_active: true, 'data.scholarships': { $exists: true, $ne: [] } } },
      { $unwind: '$data.scholarships' },
      {
        $group: {
          _id: '$data.scholarships.name',
          universities_count: { $sum: 1 },
          total_amount: { $first: '$data.scholarships.amount' }
        }
      },
      { $sort: { universities_count: -1 } },
      { $limit: 10 }
    ]),
    
    // Upcoming admission deadlines
    University.aggregate([
      { $match: { is_active: true, 'data.admission_dates': { $exists: true, $ne: [] } } },
      { $unwind: '$data.admission_dates' },
      { $match: { 'data.admission_dates.deadline': { $gte: new Date() } } },
      { $sort: { 'data.admission_dates.deadline': 1 } },
      { $limit: 20 },
      {
        $project: {
          university_name: '$name',
          program: '$data.admission_dates.program',
          deadline: '$data.admission_dates.deadline',
          term: '$data.admission_dates.term',
          type: '$data.admission_dates.type'
        }
      }
    ]),
    
    // Fee range distribution (simplified)
    University.aggregate([
      { $match: { is_active: true, 'data.fee_structure': { $exists: true, $ne: [] } } },
      { $unwind: '$data.fee_structure' },
      {
        $project: {
          program: '$data.fee_structure.program',
          fee_category: {
            $switch: {
              branches: [
                { 
                  case: { $regexMatch: { input: '$data.fee_structure.total_per_semester', regex: /^[0-9]{1,3},?[0-9]{0,3}$/ } },
                  then: 'low' 
                },
                { 
                  case: { $regexMatch: { input: '$data.fee_structure.total_per_semester', regex: /^[0-9]{1,2}[0-9]{4,}/ } },
                  then: 'medium' 
                }
              ],
              default: 'high'
            }
          }
        }
      },
      { $group: { _id: '$fee_category', count: { $sum: 1 } } }
    ])
  ]);
  
  const feeDistribution = {};
  feeRangeDistribution.forEach(item => {
    feeDistribution[item._id] = item.count;
  });
  
  res.json({
    status: 'success',
    data: {
      popular_programs: mostSearchedPrograms.map(program => ({
        program_name: program._id,
        available_at_universities: program.universities_count,
        popularity_score: Math.min(100, (program.universities_count / 8) * 100) // Normalize to 100
      })),
      popular_scholarships: popularScholarships.map(scholarship => ({
        scholarship_name: scholarship._id,
        available_at_universities: scholarship.universities_count,
        typical_amount: scholarship.total_amount
      })),
      upcoming_deadlines: upcomingDeadlines,
      fee_distribution: {
        low_cost: feeDistribution.low || 0, // < 100k
        medium_cost: feeDistribution.medium || 0, // 100k-500k
        high_cost: feeDistribution.high || 0 // > 500k
      }
    }
  });
}));

// @route   GET /api/stats/health
// @desc    Get system health metrics
// @access  Public
router.get('/health', catchAsync(async (req, res) => {
  const mongoose = require('mongoose');
  
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        connection_state: mongoose.connection.readyState
      },
      api: {
        status: 'running',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      }
    },
    environment: {
      node_version: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development'
    }
  };
  
  // Determine overall health status
  if (health.services.database.status !== 'connected') {
    health.status = 'degraded';
  }
  
  if (health.services.api.memory_usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    health.status = 'warning';
  }
  
  res.json({
    status: 'success',
    data: health
  });
}));

module.exports = router; 
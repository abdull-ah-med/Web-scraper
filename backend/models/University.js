const mongoose = require('mongoose');

// Sub-schemas for nested data
const admissionDateSchema = new mongoose.Schema({
  program: {
    type: String,
    required: true,
    trim: true
  },
  deadline: {
    type: Date,
    required: true
  },
  term: {
    type: String,
    required: true,
    enum: ['Fall 2024', 'Spring 2025', 'Summer 2024', 'Fall 2025', 'Spring 2026']
  },
  type: {
    type: String,
    required: true,
    enum: ['application', 'test', 'merit_list', 'fee', 'semester_start']
  }
}, { _id: false });

const admissionCriteriaSchema = new mongoose.Schema({
  program: {
    type: String,
    required: true,
    trim: true
  },
  min_marks: {
    type: String,
    required: true
  },
  required_tests: [{
    type: String,
    trim: true
  }],
  required_subjects: [{
    type: String,
    trim: true
  }],
  other_requirements: [{
    type: String,
    trim: true
  }]
}, { _id: false });

const feeStructureSchema = new mongoose.Schema({
  program: {
    type: String,
    required: true,
    trim: true
  },
  tuition_fee: {
    type: String,
    required: true
  },
  admission_fee: {
    type: String,
    default: 'N/A'
  },
  other_fees: {
    type: Map,
    of: String,
    default: {}
  },
  total_per_semester: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    default: 'PKR'
  }
}, { _id: false });

const scholarshipSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: String,
    required: true
  },
  eligibility: [{
    type: String,
    trim: true
  }],
  deadline: {
    type: Date,
    default: null
  },
  coverage: {
    type: String,
    trim: true
  },
  renewable: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const scrapingHistorySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    required: true
  },
  pages_scraped: {
    type: Number,
    default: 0
  },
  data_extracted: {
    admission_dates: { type: Number, default: 0 },
    criteria: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    scholarships: { type: Number, default: 0 }
  },
  error_message: {
    type: String,
    default: null
  }
}, { _id: false });

// Main University Schema
const universitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL must be a valid HTTP/HTTPS URL'
    }
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['public', 'private'],
    default: 'public'
  },
  country: {
    type: String,
    default: 'Pakistan'
  },
  
  // Scraping metadata
  scraping_status: {
    type: String,
    enum: ['pending', 'scraping', 'completed', 'failed', 'paused'],
    default: 'pending'
  },
  last_scraped: {
    type: Date,
    default: null
  },
  next_scrape_scheduled: {
    type: Date,
    default: null
  },
  scraping_priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  // University contact information
  contact_info: {
    phone: String,
    email: String,
    address: String
  },
  
  // Extracted data
  data: {
    admission_dates: [admissionDateSchema],
    criteria: [admissionCriteriaSchema],
    fee_structure: [feeStructureSchema],
    scholarships: [scholarshipSchema]
  },
  
  // Data freshness tracking
  data_last_updated: {
    admission_dates: { type: Date, default: null },
    criteria: { type: Date, default: null },
    fee_structure: { type: Date, default: null },
    scholarships: { type: Date, default: null }
  },
  
  // Scraping history and analytics
  scraping_history: [scrapingHistorySchema],
  
  // Additional metadata
  programs_offered: [{
    type: String,
    trim: true
  }],
  ranking: {
    national: Number,
    international: Number
  },
  
  // SEO and search optimization
  keywords: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true
  },
  
  // System fields
  created_by: {
    type: String,
    default: 'system'
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
universitySchema.index({ name: 'text', description: 'text', keywords: 'text' });
universitySchema.index({ city: 1, type: 1 });
universitySchema.index({ scraping_status: 1 });
universitySchema.index({ last_scraped: 1 });
universitySchema.index({ 'data.admission_dates.deadline': 1 });

// Virtual for total programs count
universitySchema.virtual('total_programs').get(function() {
  return this.programs_offered ? this.programs_offered.length : 0;
});

// Virtual for data completeness score
universitySchema.virtual('data_completeness').get(function() {
  let score = 0;
  if (this.data.admission_dates && this.data.admission_dates.length > 0) score += 25;
  if (this.data.criteria && this.data.criteria.length > 0) score += 25;
  if (this.data.fee_structure && this.data.fee_structure.length > 0) score += 25;
  if (this.data.scholarships && this.data.scholarships.length > 0) score += 25;
  return score;
});

// Methods
universitySchema.methods.updateScrapingStatus = function(status, errorMessage = null) {
  this.scraping_status = status;
  if (status === 'completed') {
    this.last_scraped = new Date();
    this.next_scrape_scheduled = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  
  // Add to scraping history
  this.scraping_history.push({
    status: status === 'completed' ? 'success' : status === 'failed' ? 'failed' : 'partial',
    error_message: errorMessage,
    data_extracted: {
      admission_dates: this.data.admission_dates ? this.data.admission_dates.length : 0,
      criteria: this.data.criteria ? this.data.criteria.length : 0,
      fees: this.data.fee_structure ? this.data.fee_structure.length : 0,
      scholarships: this.data.scholarships ? this.data.scholarships.length : 0
    }
  });
  
  // Keep only last 10 scraping history records
  if (this.scraping_history.length > 10) {
    this.scraping_history = this.scraping_history.slice(-10);
  }
  
  return this.save();
};

universitySchema.methods.addExtractedData = function(dataType, newData) {
  if (!this.data[dataType]) {
    this.data[dataType] = [];
  }
  
  // Clear existing data before adding new
  this.data[dataType] = newData;
  this.data_last_updated[dataType] = new Date();
  
  return this.save();
};

// Static methods
universitySchema.statics.findByCity = function(city) {
  return this.find({ city: new RegExp(city, 'i'), is_active: true });
};

universitySchema.statics.findByType = function(type) {
  return this.find({ type: type, is_active: true });
};

universitySchema.statics.getScrapingQueue = function(limit = 50) {
  return this.find({ 
    scraping_status: { $in: ['pending', 'failed'] }, 
    is_active: true 
  })
  .sort({ scraping_priority: -1, last_scraped: 1 })
  .limit(limit);
};

module.exports = mongoose.model('University', universitySchema); 
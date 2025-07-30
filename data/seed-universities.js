#!/usr/bin/env node
/**
 * Database Seeder for Pakistani Universities
 * Populates the MongoDB database with initial university data
 * 
 * Usage:
 *   node data/seed-universities.js
 *   node data/seed-universities.js --reset  (to clear existing data first)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models - fix the path to work from both root and backend
let University;
try {
  University = require('../backend/models/University');
} catch (e) {
  University = require('./models/University');
}

// Pakistani Universities data
const PAKISTANI_UNIVERSITIES = [
  {
    name: 'University of Punjab',
    url: 'https://www.pu.edu.pk',
    city: 'Lahore',
    type: 'public',
    description: 'The University of the Punjab, also referred to as Punjab University, is a public research university located in Lahore, Punjab, Pakistan.',
    keywords: ['public university', 'research', 'lahore', 'punjab', 'oldest university'],
    programs_offered: [
      'Bachelor of Arts', 'Bachelor of Science', 'Bachelor of Commerce',
      'Master of Arts', 'Master of Science', 'MBA', 'PhD programs',
      'Engineering', 'Medicine', 'Law', 'Education'
    ],
    contact_info: {
      phone: '+92-42-99231581',
      email: 'info@pu.edu.pk',
      address: 'Quaid-e-Azam Campus, Lahore, Punjab, Pakistan'
    },
    scraping_priority: 9
  },
  {
    name: 'University of Karachi',
    url: 'https://www.uok.edu.pk',
    city: 'Karachi',
    type: 'public',
    description: 'The University of Karachi is a public research university located in Karachi, Sindh, Pakistan.',
    keywords: ['public university', 'karachi', 'sindh', 'research'],
    programs_offered: [
      'Arts and Social Sciences', 'Natural Sciences', 'Business Administration',
      'Engineering', 'Medicine', 'Pharmacy', 'Law', 'Education'
    ],
    contact_info: {
      phone: '+92-21-99261300',
      email: 'info@uok.edu.pk',
      address: 'University Road, Karachi, Sindh, Pakistan'
    },
    scraping_priority: 9
  },
  {
    name: 'Lahore University of Management Sciences (LUMS)',
    url: 'https://www.lums.edu.pk',
    city: 'Lahore',
    type: 'private',
    description: 'LUMS is a private research university located in Lahore, Punjab, Pakistan, known for its business and engineering programs.',
    keywords: ['private university', 'business school', 'engineering', 'lahore', 'management'],
    programs_offered: [
      'Bachelor of Science', 'MBA', 'MS/PhD programs',
      'Computer Science', 'Engineering', 'Business Administration',
      'Economics', 'Social Sciences', 'Law'
    ],
    contact_info: {
      phone: '+92-42-35608000',
      email: 'admissions@lums.edu.pk',
      address: 'Opposite Sector U, DHA, Lahore Cantt, Punjab, Pakistan'
    },
    scraping_priority: 10
  },
  {
    name: 'National University of Sciences and Technology (NUST)',
    url: 'https://www.nust.edu.pk',
    city: 'Islamabad',
    type: 'public',
    description: 'NUST is a public research university with its main campus in Islamabad, Pakistan, focusing on science and technology.',
    keywords: ['public university', 'technology', 'engineering', 'islamabad', 'research'],
    programs_offered: [
      'Engineering', 'Computer Science', 'Business Studies',
      'Architecture', 'Natural Sciences', 'Social Sciences',
      'Medicine', 'Art and Design'
    ],
    contact_info: {
      phone: '+92-51-90854000',
      email: 'info@nust.edu.pk',
      address: 'H-12, Islamabad, Pakistan'
    },
    scraping_priority: 10
  },
  {
    name: 'FAST National University of Computer and Emerging Sciences',
    url: 'https://www.nu.edu.pk',
    city: 'Karachi',
    type: 'private',
    description: 'FAST-NUCES is a private research university with multiple campuses, known for computer science and engineering programs.',
    keywords: ['private university', 'computer science', 'engineering', 'technology'],
    programs_offered: [
      'Computer Science', 'Software Engineering', 'Electrical Engineering',
      'Computer Engineering', 'Business Administration', 'Management Sciences'
    ],
    contact_info: {
      phone: '+92-21-34520294',
      email: 'admissions@nu.edu.pk',
      address: 'Block B, Faisal Town, Lahore, Punjab, Pakistan'
    },
    scraping_priority: 8
  },
  {
    name: 'Institute of Business Administration (IBA) Karachi',
    url: 'https://www.iba.edu.pk',
    city: 'Karachi',
    type: 'public',
    description: 'IBA Karachi is a public business school located in Karachi, Sindh, Pakistan, known for business and management education.',
    keywords: ['business school', 'management', 'karachi', 'public university'],
    programs_offered: [
      'BBA', 'MBA', 'MS programs', 'PhD programs',
      'Computer Science', 'Economics', 'Social Sciences',
      'Public Administration'
    ],
    contact_info: {
      phone: '+92-21-38104700',
      email: 'info@iba.edu.pk',
      address: 'University Road, Karachi, Sindh, Pakistan'
    },
    scraping_priority: 8
  },
  {
    name: 'Quaid-i-Azam University',
    url: 'https://www.qau.edu.pk',
    city: 'Islamabad',
    type: 'public',
    description: 'Quaid-i-Azam University is a public research university located in Islamabad, Pakistan.',
    keywords: ['public university', 'research', 'islamabad', 'federal university'],
    programs_offered: [
      'Natural Sciences', 'Social Sciences', 'Biological Sciences',
      'Physical Sciences', 'International Relations', 'Economics',
      'Psychology', 'Education'
    ],
    contact_info: {
      phone: '+92-51-90643155',
      email: 'info@qau.edu.pk',
      address: 'University Road, Islamabad, Pakistan'
    },
    scraping_priority: 8
  },
  {
    name: 'Government College University Lahore',
    url: 'https://www.gcu.edu.pk',
    city: 'Lahore',
    type: 'public',
    description: 'Government College University Lahore is a public research university located in Lahore, Punjab, Pakistan.',
    keywords: ['public university', 'government college', 'lahore', 'research'],
    programs_offered: [
      'Arts and Humanities', 'Natural Sciences', 'Social Sciences',
      'Business Administration', 'Engineering', 'Education',
      'Islamic Studies', 'Oriental Learning'
    ],
    contact_info: {
      phone: '+92-42-111422887',
      email: 'info@gcu.edu.pk',
      address: 'Katchery Road, Lahore, Punjab, Pakistan'
    },
    scraping_priority: 7
  },
  {
    name: 'University of Engineering and Technology Lahore',
    url: 'https://www    python main.py --scrape-single "UET".uet.edu.pk',
    city: 'Lahore',
    type: 'public',
    description: 'UET Lahore is a public university focusing on engineering and technology education.',
    keywords: ['engineering university', 'technology', 'public university', 'lahore'],
    programs_offered: [
      'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering',
      'Chemical Engineering', 'Computer Science', 'Architecture',
      'Industrial Engineering', 'Petroleum Engineering'
    ],
    contact_info: {
      phone: '+92-42-99029202',
      email: 'info@uet.edu.pk',
      address: 'G.T. Road, Lahore, Punjab, Pakistan'
    },
    scraping_priority: 7
  },
  {
    name: 'Aga Khan University',
    url: 'https://www.aku.edu',
    city: 'Karachi',
    type: 'private',
    description: 'Aga Khan University is a private research university with its main campus in Karachi, Pakistan.',
    keywords: ['private university', 'medical university', 'research', 'karachi'],
    programs_offered: [
      'Medicine', 'Nursing', 'Business Administration',
      'Education', 'Media and Communications', 'Arts and Sciences'
    ],
    contact_info: {
      phone: '+92-21-34864955',
      email: 'info@aku.edu',
      address: 'Stadium Road, Karachi, Sindh, Pakistan'
    },
    scraping_priority: 7
  },
  {
    name: 'Bahria University',
    url: 'https://www.bahria.edu.pk',
    city: 'Islamabad',
    type: 'private',
    description: 'Bahria University is a private university with multiple campuses across Pakistan.',
    keywords: ['private university', 'multi-campus', 'engineering', 'business'],
    programs_offered: [
      'Engineering', 'Computer Science', 'Business Administration',
      'Social Sciences', 'Maritime Studies', 'Law',
      'Psychology', 'Media Studies'
    ],
    contact_info: {
      phone: '+92-51-9260002',
      email: 'info@bahria.edu.pk',
      address: 'Shangrila Road, Sector E-8, Islamabad, Pakistan'
    },
    scraping_priority: 6
  },
  {
    name: 'COMSATS University Islamabad',
    url: 'https://www.comsats.edu.pk',
    city: 'Islamabad',
    type: 'public',
    description: 'COMSATS University Islamabad is a public research university with multiple campuses.',
    keywords: ['public university', 'technology', 'research', 'multi-campus'],
    programs_offered: [
      'Computer Science', 'Engineering', 'Business Administration',
      'Biosciences', 'Physical Sciences', 'Architecture',
      'Pharmacy', 'Agriculture'
    ],
    contact_info: {
      phone: '+92-51-9247000',
      email: 'info@comsats.edu.pk',
      address: 'Park Road, Chak Shahzad, Islamabad, Pakistan'
    },
    scraping_priority: 6
  }
];

class UniversitySeeder {
  constructor() {
    this.stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
  }

  async connect() {
    try {
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_scraper';
      
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      console.log('✅ Connected to MongoDB successfully');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }

  async resetDatabase() {
    try {
      console.log('🗑️  Clearing existing university data...');
      const deleteResult = await University.deleteMany({});
      console.log(`   Deleted ${deleteResult.deletedCount} existing universities`);
    } catch (error) {
      console.error('❌ Error clearing database:', error.message);
      throw error;
    }
  }

  async seedUniversity(universityData) {
    try {
      // Check if university already exists
      const existingUniversity = await University.findOne({
        $or: [
          { name: universityData.name },
          { url: universityData.url }
        ]
      });

      if (existingUniversity) {
        // Update existing university
        const updatedUniversity = await University.findByIdAndUpdate(
          existingUniversity._id,
          {
            ...universityData,
            updatedAt: new Date()
          },
          { new: true, runValidators: true }
        );

        console.log(`📝 Updated: ${updatedUniversity.name}`);
        this.stats.updated++;
        return updatedUniversity;
      } else {
        // Create new university
        const newUniversity = await University.create({
          ...universityData,
          created_by: 'seeder',
          scraping_status: 'pending'
        });

        console.log(`✨ Created: ${newUniversity.name}`);
        this.stats.created++;
        return newUniversity;
      }
    } catch (error) {
      console.error(`❌ Error seeding ${universityData.name}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  async seedAll(resetFirst = false) {
    console.log('🌱 Starting University Database Seeding...\n');

    if (resetFirst) {
      await this.resetDatabase();
      console.log();
    }

    console.log(`📊 Processing ${PAKISTANI_UNIVERSITIES.length} universities...\n`);

    for (const universityData of PAKISTANI_UNIVERSITIES) {
      await this.seedUniversity(universityData);
    }

    console.log('\n📈 Seeding Statistics:');
    console.log(`   ✨ Created: ${this.stats.created}`);
    console.log(`   📝 Updated: ${this.stats.updated}`);
    console.log(`   ⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`   ❌ Errors: ${this.stats.errors}`);
    console.log(`   📊 Total: ${this.stats.created + this.stats.updated + this.stats.skipped}`);

    if (this.stats.errors === 0) {
      console.log('\n🎉 Database seeding completed successfully!');
    } else {
      console.log('\n⚠️  Database seeding completed with some errors.');
    }
  }

  async generateSampleData() {
    console.log('🎲 Generating sample scraped data for testing...\n');

    const universities = await University.find({ is_active: true }).limit(3);
    
    for (const university of universities) {
      const sampleData = this.generateSampleScrapedData(university.name);
      
      await University.findByIdAndUpdate(university._id, {
        data: sampleData,
        scraping_status: 'completed',
        last_scraped: new Date(),
        $push: {
          scraping_history: {
            status: 'success',
            timestamp: new Date(),
            data_extracted: {
              admission_dates: sampleData.admission_dates.length,
              criteria: sampleData.criteria.length,
              fee_structure: sampleData.fee_structure.length,
              scholarships: sampleData.scholarships.length
            }
          }
        }
      });

      console.log(`📊 Added sample data for: ${university.name}`);
    }

    console.log('\n✅ Sample data generation completed!');
  }

  generateSampleScrapedData(universityName) {
    return {
      admission_dates: [
        {
          program: 'Bachelor Programs',
          deadline: new Date('2024-07-15'),
          term: 'Fall 2024',
          type: 'application'
        },
        {
          program: 'Master Programs',
          deadline: new Date('2024-06-30'),
          term: 'Fall 2024',
          type: 'application'
        }
      ],
      criteria: [
        {
          program: 'Bachelor Programs',
          min_marks: '60%',
          required_tests: ['Entry Test'],
          required_subjects: ['Mathematics', 'English'],
          other_requirements: ['Valid CNIC', 'Medical Certificate']
        }
      ],
      fee_structure: [
        {
          program: 'Bachelor Programs',
          tuition_fee: '50,000 PKR',
          admission_fee: '5,000 PKR',
          other_fees: {
            'Security Deposit': '10,000 PKR',
            'Library Fee': '2,000 PKR'
          },
          total_per_semester: '67,000 PKR',
          currency: 'PKR'
        }
      ],
      scholarships: [
        {
          name: 'Merit Scholarship',
          amount: '50% tuition fee waiver',
          eligibility: ['Top 10% students', 'Minimum 85% marks'],
          deadline: new Date('2024-08-01'),
          coverage: 'Tuition fee only',
          renewable: true
        }
      ]
    };
  }

  async disconnect() {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Main execution
async function main() {
  const seeder = new UniversitySeeder();
  
  try {
    const args = process.argv.slice(2);
    const shouldReset = args.includes('--reset');
    const shouldGenerateSampleData = args.includes('--sample-data');

    await seeder.connect();
    await seeder.seedAll(shouldReset);

    if (shouldGenerateSampleData) {
      await seeder.generateSampleData();
    }

    // Show final statistics
    const totalUniversities = await University.countDocuments();
    const activeUniversities = await University.countDocuments({ is_active: true });
    const universitiesWithData = await University.countDocuments({
      is_active: true,
      $or: [
        { 'data.admission_dates.0': { $exists: true } },
        { 'data.criteria.0': { $exists: true } },
        { 'data.fee_structure.0': { $exists: true } },
        { 'data.scholarships.0': { $exists: true } }
      ]
    });

    console.log('\n📊 Final Database Statistics:');
    console.log(`   🏫 Total Universities: ${totalUniversities}`);
    console.log(`   ✅ Active Universities: ${activeUniversities}`);
    console.log(`   📊 Universities with Data: ${universitiesWithData}`);

  } catch (error) {
    console.error('💥 Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await seeder.disconnect();
  }
}

// Handle script execution
if (require.main === module) {
  console.log('🚀 Pakistani University Database Seeder');
  console.log('=====================================\n');
  
  if (process.argv.includes('--help')) {
    console.log('Usage:');
    console.log('  node data/seed-universities.js              # Seed universities');
    console.log('  node data/seed-universities.js --reset      # Clear existing data first');
    console.log('  node data/seed-universities.js --sample-data # Add sample scraped data');
    console.log('  node data/seed-universities.js --help       # Show this help');
    process.exit(0);
  }

  main();
}

module.exports = { UniversitySeeder, PAKISTANI_UNIVERSITIES }; 
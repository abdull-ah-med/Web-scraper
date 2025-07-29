# 🎓 AI University Web Scraper - Pakistan

An intelligent, AI-powered web scraper designed to extract comprehensive university data from Pakistani institutions using Claude AI, rotating proxies, and advanced anti-detection techniques.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)
![Claude AI](https://img.shields.io/badge/Claude-API-orange.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## 🚀 Features

### 🧠 AI-Powered Data Extraction
- **Claude API Integration**: Intelligent extraction using Anthropic's Claude AI
- **Structured Data**: Automatically extracts admission dates, criteria, fees, and scholarships
- **Context-Aware**: Specialized prompts for Pakistani university websites
- **Data Validation**: Comprehensive validation and cleaning of extracted data

### 🔄 Advanced Anti-Detection System
- **Rotating Proxies**: Free proxy rotation with health monitoring
- **Smart Delays**: Randomized request timing to avoid detection
- **User-Agent Rotation**: Dynamic browser fingerprint simulation
- **Session Management**: Automatic session refresh and cookie handling
- **Cloudscraper Integration**: Advanced JavaScript challenge solving

### 🏛️ Comprehensive API Backend
- **RESTful API**: Complete CRUD operations with Express.js
- **Advanced Search**: Multi-parameter search across all data types
- **Real-time Monitoring**: Live scraping status and system health
- **Analytics Dashboard**: Detailed statistics and performance metrics

### 📊 Database & Monitoring
- **MongoDB Integration**: Robust data model with relationships
- **Winston Logging**: Structured logging with rotation
- **Health Monitoring**: System metrics and alerts
- **Performance Analytics**: Scraping success rates and data freshness

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Python        │───▶│   Node.js API   │───▶│   MongoDB       │
│   Scraper       │    │   Backend       │    │   Database      │
│                 │    │                 │    │                 │
│ • Proxy Manager │    │ • Express Server│    │ • University    │
│ • Claude AI     │    │ • RESTful API   │    │   Collections   │
│ • Anti-Detection│    │ • Job Queue     │    │ • Analytics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Free Proxies  │    │   Monitoring    │    │   Structured    │
│                 │    │                 │    │   Data Output   │
│ • Health Checks │    │ • Winston Logs  │    │ • JSON API      │
│ • Auto Rotation │    │ • Performance   │    │ • Search Engine │
│ • Failover      │    │ • Error Tracking│    │ • Analytics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### Core Scraping Engine (Python)
- **Python 3.8+** - Main scraping logic
- **Requests & CloudScraper** - HTTP client with anti-detection
- **BeautifulSoup & lxml** - HTML parsing
- **Anthropic Claude API** - AI-powered data extraction
- **Pydantic** - Data validation and serialization

### Backend API (Node.js)
- **Express.js** - Web framework
- **MongoDB & Mongoose** - Database and ODM
- **Winston** - Structured logging
- **Bull Queue** - Job management
- **Joi** - Request validation

### Infrastructure
- **MongoDB Atlas** - Cloud database (Free tier)
- **Free Proxy Services** - Rotating proxy sources
- **PM2** - Process management (Production)

## 📦 Installation

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **MongoDB Atlas Account** (Free)
- **Claude API Key** (Anthropic)

### 1. Clone Repository
```bash
git clone https://github.com/your-username/ai-university-scraper.git
cd ai-university-scraper
```

### 2. Python Environment Setup
```bash
cd scraper
pip install -r requirements.txt
```

### 3. Node.js Backend Setup
```bash
cd ../backend
npm install
```

### 4. Environment Configuration
Create `backend/.env`:
```env
# Required Configuration
CLAUDE_API_KEY=your_claude_api_key_here
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/university_scraper

# Optional Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Scraper Settings
SCRAPER_DELAY_MIN=2
SCRAPER_DELAY_MAX=5
USE_PROXIES=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Database Initialization
```bash
# Seed database with Pakistani universities
node data/seed-universities.js --reset --sample-data
```

## 🚦 Quick Start

### Start the API Server
```bash
cd backend
npm start
# Server runs on http://localhost:3000
```

### Test the Scraper
```bash
cd scraper

# Validate environment
python main.py --validate

# List available universities
python main.py --list-universities

# Scrape a single university
python main.py --scrape-single "LUMS"

# Scrape all universities
python main.py --scrape-all --delay 45
```

### API Health Check
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Currently, no authentication is required. For production, implement JWT authentication.

---

## 🏛️ Universities Endpoints

### List All Universities
```http
GET /api/universities?page=1&limit=20&city=lahore&type=public&search=engineering
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (max: 100, default: 20)
- `city` - Filter by city (case-insensitive)
- `type` - Filter by type (`public` or `private`)
- `search` - Text search across name, description, keywords
- `sort` - Sort fields: `name`, `city`, `type`, `last_scraped`, `data_completeness`
- `order` - Sort order: `asc` or `desc` (default: `asc`)

**Response:**
```json
{
  "status": "success",
  "results": 10,
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalResults": 12,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "_id": "68890c5297d347e45f43ce36",
      "name": "Lahore University of Management Sciences (LUMS)",
      "url": "https://www.lums.edu.pk",
      "city": "Lahore",
      "type": "private",
      "scraping_status": "completed",
      "last_scraped": "2025-07-29T23:16:06.769Z",
      "data_completeness": 25,
      "total_programs": 15
    }
  ]
}
```

### Get University by ID
```http
GET /api/universities/:id
```

**Response:** Complete university document with all scraped data.

### Get University Data Only
```http
GET /api/universities/:id/data
```

**Response:** Just the scraped data (admission_dates, criteria, fee_structure, scholarships).

### Create New University
```http
POST /api/universities
Content-Type: application/json

{
  "name": "University Name",
  "url": "https://university.edu.pk",
  "city": "Lahore",
  "type": "public",
  "contact_info": {
    "phone": "+92-xx-xxxxxxxx",
    "email": "info@university.edu.pk",
    "address": "University Address"
  },
  "programs_offered": ["Engineering", "Business", "Arts"],
  "scraping_priority": 8
}
```

### Update University
```http
PUT /api/universities/:id
Content-Type: application/json

{
  "scraping_priority": 9,
  "is_active": true
}
```

### Delete University
```http
DELETE /api/universities/:id
```

---

## 🔍 Search Endpoints

### Search Universities
```http
GET /api/search/universities?q=engineering&city=lahore&min_completeness=50
```

**Query Parameters:**
- `q` - Search query (searches name, description, keywords, programs)
- `city` - Filter by city
- `type` - Filter by type (`public`/`private`)
- `country` - Filter by country (default: Pakistan)
- `min_completeness` - Minimum data completeness percentage (0-100)

### Search Admission Dates
```http
GET /api/search/admission-dates?upcoming_only=true&term=fall&program=engineering
```

**Query Parameters:**
- `upcoming_only` - Only future deadlines (default: false)
- `term` - Filter by academic term (Fall, Spring, Summer)
- `program` - Filter by program name
- `type` - Filter by date type (`application`, `test`, `merit_list`, `fee`, `semester_start`)
- `university` - Filter by university name

**Response:**
```json
{
  "status": "success",
  "results": 25,
  "data": [
    {
      "university": "LUMS",
      "program": "Undergraduate Programs",
      "deadline": "2024-12-15",
      "term": "Fall 2025",
      "type": "application",
      "days_until_deadline": 139
    }
  ]
}
```

### Search Admission Criteria
```http
GET /api/search/criteria?program=engineering&min_marks=60
```

**Query Parameters:**
- `program` - Filter by program name
- `min_marks` - Filter by minimum marks requirement
- `required_test` - Filter by required test
- `university` - Filter by university name

### Search Fee Structures
```http
GET /api/search/fees?program=engineering&max_fee=100000&currency=PKR
```

**Query Parameters:**
- `program` - Filter by program name
- `max_fee` - Maximum fee amount
- `min_fee` - Minimum fee amount
- `currency` - Filter by currency (default: PKR)
- `university` - Filter by university name

### Search Scholarships
```http
GET /api/search/scholarships?renewable=true&university=LUMS&min_amount=50
```

**Query Parameters:**
- `renewable` - Filter renewable scholarships (true/false)
- `university` - Filter by university name
- `min_amount` - Minimum scholarship amount (percentage)
- `q` - Search in scholarship name and eligibility criteria

---

## 📊 Statistics & Analytics Endpoints

### System Overview
```http
GET /api/stats/overview
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "universities": {
      "total": 12,
      "active": 12,
      "with_data": 8,
      "recently_scraped": 5
    },
    "scraping_status": {
      "pending": 4,
      "completed": 7,
      "failed": 1
    },
    "data_types": {
      "admission_dates": 156,
      "criteria": 45,
      "fee_structure": 78,
      "scholarships": 23
    },
    "avg_completeness": 62.5
  }
}
```

### University Statistics
```http
GET /api/stats/universities?sort_by=completeness&city=lahore
```

**Query Parameters:**
- `sort_by` - Sort by: `completeness`, `last_scraped`, `name`, `priority`
- `city` - Filter by city
- `type` - Filter by type

### Scraping Performance
```http
GET /api/stats/scraping?days=30
```

**Query Parameters:**
- `days` - Number of days to analyze (default: 7)

**Response:** Success rates, average scraping time, error statistics.

### Data Freshness Report
```http
GET /api/stats/data-freshness
```

**Response:** Shows how recent the data is for each university and data type.

### System Health
```http
GET /api/stats/health
```

**Response:** System health metrics, database status, recent errors.

---

## 🚀 Scraping Control Endpoints

### Manual Scraping (Independent)
**Note:** The scraper runs independently from the backend. Use these commands directly:

```bash
# Scrape single university
cd scraper && source .venv/bin/activate
python main.py --scrape-single "LUMS"

# Scrape all universities
python main.py --scrape-all --delay 45

# Validate environment
python main.py --validate
```

### Check Scraping Results via API
```http
GET /api/universities/:id/scraping-history
```

**Response:** Recent scraping attempts and their results.

---

## 🎯 Example API Usage

### Get All Universities with Data
```bash
curl "http://localhost:3000/api/universities?limit=50" | jq '.data[] | select(.data_completeness > 0)'
```

### Find Engineering Programs
```bash
curl "http://localhost:3000/api/search/universities?q=engineering" | jq '.data[].name'
```

### Get Upcoming Admission Deadlines
```bash
curl "http://localhost:3000/api/search/admission-dates?upcoming_only=true" | jq '.data[] | {university, program, deadline}'
```

### Get LUMS Complete Data
```bash
curl "http://localhost:3000/api/universities/68890c5297d347e45f43ce36/data" | jq '.'
```

### System Health Check
```bash
curl "http://localhost:3000/health" | jq '.'
```

---

## 📋 Response Format

All API responses follow this structure:

### Success Response
```json
{
  "status": "success",
  "results": 10,
  "pagination": { /* pagination info */ },
  "data": [ /* actual data */ ]
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": "Specific error details"
  }
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🎓 Supported Universities

The system comes pre-configured with **12 major Pakistani universities**:

| University | City | Type | Priority |
|------------|------|------|----------|
| **University of Punjab** | Lahore | Public | 9 |
| **University of Karachi** | Karachi | Public | 9 |
| **LUMS** | Lahore | Private | 10 |
| **NUST** | Islamabad | Public | 10 |
| **FAST-NUCES** | Multi-campus | Private | 8 |
| **IBA Karachi** | Karachi | Public | 8 |
| **Quaid-i-Azam University** | Islamabad | Public | 8 |
| **Government College University** | Lahore | Public | 7 |
| **UET Lahore** | Lahore | Public | 7 |
| **Aga Khan University** | Karachi | Private | 7 |
| **Bahria University** | Multi-campus | Private | 6 |
| **COMSATS University** | Multi-campus | Public | 6 |

## 📊 Data Structure

### University Data Model
```javascript
{
  "_id": "ObjectId",
  "name": "University Name",
  "url": "https://university.edu.pk",
  "city": "Lahore",
  "type": "public|private",
  "scraping_status": "pending|scraping|completed|failed",
  "data": {
    "admission_dates": [
      {
        "program": "Bachelor Programs",
        "deadline": "2024-07-15",
        "term": "Fall 2024",
        "type": "application"
      }
    ],
    "criteria": [
      {
        "program": "Bachelor Programs",
        "min_marks": "60%",
        "required_tests": ["Entry Test"],
        "required_subjects": ["Mathematics", "English"]
      }
    ],
    "fee_structure": [
      {
        "program": "Bachelor Programs",
        "tuition_fee": "50,000 PKR",
        "total_per_semester": "67,000 PKR",
        "currency": "PKR"
      }
    ],
    "scholarships": [
      {
        "name": "Merit Scholarship",
        "amount": "50% tuition fee waiver",
        "eligibility": ["Top 10% students"],
        "renewable": true
      }
    ]
  }
}
```

## 🔧 Configuration

### Scraper Configuration (`scraper/config/settings.py`)

```python
# Claude AI Configuration
CLAUDE_API_KEY = "your_api_key"

# Scraping Delays
SCRAPER_DELAY_MIN = 2  # seconds
SCRAPER_DELAY_MAX = 5  # seconds

# Proxy Configuration
USE_PROXIES = True
FREE_PROXY_SOURCES = [
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://api.proxyscrape.com/v2/?request=get&protocol=http'
]

# User Agent Rotation
CUSTOM_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15...'
]
```

### Backend Configuration (`backend/.env`)

```env
# Database
MONGODB_URI=mongodb+srv://...

# API Keys
CLAUDE_API_KEY=your_claude_key

# Server
NODE_ENV=development
PORT=3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## 💰 Cost Breakdown

### Ultra-Low Cost Setup

| Component | Solution | Monthly Cost |
|-----------|----------|--------------|
| **Database** | MongoDB Atlas Free Tier (512MB) | **$0** |
| **Proxies** | Free rotating proxy lists | **$0** |
| **AI Processing** | Claude API (pay-per-use) | **$10-30** |
| **Hosting** | DigitalOcean Droplet (1GB RAM) | **$4-6** |
| **Domain** | Optional | **$10/year** |
| **Total** | | **$14-36/month** |

### Scaling Options

| Component | Upgrade | Monthly Cost |
|-----------|---------|--------------|
| **Database** | MongoDB Atlas M10 | **$57** |
| **Proxies** | Residential proxies (Bright Data) | **$100-300** |
| **Hosting** | DigitalOcean 4GB Droplet | **$24** |
| **Monitoring** | DataDog/New Relic | **$15-50** |

## 🚀 Production Deployment

### Option 1: DigitalOcean Droplet ($4-6/month)

```bash
# 1. Create Ubuntu 20.04 droplet
# 2. SSH into server
ssh root@your-server-ip

# 3. Install dependencies
sudo apt update
sudo apt install nodejs npm python3 python3-pip nginx

# 4. Install PM2
npm install -g pm2

# 5. Clone and setup
git clone https://github.com/your-username/ai-university-scraper.git
cd ai-university-scraper

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with production values

# Python setup
cd ../scraper
pip3 install -r requirements.txt

# 6. Start with PM2
cd ../backend
pm2 start server.js --name "university-api"
pm2 startup
pm2 save

# 7. Configure Nginx (optional)
sudo nano /etc/nginx/sites-available/university-api
```

### Option 2: Railway/Render (Free Tier)

```yaml
# railway.toml
[build]
  builder = "NIXPACKS"

[deploy]
  startCommand = "cd backend && npm start"

[variables]
  NODE_ENV = "production"
  PORT = "3000"
```

### Option 3: Docker Deployment

```dockerfile
# Dockerfile
FROM node:16-alpine

# Install Python
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY scraper/requirements.txt ./scraper/

# Install dependencies
RUN cd backend && npm ci --only=production
RUN cd scraper && pip3 install -r requirements.txt

# Copy application code
COPY . .

EXPOSE 3000

CMD ["node", "backend/server.js"]
```

## 📈 Usage Examples

### Command Line Interface

```bash
# Environment validation
python main.py --validate

# List all universities
python main.py --list-universities

# Scrape specific university
python main.py --scrape-single "University of Punjab"

# Scrape by URL
python main.py --scrape-url "https://www.lums.edu.pk"

# Bulk scraping with custom delays
python main.py --scrape-all --delay 60

# Disable proxy usage
python main.py --scrape-single "NUST" --no-proxies

# System statistics
python main.py --stats
```

### API Usage Examples

```bash
# Get all universities in Lahore
curl "http://localhost:3000/api/universities?city=lahore&limit=10"

# Search for computer science programs
curl "http://localhost:3000/api/search/programs?q=computer%20science"

# Get upcoming admission deadlines
curl "http://localhost:3000/api/search/admission-dates?upcoming_only=true"

# Start scraping LUMS
curl -X POST "http://localhost:3000/api/scrape/university/UNIVERSITY_ID"

# Get system statistics
curl "http://localhost:3000/api/stats/overview"

# Health check
curl "http://localhost:3000/health"
```

### Python Integration

```python
import requests

# Initialize API client
base_url = "http://localhost:3000/api"

# Get universities
response = requests.get(f"{base_url}/universities")
universities = response.json()['data']

# Search scholarships
params = {'renewable': 'true', 'limit': 50}
scholarships = requests.get(f"{base_url}/search/scholarships", params=params)

# Start scraping
for university in universities[:3]:
    scrape_response = requests.post(f"{base_url}/scrape/university/{university['_id']}")
    print(f"Started scraping: {university['name']}")
```

### JavaScript Integration

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 30000
});

// Get university data
async function getUniversityData(universityId) {
  try {
    const response = await api.get(`/universities/${universityId}/data`);
    return response.data.data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Search programs
async function searchPrograms(query) {
  const response = await api.get('/search/programs', {
    params: { q: query, limit: 20 }
  });
  return response.data.data;
}
```

## 🔍 Monitoring & Logging

### Log Files
- `logs/app.log` - Application logs
- `logs/error.log` - Error logs only
- `logs/scraper.log` - Scraping activity
- `logs/combined.log` - All logs combined

### Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "University scraping completed",
  "service": "university-scraper-api",
  "universityId": "507f1f77bcf86cd799439011",
  "duration": 45000,
  "dataExtracted": 15
}
```

### Monitoring Endpoints
```bash
# System health
GET /api/stats/health

# Performance metrics
GET /api/stats/scraping

# Data freshness
GET /api/stats/data-freshness

# Active processes
GET /api/scrape/active
```

## 🛠️ Development

### Project Structure
```
ai-web-scraper/
├── scraper/                    # Python scraping engine
│   ├── config/settings.py      # Configuration
│   ├── core/                   # Core scraping logic
│   │   ├── proxy_manager.py    # Proxy rotation
│   │   └── scraper_engine.py   # Main scraper
│   ├── extractors/             # Data extractors
│   │   └── claude_extractor.py # Claude AI integration
│   ├── utils/                  # Utility functions
│   └── main.py                 # CLI interface
├── backend/                    # Node.js API
│   ├── models/                 # MongoDB models
│   ├── routes/                 # API routes
│   ├── services/               # Business logic
│   ├── middleware/             # Express middleware
│   └── server.js               # Express server
├── data/                       # Seed data
│   └── seed-universities.js    # Database seeder
└── logs/                       # Application logs
```

### Adding New Universities

1. **Add to settings.py:**
```python
PAKISTANI_UNIVERSITIES.append({
    'name': 'New University',
    'url': 'https://newuni.edu.pk',
    'city': 'Islamabad',
    'type': 'public',
    'scraping_priority': 7
})
```

2. **Run seeder:**
```bash
node data/seed-universities.js
```

### Adding New Data Types

1. **Update MongoDB schema** in `backend/models/University.js`
2. **Add Claude prompts** in `scraper/config/settings.py`
3. **Create extractor method** in `scraper/extractors/claude_extractor.py`
4. **Add API endpoints** in `backend/routes/`

### Testing

```bash
# Test scraper
cd scraper
python -m pytest tests/

# Test API
cd backend
npm test

# Integration tests
npm run test:integration
```

## 🔐 Security Considerations

### Rate Limiting
- API: 100 requests per 15 minutes per IP
- Claude API: 1 request per second
- Proxy rotation: Health checks every 5 minutes

### Data Privacy
- No personal data stored
- Public university information only
- Compliance with robots.txt
- Respectful scraping practices

### Error Handling
- Comprehensive error logging
- Graceful failure recovery
- Automatic retry mechanisms
- Circuit breaker patterns

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines
- Follow PEP 8 for Python code
- Use ESLint for JavaScript code
- Write comprehensive tests
- Update documentation
- Add logging for new features

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.


---

**Built with my curiosity**

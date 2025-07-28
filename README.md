# AI University Web Scraper - Pakistan

An intelligent web scraper designed to extract comprehensive university data from Pakistani institutions using Claude AI and rotating proxies.

## 🎯 Features

- **AI-Powered Data Extraction**: Uses Anthropic Claude API to intelligently extract:
  - Admission dates and deadlines
  - Admission criteria and requirements
  - Fee structures and schedules
  - Scholarship information
  - Program details

- **Anti-Detection System**: 
  - Rotating proxy support
  - Smart delays and throttling
  - User-agent rotation
  - Bot detection avoidance

- **RESTful API**: Node.js backend with MongoDB for data storage and retrieval

## 📁 Project Structure

```
ai-web-scraper/
├── scraper/                 # Python scraping engine
│   ├── core/               # Core scraping modules
│   ├── extractors/         # AI data extractors
│   ├── utils/              # Utility functions
│   ├── config/             # Configuration files
│   └── main.py             # Entry point
├── backend/                # Node.js API server
│   ├── models/             # MongoDB schemas
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   └── server.js           # Server entry point
├── data/                   # Seed data and backups
└── logs/                   # Application logs
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB Atlas account
- Anthropic Claude API key

### Setup
```bash
# Clone repository
git clone <repository-url>
cd ai-web-scraper

# Setup Python environment
cd scraper
pip install -r requirements.txt

# Setup Node.js backend
cd ../backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys and database URL
```

### Environment Variables
```
CLAUDE_API_KEY=your_claude_api_key
MONGODB_URI=your_mongodb_atlas_uri
NODE_ENV=development
PORT=3000
```

## 🎓 Supported Pakistani Universities

Initial focus on major Pakistani universities including:
- University of Punjab
- Karachi University  
- LUMS
- NUST
- FAST-NUCES
- And more...

## 📚 API Documentation

### Universities
- `GET /api/universities` - List all universities
- `GET /api/universities/:id` - Get university details
- `POST /api/universities` - Add new university
- `POST /api/scrape/:id` - Start scraping university

### Search
- `GET /api/search/programs` - Search programs
- `GET /api/search/scholarships` - Search scholarships

## 🛠 Development

```bash
# Start backend server
cd backend && npm run dev

# Run scraper
cd scraper && python main.py

# View logs
tail -f logs/scraper.log
```

## 📄 License

MIT License - see LICENSE file for details 
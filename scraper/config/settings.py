import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    """Configuration settings for the university scraper"""
    
    # API Keys
    CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY') or os.getenv('ANTHROPIC_API_KEY', '')
    
    # Database
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/university_scraper')
    
    # Scraper Configuration
    SCRAPER_DELAY_MIN = int(os.getenv('SCRAPER_DELAY_MIN', '2'))
    SCRAPER_DELAY_MAX = int(os.getenv('SCRAPER_DELAY_MAX', '5'))
    SCRAPER_CONCURRENT_REQUESTS = int(os.getenv('SCRAPER_CONCURRENT_REQUESTS', '1'))
    SCRAPER_TIMEOUT = int(os.getenv('SCRAPER_TIMEOUT', '30'))
    
    # Proxy Configuration
    USE_PROXIES = os.getenv('USE_PROXIES', 'true').lower() == 'true'
    PROXY_ROTATION_ENABLED = os.getenv('PROXY_ROTATION_ENABLED', 'true').lower() == 'true'
    PROXY_TEST_URL = os.getenv('PROXY_TEST_URL', 'http://httpbin.org/ip')
    
    # User Agent Settings
    USER_AGENT_ROTATION = True
    CUSTOM_USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    ]
    
    # Free Proxy Sources
    FREE_PROXY_SOURCES = [
        'https://www.proxy-list.download/api/v1/get?type=http',
        'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=5000&country=all',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    ]
    
    # Pakistani Universities - Initial seed data
    PAKISTANI_UNIVERSITIES = [
        {
            'name': 'University of Punjab',
            'url': 'https://www.pu.edu.pk',
            'city': 'Lahore',
            'type': 'public'
        },
        {
            'name': 'Karachi University',
            'url': 'https://www.uok.edu.pk',
            'city': 'Karachi',
            'type': 'public'
        },
        {
            'name': 'Lahore University of Management Sciences (LUMS)',
            'url': 'https://www.lums.edu.pk',
            'city': 'Lahore',
            'type': 'private'
        },
        {
            'name': 'National University of Sciences and Technology (NUST)',
            'url': 'https://www.nust.edu.pk',
            'city': 'Islamabad',
            'type': 'public'
        },
        {
            'name': 'FAST National University of Computer and Emerging Sciences',
            'url': 'https://www.nu.edu.pk',
            'city': 'Karachi',
            'type': 'private'
        },
        {
            'name': 'Institute of Business Administration (IBA) Karachi',
            'url': 'https://www.iba.edu.pk',
            'city': 'Karachi',
            'type': 'public'
        },
        {
            'name': 'Quaid-i-Azam University',
            'url': 'https://www.qau.edu.pk',
            'city': 'Islamabad',
            'type': 'public'
        },
        {
            'name': 'Government College University Lahore',
            'url': 'https://www.gcu.edu.pk',
            'city': 'Lahore',
            'type': 'public'
        }
    ]
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', '../logs/scraper.log')
    
    # Data extraction prompts for Claude API
    CLAUDE_SYSTEM_PROMPT = """You are a data extraction expert. Your task is to analyze the provided HTML content from a university website and extract specific information based on the user's request. The output must be a single, valid, minified JSON array. Do not include any explanatory text, apologies, or markdown formatting. If no relevant information is found, return an empty JSON array []."""
    CLAUDE_PROMPTS = {
        'admission_dates': """
        You are extracting admission information from a Pakistani university webpage. 
        Extract all admission deadlines, application periods, and important dates.
        
        Look for:
        - Application deadlines
        - Admission test dates
        - Merit list publication dates
        - Fee submission deadlines
        - Semester start dates
        
        Return ONLY valid JSON in this format:
        [
            {
                "program": "program name",
                "deadline": "YYYY-MM-DD",
                "term": "Fall 2024/Spring 2025/etc",
                "type": "application/test/merit_list/fee/semester_start"
            }
        ]
        
        HTML Content: {html_content}
        """,
        
        'admission_criteria': """
        Extract admission criteria and requirements from this Pakistani university webpage.
        
        Look for:
        - Minimum GPA/marks requirements
        - Test score requirements (SAT, NTS, university tests)
        - Required subjects
        - Age limits
        - Other eligibility criteria
        
        Return ONLY valid JSON:
        [
            {
                "program": "program name",
                "min_marks": "percentage or GPA",
                "required_tests": ["test names"],
                "required_subjects": ["subject names"],
                "other_requirements": ["additional requirements"]
            }
        ]
        
        HTML Content: {html_content}
        """,
        
        'fee_structure': """
        Extract fee information from this Pakistani university webpage.
        
        Look for:
        - Tuition fees
        - Admission fees
        - Security deposits
        - Hostel fees
        - Other charges
        
        Return ONLY valid JSON:
        [
            {
                "program": "program name",
                "tuition_fee": "amount in PKR",
                "admission_fee": "amount in PKR",
                "other_fees": {"fee_type": "amount"},
                "total_per_semester": "amount in PKR",
                "currency": "PKR"
            }
        ]
        
        HTML Content: {html_content}
        """,
        
        'scholarships': """
        Extract scholarship information from this Pakistani university webpage.
        
        Look for:
        - Scholarship names
        - Eligibility criteria
        - Award amounts
        - Application deadlines
        - Coverage details
        
        Return ONLY valid JSON:
        [
            {
                "name": "scholarship name",
                "amount": "amount or percentage",
                "eligibility": ["criteria"],
                "deadline": "YYYY-MM-DD if available",
                "coverage": "what it covers",
                "renewable": true/false
            }
        ]
        
        HTML Content: {html_content}
        """
    }

# Create global settings instance
settings = Settings() 
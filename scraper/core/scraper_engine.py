import requests
import time
import random
import logging
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urljoin, urlparse, parse_qs
from datetime import datetime
import cloudscraper
from fake_useragent import UserAgent
from bs4 import BeautifulSoup
import re

from config.settings import settings
from core.proxy_manager import proxy_manager, ProxyInfo
from extractors.claude_extractor import claude_extractor

class UniversityScraperEngine:
    
    def __init__(self):
        self.session = self._create_session()
        self.user_agent = UserAgent()
        self.logger = self._setup_logger()
        
        self.request_count = 0
        self.session_start_time = datetime.now()
        self.max_requests_per_session = 100
        self.session_duration_limit = 3600
        
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'proxy_failures': 0,
            'data_extracted': 0,
            'universities_scraped': 0
        }
        
    def _setup_logger(self) -> logging.Logger:
        logger = logging.getLogger('ScraperEngine')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.FileHandler(settings.LOG_FILE)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def _create_session(self) -> requests.Session:
        """Create a requests session with anti-detection headers"""
        session = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'mobile': False
            }
        )
        
        # Set common headers
        session.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        })
        
        return session
    
    def _get_random_headers(self) -> Dict[str, str]:
        """Generate randomized headers for anti-detection"""
        headers = {
            'User-Agent': self.user_agent.random,
            'Accept': random.choice([
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
            ]),
            'Accept-Language': random.choice([
                'en-US,en;q=0.9',
                'en-US,en;q=0.8',
                'en-GB,en-US;q=0.9,en;q=0.8'
            ]),
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': random.choice(['no-cache', 'max-age=0', 'no-store'])
        }
        
        # Randomly add some optional headers
        if random.random() > 0.5:
            headers['DNT'] = '1'
        
        if random.random() > 0.3:
            headers['Sec-Fetch-Dest'] = 'document'
            headers['Sec-Fetch-Mode'] = 'navigate'
            headers['Sec-Fetch-Site'] = random.choice(['none', 'same-origin', 'cross-site'])
        
        return headers
    
    def _smart_delay(self, base_delay: float = None):
        """Implement smart delays to avoid detection"""
        if base_delay is None:
            base_delay = random.uniform(
                settings.SCRAPER_DELAY_MIN,
                settings.SCRAPER_DELAY_MAX
            )
        
        # Add some randomness
        jitter = random.uniform(-0.5, 0.5)
        delay = base_delay + jitter
        
        # Longer delays after many requests
        if self.request_count > 50:
            delay *= 1.5
        elif self.request_count > 20:
            delay *= 1.2
        
        # Ensure minimum delay
        delay = max(delay, 1.0)
        
        self.logger.debug(f"Sleeping for {delay:.2f} seconds")
        time.sleep(delay)
    
    def _should_refresh_session(self) -> bool:
        """Check if session should be refreshed"""
        elapsed = (datetime.now() - self.session_start_time).seconds
        
        return (self.request_count >= self.max_requests_per_session or
                elapsed >= self.session_duration_limit)
    
    def _refresh_session(self):
        """Refresh the scraping session"""
        self.logger.info("Refreshing scraping session...")
        
        self.session.close()
        self.session = self._create_session()
        self.request_count = 0
        self.session_start_time = datetime.now()
        
        # Take a longer break
        time.sleep(random.uniform(10, 20))
    
    def _make_request(self, url: str, proxy: Optional[ProxyInfo] = None, 
                     headers: Optional[Dict] = None, timeout: int = None) -> Optional[requests.Response]:
        """Make a request with error handling and retries"""
        if timeout is None:
            timeout = settings.SCRAPER_TIMEOUT
        
        if headers is None:
            headers = self._get_random_headers()
        
        self.stats['total_requests'] += 1
        self.request_count += 1
        
        try:
            # Check if session needs refresh
            if self._should_refresh_session():
                self._refresh_session()
            
            # Setup proxy if provided
            proxies = proxy.to_dict() if proxy else None
            
            # Make the request
            response = self.session.get(
                url,
                headers=headers,
                proxies=proxies,
                timeout=timeout,
                allow_redirects=True
            )
            
            # Check response status
            if response.status_code == 200:
                self.stats['successful_requests'] += 1
                
                # Mark proxy as successful if used
                if proxy:
                    proxy_manager.mark_proxy_success(
                        proxy, 
                        response.elapsed.total_seconds()
                    )
                
                return response
            
            elif response.status_code in [403, 429, 503]:
                # Possible bot detection
                self.logger.warning(f"Possible bot detection: {response.status_code} for {url}")
                self.stats['failed_requests'] += 1
                
                if proxy:
                    proxy_manager.mark_proxy_failed(proxy, f"HTTP {response.status_code}")
                
                return None
            
            else:
                self.logger.warning(f"Unexpected status code {response.status_code} for {url}")
                self.stats['failed_requests'] += 1
                return None
                
        except requests.exceptions.ProxyError as e:
            self.logger.error(f"Proxy error for {url}: {e}")
            self.stats['proxy_failures'] += 1
            
            if proxy:
                proxy_manager.mark_proxy_failed(proxy, str(e))
            
            return None
            
        except requests.exceptions.Timeout as e:
            self.logger.error(f"Timeout error for {url}: {e}")
            self.stats['failed_requests'] += 1
            
            if proxy:
                proxy_manager.mark_proxy_failed(proxy, "Timeout")
            
            return None
            
        except Exception as e:
            self.logger.error(f"Unexpected error for {url}: {e}")
            self.stats['failed_requests'] += 1
            
            if proxy:
                proxy_manager.mark_proxy_failed(proxy, str(e))
            
            return None
    
    def _discover_university_pages(self, base_url: str) -> List[str]:
        """Discover relevant university pages to scrape"""
        self.logger.info(f"Discovering pages for {base_url}")
        
        # Keywords to look for in links
        # We want to strictly target pages that are likely to contain admission or fee data.
        # The following whitelist is intentionally narrow; many generic keywords like "news" or
        # "events" are explicitly excluded further below to avoid scraping irrelevant content.
        relevant_keywords = [
            # Admission-related
            'admission', 'admissions', 'apply', 'application', 'eligibility', 'requirements', 'criteria',
            # Financial-related
            'fee', 'fees', 'tuition', 'cost', 'finance', 'scholarship', 'scholarships', 'financial-aid',
            # Program pages often include fee/admission info but can be broad – keep but at lower priority
            'program', 'programs', 'undergraduate', 'graduate', 'postgraduate'
        ]

        # Exclude obvious non-relevant sections even if they contain a relevant keyword by coincidence
        excluded_keywords = [
            'event', 'events', 'news', 'story', 'stories', 'blog', 'press', 'calendar',
            'research', 'gallery', 'video', 'contact', 'about', 'faculty', 'career',
            'job', 'jobs', 'alumni', 'login', 'signup', 'profile'
        ]

        def is_relevant(href: str, text: str) -> bool:
            href_l = href.lower()
            text_l = text.lower()

            # If it contains an excluded keyword, skip immediately
            if any(bad in href_l or bad in text_l for bad in excluded_keywords):
                return False

            # Must contain at least one whitelist keyword
            return any(good in href_l or good in text_l for good in relevant_keywords)
        
        discovered_urls = set([base_url])
        
        try:
            # Get the main page
            response = self._make_request(base_url)
            if not response:
                return [base_url]
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all links
            links = soup.find_all('a', href=True)
            
            for link in links:
                raw_href = link.get('href', '')
                href = raw_href.lower()
                text = link.get_text(strip=True)

                if not raw_href:
                    continue

                # Only proceed if deemed relevant by our helper
                if is_relevant(href, text):
                    full_url = urljoin(base_url, raw_href)

                    # Keep same-domain links only
                    if urlparse(full_url).netloc == urlparse(base_url).netloc:
                        discovered_urls.add(full_url)
            
            # Sort by heuristic relevance: URLs with direct keyword matches earlier in the list.
            # We keep ordering stable for reproducibility.
            sorted_urls = sorted(
                discovered_urls,
                key=lambda u: (0 if any(k in u.lower() for k in ['admission', 'fee', 'tuition']) else 1, u)
            )

            max_pages = 10  # tighter cap to reduce unnecessary Claude calls
            self.logger.info(
                f"Discovered {len(discovered_urls)} potentially relevant pages; scraping up to {max_pages}"
            )
            return sorted_urls[:max_pages]
            
        except Exception as e:
            self.logger.error(f"Error discovering pages for {base_url}: {e}")
            return [base_url]
    
    def _extract_page_content(self, response: requests.Response) -> str:
        """Extract and clean HTML content from response"""
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header']):
                element.decompose()
            
            # Extract main content areas
            main_content = soup.find('main') or soup.find('div', class_=re.compile(r'content|main'))
            
            if main_content:
                return str(main_content)
            else:
                return str(soup)
                
        except Exception as e:
            self.logger.error(f"Error extracting page content: {e}")
            return response.text
    
    def scrape_university(self, university_data: Dict[str, Any]) -> Dict[str, Any]:
        """Scrape a single university with comprehensive data extraction"""
        university_name = university_data.get('name', 'Unknown')
        university_url = university_data.get('url', '')
        
        self.logger.info(f"Starting scrape for {university_name}")
        
        result = {
            'university_name': university_name,
            'url': university_url,
            'scraping_status': 'failed',
            'data': {
                'admission_dates': [],
                'criteria': [],
                'fee_structure': [],
                'scholarships': []
            },
            'pages_scraped': 0,
            'error_message': None,
            'scraped_at': datetime.now().isoformat()
        }
        
        try:
            # Discover relevant pages
            relevant_pages = self._discover_university_pages(university_url)
            
            all_extracted_data = {
                'admission_dates': [],
                'criteria': [],
                'fee_structure': [],
                'scholarships': []
            }
            
            # Scrape each relevant page
            for page_url in relevant_pages:
                try:
                    self.logger.info(f"Scraping page: {page_url}")
                    
                    # Get proxy if available
                    proxy = proxy_manager.get_proxy() if settings.USE_PROXIES else None
                    
                    # Add delay between requests
                    self._smart_delay()
                    
                    # Make request
                    response = self._make_request(page_url, proxy)
                    
                    if not response:
                        self.logger.warning(f"Failed to get response for {page_url}")
                        continue
                    
                    # Extract content
                    html_content = self._extract_page_content(response)
                    
                    # Extract data using Claude
                    extracted_data = claude_extractor.extract_all_data(html_content, page_url)
                    
                    # Merge extracted data
                    for data_type, data_list in extracted_data.items():
                        all_extracted_data[data_type].extend(data_list)
                    
                    result['pages_scraped'] += 1
                    self.stats['data_extracted'] += sum(len(data) for data in extracted_data.values())
                    
                    self.logger.info(f"Extracted data from {page_url}: "
                                   f"{sum(len(data) for data in extracted_data.values())} items")
                    
                except Exception as e:
                    self.logger.error(f"Error scraping page {page_url}: {e}")
                    continue
            
            # Remove duplicates and finalize data
            result['data'] = self._deduplicate_data(all_extracted_data)
            
            total_items = sum(len(data) for data in result['data'].values())
            
            if total_items > 0:
                result['scraping_status'] = 'completed'
                self.stats['universities_scraped'] += 1
                self.logger.info(f"Successfully scraped {university_name}: {total_items} total items")
            else:
                result['scraping_status'] = 'partial'
                result['error_message'] = 'No data extracted'
                self.logger.warning(f"No data extracted for {university_name}")
            
        except Exception as e:
            result['scraping_status'] = 'failed'
            result['error_message'] = str(e)
            self.logger.error(f"Failed to scrape {university_name}: {e}")
        
        return result
    
    def _deduplicate_data(self, data: Dict[str, List[Dict]]) -> Dict[str, List[Dict]]:
        """Remove duplicate entries from extracted data"""
        deduplicated = {}
        
        for data_type, items in data.items():
            seen = set()
            unique_items = []
            
            for item in items:
                # Create a simple hash for comparison
                item_key = str(sorted(item.items()))
                
                if item_key not in seen:
                    seen.add(item_key)
                    unique_items.append(item)
            
            deduplicated[data_type] = unique_items
            
            if len(items) != len(unique_items):
                self.logger.info(f"Removed {len(items) - len(unique_items)} duplicate {data_type} entries")
        
        return deduplicated
    
    def get_scraping_stats(self) -> Dict[str, Any]:
        """Get current scraping statistics"""
        return {
            **self.stats,
            'request_count': self.request_count,
            'session_age': (datetime.now() - self.session_start_time).seconds,
            'proxy_stats': proxy_manager.get_proxy_stats() if proxy_manager else None,
            'claude_stats': claude_extractor.get_extraction_stats()
        }
    
    def reset_stats(self):
        """Reset scraping statistics"""
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'proxy_failures': 0,
            'data_extracted': 0,
            'universities_scraped': 0
        }
        self.request_count = 0
        self.session_start_time = datetime.now()

# Global scraper instance
scraper_engine = UniversityScraperEngine() 
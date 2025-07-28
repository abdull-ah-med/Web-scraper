#!/usr/bin/env python3
"""
AI University Web Scraper - Main Entry Point
Scrapes Pakistani universities for admission data, fees, and scholarships using Claude AI
"""

import sys
import os
import argparse
import json
import logging
from typing import List, Dict, Any
from datetime import datetime
import asyncio

# Add the scraper directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import settings
from core.scraper_engine import scraper_engine
from core.proxy_manager import proxy_manager
from extractors.claude_extractor import claude_extractor

class UniversityScraperManager:
    """Main manager for university scraping operations"""
    
    def __init__(self):
        self.logger = self._setup_logger()
        self.scraped_data = []
        
    def _setup_logger(self) -> logging.Logger:
        """Setup main logger"""
        # Ensure logs directory exists
        os.makedirs(os.path.dirname(settings.LOG_FILE), exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, settings.LOG_LEVEL.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(settings.LOG_FILE),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        return logging.getLogger('ScraperManager')
    
    def validate_environment(self) -> bool:
        """Validate that all required environment variables and dependencies are set"""
        errors = []
        
        # Check Claude API key
        if not settings.CLAUDE_API_KEY:
            errors.append("CLAUDE_API_KEY environment variable not set")
        
        # Check MongoDB URI
        if not settings.MONGODB_URI or settings.MONGODB_URI == 'mongodb://localhost:27017/university_scraper':
            self.logger.warning("Using default MongoDB URI - make sure MongoDB is running locally")
        
        # Test proxy manager
        if settings.USE_PROXIES:
            if not proxy_manager:
                errors.append("Proxy manager failed to initialize")
            elif len(proxy_manager) == 0:
                self.logger.warning("No working proxies found - will scrape without proxies")
        
        if errors:
            for error in errors:
                self.logger.error(error)
            return False
        
        self.logger.info("Environment validation passed")
        return True
    
    def scrape_single_university(self, university_data: Dict[str, Any]) -> Dict[str, Any]:
        """Scrape a single university"""
        self.logger.info(f"Starting scrape for: {university_data.get('name', 'Unknown')}")
        
        try:
            result = scraper_engine.scrape_university(university_data)
            self.scraped_data.append(result)
            
            # Save individual result
            self._save_result_to_file(result)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error scraping university {university_data.get('name')}: {e}")
            return {
                'university_name': university_data.get('name', 'Unknown'),
                'url': university_data.get('url', ''),
                'scraping_status': 'failed',
                'error_message': str(e),
                'scraped_at': datetime.now().isoformat()
            }
    
    def scrape_multiple_universities(self, universities: List[Dict[str, Any]], 
                                   delay_between: int = 30) -> List[Dict[str, Any]]:
        """Scrape multiple universities with delays"""
        results = []
        total = len(universities)
        
        self.logger.info(f"Starting batch scrape of {total} universities")
        
        for i, university in enumerate(universities, 1):
            self.logger.info(f"Processing university {i}/{total}: {university.get('name')}")
            
            result = self.scrape_single_university(university)
            results.append(result)
            
            # Add delay between universities (except for the last one)
            if i < total:
                self.logger.info(f"Waiting {delay_between} seconds before next university...")
                import time
                time.sleep(delay_between)
        
        # Save batch results
        self._save_batch_results(results)
        
        return results
    
    def scrape_default_universities(self) -> List[Dict[str, Any]]:
        """Scrape the default list of Pakistani universities"""
        self.logger.info("Scraping default Pakistani universities")
        
        return self.scrape_multiple_universities(
            settings.PAKISTANI_UNIVERSITIES,
            delay_between=45  # Longer delay for better anti-detection
        )
    
    def _save_result_to_file(self, result: Dict[str, Any]):
        """Save individual scraping result to file"""
        try:
            # Create data directory if it doesn't exist
            os.makedirs('data', exist_ok=True)
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            university_name = result.get('university_name', 'unknown').replace(' ', '_').lower()
            filename = f"data/{university_name}_{timestamp}.json"
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info(f"Saved result to {filename}")
            
        except Exception as e:
            self.logger.error(f"Error saving result to file: {e}")
    
    def _save_batch_results(self, results: List[Dict[str, Any]]):
        """Save batch scraping results"""
        try:
            os.makedirs('data', exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"data/batch_scrape_{timestamp}.json"
            
            batch_data = {
                'scraped_at': datetime.now().isoformat(),
                'total_universities': len(results),
                'successful_scrapes': len([r for r in results if r.get('scraping_status') == 'completed']),
                'failed_scrapes': len([r for r in results if r.get('scraping_status') == 'failed']),
                'results': results
            }
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info(f"Saved batch results to {filename}")
            
        except Exception as e:
            self.logger.error(f"Error saving batch results: {e}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive scraping statistics"""
        scraper_stats = scraper_engine.get_scraping_stats()
        
        return {
            'session_stats': scraper_stats,
            'universities_processed': len(self.scraped_data),
            'successful_scrapes': len([r for r in self.scraped_data if r.get('scraping_status') == 'completed']),
            'failed_scrapes': len([r for r in self.scraped_data if r.get('scraping_status') == 'failed']),
            'total_data_extracted': sum(
                sum(len(data) for data in result.get('data', {}).values()) 
                for result in self.scraped_data
            )
        }
    
    def print_statistics(self):
        """Print comprehensive statistics"""
        stats = self.get_statistics()
        
        print("\n" + "="*60)
        print("SCRAPING STATISTICS")
        print("="*60)
        
        print(f"Universities Processed: {stats['universities_processed']}")
        print(f"Successful Scrapes: {stats['successful_scrapes']}")
        print(f"Failed Scrapes: {stats['failed_scrapes']}")
        print(f"Total Data Items Extracted: {stats['total_data_extracted']}")
        
        session_stats = stats['session_stats']
        print(f"\nSession Statistics:")
        print(f"  Total Requests: {session_stats['total_requests']}")
        print(f"  Successful Requests: {session_stats['successful_requests']}")
        print(f"  Failed Requests: {session_stats['failed_requests']}")
        print(f"  Proxy Failures: {session_stats['proxy_failures']}")
        
        if session_stats.get('proxy_stats'):
            proxy_stats = session_stats['proxy_stats']
            print(f"\nProxy Statistics:")
            print(f"  Working Proxies: {proxy_stats['working_proxies']}")
            print(f"  Failed Proxies: {proxy_stats['failed_proxies']}")
            print(f"  Average Response Time: {proxy_stats['avg_response_time']:.2f}s")
        
        print("="*60)

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='AI University Web Scraper for Pakistani Universities',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --scrape-all                    # Scrape all default universities
  python main.py --scrape-single "LUMS"          # Scrape specific university
  python main.py --list-universities             # List available universities
  python main.py --validate                      # Validate environment
  python main.py --stats                         # Show proxy and system stats
        """
    )
    
    parser.add_argument('--scrape-all', action='store_true',
                       help='Scrape all default Pakistani universities')
    
    parser.add_argument('--scrape-single', type=str, metavar='NAME',
                       help='Scrape a single university by name')
    
    parser.add_argument('--scrape-url', type=str, metavar='URL',
                       help='Scrape a university by URL')
    
    parser.add_argument('--list-universities', action='store_true',
                       help='List all available universities')
    
    parser.add_argument('--validate', action='store_true',
                       help='Validate environment and configuration')
    
    parser.add_argument('--stats', action='store_true',
                       help='Show current system statistics')
    
    parser.add_argument('--delay', type=int, default=45, metavar='SECONDS',
                       help='Delay between university scrapes (default: 45)')
    
    parser.add_argument('--no-proxies', action='store_true',
                       help='Disable proxy usage')
    
    args = parser.parse_args()
    
    # Initialize manager
    manager = UniversityScraperManager()
    
    # Disable proxies if requested
    if args.no_proxies:
        settings.USE_PROXIES = False
        manager.logger.info("Proxy usage disabled")
    
    try:
        if args.validate:
            if manager.validate_environment():
                print("✓ Environment validation passed")
                sys.exit(0)
            else:
                print("✗ Environment validation failed")
                sys.exit(1)
        
        elif args.list_universities:
            print("\nAvailable Pakistani Universities:")
            print("-" * 40)
            for i, uni in enumerate(settings.PAKISTANI_UNIVERSITIES, 1):
                print(f"{i:2d}. {uni['name']}")
                print(f"    URL: {uni['url']}")
                print(f"    City: {uni['city']} | Type: {uni['type']}")
                print()
            sys.exit(0)
        
        elif args.stats:
            stats = scraper_engine.get_scraping_stats()
            print("\nSystem Statistics:")
            print("-" * 30)
            print(f"Scraper Engine: Ready")
            print(f"Proxy Manager: {len(proxy_manager)} working proxies" if proxy_manager else "Disabled")
            print(f"Claude Extractor: Ready")
            if stats.get('proxy_stats'):
                proxy_stats = stats['proxy_stats']
                print(f"Best Proxy: {proxy_stats.get('best_proxy', {}).get('host', 'N/A')}")
            sys.exit(0)
        
        elif args.scrape_all:
            # Validate environment first
            if not manager.validate_environment():
                print("Environment validation failed. Please check configuration.")
                sys.exit(1)
            
            print("Starting comprehensive scrape of all Pakistani universities...")
            results = manager.scrape_default_universities()
            
            manager.print_statistics()
            
            successful = len([r for r in results if r.get('scraping_status') == 'completed'])
            print(f"\nScraping completed: {successful}/{len(results)} universities successful")
        
        elif args.scrape_single:
            # Find university by name
            university = None
            for uni in settings.PAKISTANI_UNIVERSITIES:
                if args.scrape_single.lower() in uni['name'].lower():
                    university = uni
                    break
            
            if not university:
                print(f"University '{args.scrape_single}' not found.")
                print("Use --list-universities to see available options.")
                sys.exit(1)
            
            if not manager.validate_environment():
                print("Environment validation failed. Please check configuration.")
                sys.exit(1)
            
            print(f"Scraping {university['name']}...")
            result = manager.scrape_single_university(university)
            
            if result.get('scraping_status') == 'completed':
                print(f"✓ Successfully scraped {university['name']}")
                total_items = sum(len(data) for data in result.get('data', {}).values())
                print(f"  Extracted {total_items} data items")
            else:
                print(f"✗ Failed to scrape {university['name']}")
                if result.get('error_message'):
                    print(f"  Error: {result['error_message']}")
        
        elif args.scrape_url:
            if not manager.validate_environment():
                print("Environment validation failed. Please check configuration.")
                sys.exit(1)
            
            university_data = {
                'name': f'Custom University ({args.scrape_url})',
                'url': args.scrape_url,
                'city': 'Unknown',
                'type': 'unknown'
            }
            
            print(f"Scraping {args.scrape_url}...")
            result = manager.scrape_single_university(university_data)
            
            if result.get('scraping_status') == 'completed':
                print(f"✓ Successfully scraped {args.scrape_url}")
                total_items = sum(len(data) for data in result.get('data', {}).values())
                print(f"  Extracted {total_items} data items")
            else:
                print(f"✗ Failed to scrape {args.scrape_url}")
                if result.get('error_message'):
                    print(f"  Error: {result['error_message']}")
        
        else:
            parser.print_help()
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n\nScraping interrupted by user")
        manager.print_statistics()
        sys.exit(1)
    
    except Exception as e:
        manager.logger.error(f"Unexpected error: {e}")
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main() 
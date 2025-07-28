import requests
import random
import time
import logging
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta
import threading

from config.settings import settings

@dataclass
class ProxyInfo:
    """Data class to store proxy information"""
    host: str
    port: int
    protocol: str = 'http'
    username: Optional[str] = None
    password: Optional[str] = None
    last_used: datetime = None
    success_count: int = 0
    failure_count: int = 0
    response_time: float = 0.0
    is_working: bool = True
    last_checked: datetime = None

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        total = self.success_count + self.failure_count
        return (self.success_count / total * 100) if total > 0 else 0

    @property
    def proxy_url(self) -> str:
        """Generate proxy URL string"""
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.host}:{self.port}"
        return f"{self.protocol}://{self.host}:{self.port}"

    def to_dict(self) -> Dict[str, str]:
        """Convert to requests-compatible proxy dict"""
        return {
            'http': self.proxy_url,
            'https': self.proxy_url
        }

class ProxyRotationManager:
    """Advanced proxy rotation manager with health checking and failover"""
    
    def __init__(self):
        self.proxies: List[ProxyInfo] = []
        self.working_proxies: List[ProxyInfo] = []
        self.failed_proxies: List[ProxyInfo] = []
        self.current_index = 0
        self.lock = threading.Lock()
        self.logger = self._setup_logger()
        
        # Configuration
        self.max_failures = 3
        self.health_check_interval = 300  # 5 minutes
        self.proxy_timeout = 10
        self.min_success_rate = 60
        
        # Initialize proxy list (only if proxies are enabled)
        if settings.USE_PROXIES:
            self._load_proxies()
        else:
            self.logger.info("Proxy usage disabled – skipping proxy loading")
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logging for proxy manager"""
        logger = logging.getLogger('ProxyManager')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.FileHandler(settings.LOG_FILE)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def _load_proxies(self):
        """Load proxies from various free sources"""
        self.logger.info("Loading proxies from free sources...")
        
        all_proxy_strings = []
        
        for source in settings.FREE_PROXY_SOURCES:
            try:
                self.logger.info(f"Fetching proxies from: {source}")
                response = requests.get(source, timeout=15)
                
                if response.status_code == 200:
                    proxy_strings = response.text.strip().split('\n')
                    all_proxy_strings.extend(proxy_strings)
                    self.logger.info(f"Fetched {len(proxy_strings)} proxies from {source}")
                    
            except Exception as e:
                self.logger.error(f"Failed to fetch proxies from {source}: {e}")
                continue
        
        # Parse proxy strings and create ProxyInfo objects
        self._parse_proxy_strings(all_proxy_strings)
        
        # Test proxies in parallel
        if self.proxies:
            self._test_proxies_parallel()
        else:
            self.logger.warning("No proxies loaded! Running without proxy rotation.")
    
    def _parse_proxy_strings(self, proxy_strings: List[str]):
        """Parse proxy strings into ProxyInfo objects"""
        for proxy_string in proxy_strings:
            try:
                proxy_string = proxy_string.strip()
                if not proxy_string or ':' not in proxy_string:
                    continue
                
                # Handle different proxy formats
                if '@' in proxy_string:
                    # Format: username:password@host:port
                    auth_part, host_part = proxy_string.split('@')
                    username, password = auth_part.split(':')
                    host, port = host_part.split(':')
                    
                    proxy_info = ProxyInfo(
                        host=host,
                        port=int(port),
                        username=username,
                        password=password
                    )
                else:
                    # Format: host:port
                    host, port = proxy_string.split(':')
                    proxy_info = ProxyInfo(host=host, port=int(port))
                
                self.proxies.append(proxy_info)
                
            except (ValueError, IndexError) as e:
                self.logger.debug(f"Failed to parse proxy string '{proxy_string}': {e}")
                continue
        
        self.logger.info(f"Parsed {len(self.proxies)} proxy entries")
    
    def _test_proxy(self, proxy: ProxyInfo) -> Tuple[ProxyInfo, bool]:
        """Test a single proxy and return result"""
        try:
            start_time = time.time()
            
            response = requests.get(
                settings.PROXY_TEST_URL,
                proxies=proxy.to_dict(),
                timeout=self.proxy_timeout,
                headers={'User-Agent': random.choice(settings.CUSTOM_USER_AGENTS)}
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                proxy.success_count += 1
                proxy.response_time = response_time
                proxy.is_working = True
                proxy.last_checked = datetime.now()
                return proxy, True
            else:
                proxy.failure_count += 1
                proxy.is_working = False
                return proxy, False
                
        except Exception as e:
            proxy.failure_count += 1
            proxy.is_working = False
            proxy.last_checked = datetime.now()
            self.logger.debug(f"Proxy test failed for {proxy.host}:{proxy.port} - {e}")
            return proxy, False
    
    def _test_proxies_parallel(self, max_workers: int = 50):
        """Test multiple proxies in parallel"""
        self.logger.info(f"Testing {len(self.proxies)} proxies...")
        
        working_count = 0
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_proxy = {
                executor.submit(self._test_proxy, proxy): proxy 
                for proxy in self.proxies
            }
            
            for future in as_completed(future_to_proxy):
                proxy, is_working = future.result()
                
                if is_working:
                    self.working_proxies.append(proxy)
                    working_count += 1
                else:
                    self.failed_proxies.append(proxy)
        
        self.logger.info(f"Proxy testing completed: {working_count}/{len(self.proxies)} working")
        
        # Sort working proxies by response time and success rate
        self.working_proxies.sort(key=lambda p: (p.response_time, -p.success_rate))
    
    def get_proxy(self) -> Optional[ProxyInfo]:
        """Get next working proxy with rotation"""
        with self.lock:
            if not self.working_proxies:
                self.logger.warning("No working proxies available!")
                return None
            
            # Get next proxy in rotation
            proxy = self.working_proxies[self.current_index]
            proxy.last_used = datetime.now()
            
            # Move to next proxy for rotation
            self.current_index = (self.current_index + 1) % len(self.working_proxies)
            
            return proxy
    
    def mark_proxy_failed(self, proxy: ProxyInfo, error: str = None):
        """Mark a proxy as failed and potentially remove it"""
        with self.lock:
            proxy.failure_count += 1
            proxy.is_working = False
            
            self.logger.warning(f"Proxy {proxy.host}:{proxy.port} failed: {error}")
            
            # Remove from working proxies if failure rate is too high
            if (proxy.failure_count >= self.max_failures or 
                proxy.success_rate < self.min_success_rate):
                
                if proxy in self.working_proxies:
                    self.working_proxies.remove(proxy)
                    self.failed_proxies.append(proxy)
                    
                self.logger.info(f"Removed proxy {proxy.host}:{proxy.port} from rotation")
                
                # Adjust current index if needed
                if self.current_index >= len(self.working_proxies) and self.working_proxies:
                    self.current_index = 0
    
    def mark_proxy_success(self, proxy: ProxyInfo, response_time: float = None):
        """Mark a proxy as successful"""
        proxy.success_count += 1
        proxy.is_working = True
        proxy.last_used = datetime.now()
        
        if response_time:
            proxy.response_time = response_time
    
    def get_proxy_stats(self) -> Dict:
        """Get current proxy statistics"""
        return {
            'total_proxies': len(self.proxies),
            'working_proxies': len(self.working_proxies),
            'failed_proxies': len(self.failed_proxies),
            'current_index': self.current_index,
            'avg_response_time': sum(p.response_time for p in self.working_proxies) / len(self.working_proxies) if self.working_proxies else 0,
            'best_proxy': {
                'host': self.working_proxies[0].host,
                'response_time': self.working_proxies[0].response_time,
                'success_rate': self.working_proxies[0].success_rate
            } if self.working_proxies else None
        }
    
    def refresh_proxies(self):
        """Refresh proxy list by fetching new ones"""
        self.logger.info("Refreshing proxy list...")
        
        # Reset current state
        self.proxies.clear()
        self.working_proxies.clear()
        self.failed_proxies.clear()
        self.current_index = 0
        
        # Reload proxies
        self._load_proxies()
    
    def health_check(self):
        """Perform health check on working proxies"""
        if not self.working_proxies:
            return
        
        self.logger.info("Performing proxy health check...")
        
        # Test a sample of working proxies
        sample_size = min(10, len(self.working_proxies))
        sample_proxies = random.sample(self.working_proxies, sample_size)
        
        failed_proxies = []
        
        for proxy in sample_proxies:
            _, is_working = self._test_proxy(proxy)
            if not is_working:
                failed_proxies.append(proxy)
        
        # Remove failed proxies from working list
        for proxy in failed_proxies:
            self.mark_proxy_failed(proxy, "Health check failed")
        
        self.logger.info(f"Health check completed. Removed {len(failed_proxies)} failed proxies")
    
    def __len__(self) -> int:
        """Return number of working proxies"""
        return len(self.working_proxies)
    
    def __bool__(self) -> bool:
        """Return True if there are working proxies"""
        return len(self.working_proxies) > 0

# Global proxy manager instance
proxy_manager = ProxyRotationManager() 
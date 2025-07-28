import json
import logging
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
import re
from anthropic import Anthropic, APIError, RateLimitError

from config.settings import settings

class ClaudeDataExtractor:
    """Claude AI-powered data extractor for university information"""
    
    def __init__(self):
        self.client = Anthropic(api_key=settings.CLAUDE_API_KEY)
        self.logger = self._setup_logger()
        
        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 1.0  # Minimum 1 second between requests
        self.max_retries = 3
        self.retry_delay = 5  # seconds
        
        # Token management
        self.max_tokens = 4000
        self.max_input_length = 15000  # characters
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logging for Claude extractor"""
        logger = logging.getLogger('ClaudeExtractor')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.FileHandler(settings.LOG_FILE)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def _clean_html_content(self, html_content: str) -> str:
        """Clean and prepare HTML content for Claude API"""
        # Remove script and style tags
        html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove comments
        html_content = re.sub(r'<!--.*?-->', '', html_content, flags=re.DOTALL)
        
        # Remove excessive whitespace
        html_content = re.sub(r'\s+', ' ', html_content)
        html_content = html_content.strip()
        
        # Truncate if too long
        if len(html_content) > self.max_input_length:
            html_content = html_content[:self.max_input_length] + "..."
            self.logger.warning(f"HTML content truncated to {self.max_input_length} characters")
        
        return html_content
    
    def _rate_limit(self):
        """Implement rate limiting between API calls"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        
        if time_since_last_request < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last_request
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _make_claude_request(self, prompt: str, html_content: str) -> Optional[str]:
        """Make a request to Claude API with error handling and retries"""
        cleaned_html = self._clean_html_content(html_content)
        full_prompt = prompt.format(html_content=cleaned_html)
        
        # Debug logging
        if settings.LOG_LEVEL.upper() == 'DEBUG':
            self.logger.debug(f"Making Claude request with prompt length: {len(full_prompt)}")
            self.logger.debug(f"API key present: {bool(settings.CLAUDE_API_KEY)}")
        
        for attempt in range(self.max_retries):
            try:
                self._rate_limit()
                
                # Debug log before API call
                if settings.LOG_LEVEL.upper() == 'DEBUG':
                    self.logger.debug(f"Attempt {attempt + 1}: Calling Claude API...")
                
                # Use completions API for anthropic 0.7.8
                response = self.client.completions.create(
                    model="claude-v1",
                    prompt=f"{self.client.HUMAN_PROMPT} {full_prompt} {self.client.AI_PROMPT}",
                    max_tokens_to_sample=self.max_tokens,
                    temperature=0.1,  # Low temperature for consistent structured output
                )
                
                # Debug log after API call
                if settings.LOG_LEVEL.upper() == 'DEBUG':
                    self.logger.debug(f"Claude API response received, length: {len(response.completion) if response.completion else 0}")
                
                return response.completion
                
            except RateLimitError as e:
                self.logger.warning(f"Rate limit hit, waiting {self.retry_delay * (attempt + 1)} seconds...")
                time.sleep(self.retry_delay * (attempt + 1))
                continue
                
            except APIError as e:
                self.logger.error(f"Claude API error (attempt {attempt + 1}): {e}")
                if attempt == self.max_retries - 1:
                    return None
                time.sleep(self.retry_delay)
                continue
                
            except Exception as e:
                self.logger.error(f"Unexpected error in Claude request (attempt {attempt + 1}): {e}")
                if attempt == self.max_retries - 1:
                    return None
                time.sleep(self.retry_delay)
                continue
        
        return None
    
    def _parse_json_response(self, response: str, data_type: str) -> List[Dict]:
        """Parse Claude's JSON response with error handling"""
        if not response:
            return []
        
        try:
            # Log raw response for debugging
            if settings.LOG_LEVEL.upper() == 'DEBUG':
                self.logger.debug(f"Raw Claude response for {data_type}: {response[:500]}...")
            
            # Clean up common JSON formatting issues
            cleaned_response = response.strip()
            
            # Remove markdown code blocks if present
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            
            # Remove extra whitespace and newlines
            cleaned_response = cleaned_response.strip()
            
            # Try to find JSON array in the response
            start_idx = cleaned_response.find('[')
            end_idx = cleaned_response.rfind(']')
            
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = cleaned_response[start_idx:end_idx + 1]
                parsed_data = json.loads(json_str)
                
                if isinstance(parsed_data, list):
                    self.logger.info(f"Successfully parsed {len(parsed_data)} {data_type} items")
                    return parsed_data
            
            # If no valid JSON array found, try parsing the whole response
            parsed_data = json.loads(cleaned_response)
            if isinstance(parsed_data, list):
                return parsed_data
            elif isinstance(parsed_data, dict):
                return [parsed_data]  # Wrap single item in list
            else:
                self.logger.warning(f"Unexpected JSON structure for {data_type}: {type(parsed_data)}")
                return []
                
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing error for {data_type}: {e}")
            self.logger.error(f"Raw response that failed to parse: {response[:1000]}")
            
            # Save failed response for debugging
            with open(f"logs/failed_claude_response_{data_type}.txt", "w") as f:
                f.write(f"Error: {e}\n\nRaw response:\n{response}")
            
            return []
        except Exception as e:
            self.logger.error(f"Unexpected error parsing {data_type} response: {e}")
            return []
    
    def extract_admission_dates(self, html_content: str, url: str) -> List[Dict]:
        """Extract admission dates and deadlines"""
        self.logger.info(f"Extracting admission dates from {url}")
        
        response = self._make_claude_request(
            settings.CLAUDE_PROMPTS['admission_dates'],
            html_content
        )
        
        if not response:
            self.logger.error(f"Failed to get admission dates from Claude for {url}")
            return []
        
        admission_dates = self._parse_json_response(response, 'admission_dates')
        
        # Validate and clean the data
        validated_dates = []
        for date_info in admission_dates:
            try:
                # Validate required fields
                if not all(key in date_info for key in ['program', 'deadline', 'term', 'type']):
                    continue
                
                # Validate date format
                if isinstance(date_info['deadline'], str):
                    datetime.strptime(date_info['deadline'], '%Y-%m-%d')
                
                validated_dates.append(date_info)
                
            except (ValueError, KeyError) as e:
                self.logger.debug(f"Invalid admission date entry: {e}")
                continue
        
        self.logger.info(f"Extracted {len(validated_dates)} valid admission dates")
        return validated_dates
    
    def extract_admission_criteria(self, html_content: str, url: str) -> List[Dict]:
        """Extract admission criteria and requirements"""
        self.logger.info(f"Extracting admission criteria from {url}")
        
        response = self._make_claude_request(
            settings.CLAUDE_PROMPTS['admission_criteria'],
            html_content
        )
        
        if not response:
            self.logger.error(f"Failed to get admission criteria from Claude for {url}")
            return []
        
        criteria = self._parse_json_response(response, 'admission_criteria')
        
        # Validate and clean the data
        validated_criteria = []
        for criterion in criteria:
            try:
                # Validate required fields
                if not all(key in criterion for key in ['program', 'min_marks']):
                    continue
                
                # Ensure lists are actually lists
                for list_field in ['required_tests', 'required_subjects', 'other_requirements']:
                    if list_field not in criterion:
                        criterion[list_field] = []
                    elif not isinstance(criterion[list_field], list):
                        criterion[list_field] = [str(criterion[list_field])]
                
                validated_criteria.append(criterion)
                
            except (ValueError, KeyError) as e:
                self.logger.debug(f"Invalid admission criteria entry: {e}")
                continue
        
        self.logger.info(f"Extracted {len(validated_criteria)} valid admission criteria")
        return validated_criteria
    
    def extract_fee_structure(self, html_content: str, url: str) -> List[Dict]:
        """Extract fee structure and costs"""
        self.logger.info(f"Extracting fee structure from {url}")
        
        response = self._make_claude_request(
            settings.CLAUDE_PROMPTS['fee_structure'],
            html_content
        )
        
        if not response:
            self.logger.error(f"Failed to get fee structure from Claude for {url}")
            return []
        
        fees = self._parse_json_response(response, 'fee_structure')
        
        # Validate and clean the data
        validated_fees = []
        for fee_info in fees:
            try:
                # Validate required fields
                if not all(key in fee_info for key in ['program', 'tuition_fee', 'total_per_semester']):
                    continue
                
                # Ensure currency is set
                if 'currency' not in fee_info:
                    fee_info['currency'] = 'PKR'
                
                # Ensure other_fees is a dict
                if 'other_fees' not in fee_info:
                    fee_info['other_fees'] = {}
                elif not isinstance(fee_info['other_fees'], dict):
                    fee_info['other_fees'] = {}
                
                validated_fees.append(fee_info)
                
            except (ValueError, KeyError) as e:
                self.logger.debug(f"Invalid fee structure entry: {e}")
                continue
        
        self.logger.info(f"Extracted {len(validated_fees)} valid fee structures")
        return validated_fees
    
    def extract_scholarships(self, html_content: str, url: str) -> List[Dict]:
        """Extract scholarship information"""
        self.logger.info(f"Extracting scholarships from {url}")
        
        response = self._make_claude_request(
            settings.CLAUDE_PROMPTS['scholarships'],
            html_content
        )
        
        if not response:
            self.logger.error(f"Failed to get scholarships from Claude for {url}")
            return []
        
        scholarships = self._parse_json_response(response, 'scholarships')
        
        # Validate and clean the data
        validated_scholarships = []
        for scholarship in scholarships:
            try:
                # Validate required fields
                if not all(key in scholarship for key in ['name', 'amount']):
                    continue
                
                # Ensure lists are actually lists
                if 'eligibility' not in scholarship:
                    scholarship['eligibility'] = []
                elif not isinstance(scholarship['eligibility'], list):
                    scholarship['eligibility'] = [str(scholarship['eligibility'])]
                
                # Handle deadline field
                if 'deadline' in scholarship and scholarship['deadline']:
                    try:
                        if isinstance(scholarship['deadline'], str):
                            datetime.strptime(scholarship['deadline'], '%Y-%m-%d')
                    except ValueError:
                        scholarship['deadline'] = None
                
                # Set default values
                if 'renewable' not in scholarship:
                    scholarship['renewable'] = False
                
                validated_scholarships.append(scholarship)
                
            except (ValueError, KeyError) as e:
                self.logger.debug(f"Invalid scholarship entry: {e}")
                continue
        
        self.logger.info(f"Extracted {len(validated_scholarships)} valid scholarships")
        return validated_scholarships
    
    def extract_all_data(self, html_content: str, url: str) -> Dict[str, List[Dict]]:
        """Extract all types of data from a university webpage"""
        self.logger.info(f"Starting comprehensive data extraction for {url}")
        
        results = {
            'admission_dates': [],
            'criteria': [],
            'fee_structure': [],
            'scholarships': []
        }
        
        try:
            # Extract each type of data
            results['admission_dates'] = self.extract_admission_dates(html_content, url)
            results['criteria'] = self.extract_admission_criteria(html_content, url)
            results['fee_structure'] = self.extract_fee_structure(html_content, url)
            results['scholarships'] = self.extract_scholarships(html_content, url)
            
            total_extracted = sum(len(data) for data in results.values())
            self.logger.info(f"Extraction completed for {url}. Total items: {total_extracted}")
            
        except Exception as e:
            self.logger.error(f"Error during comprehensive extraction for {url}: {e}")
        
        return results
    
    def get_extraction_stats(self) -> Dict[str, Any]:
        """Get statistics about Claude API usage"""
        return {
            'last_request_time': self.last_request_time,
            'min_request_interval': self.min_request_interval,
            'max_retries': self.max_retries,
            'max_tokens': self.max_tokens,
            'max_input_length': self.max_input_length
        }

# Global extractor instance
claude_extractor = ClaudeDataExtractor() 
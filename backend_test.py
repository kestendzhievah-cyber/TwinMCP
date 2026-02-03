#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, List, Tuple

class TwinMCPAPITester:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.auth_token = "demo-bearer-token"  # Mock token for testing

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def test_get_request(self, name: str, endpoint: str, expected_status: int = 200, 
                        expected_fields: List[str] = None) -> Tuple[bool, Dict]:
        """Test GET request to endpoint"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, timeout=10)
            
            if response.status_code != expected_status:
                self.log_test(name, False, f"Expected status {expected_status}, got {response.status_code}")
                return False, {}
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                self.log_test(name, False, "Invalid JSON response")
                return False, {}
            
            # Check expected fields if provided
            if expected_fields:
                missing_fields = [field for field in expected_fields if field not in data]
                if missing_fields:
                    self.log_test(name, False, f"Missing fields: {missing_fields}")
                    return False, data
            
            self.log_test(name, True, f"Status: {response.status_code}", data)
            return True, data
            
        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_post_request(self, name: str, endpoint: str, data: Dict, 
                         expected_status: int = 200, headers: Dict = None) -> Tuple[bool, Dict]:
        """Test POST request to endpoint"""
        url = f"{self.base_url}/{endpoint}"
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=10)
            
            if response.status_code != expected_status:
                self.log_test(name, False, f"Expected status {expected_status}, got {response.status_code}")
                return False, {}
            
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                self.log_test(name, False, "Invalid JSON response")
                return False, {}
            
            self.log_test(name, True, f"Status: {response.status_code}", response_data)
            return True, response_data
            
        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_mcp_server_info(self):
        """Test GET /api/mcp - server info and tools list"""
        print("\n🔍 Testing MCP Server Info...")
        
        expected_fields = ["name", "version", "description", "endpoints", "tools", "status"]
        success, data = self.test_get_request(
            "MCP Server Info", 
            "api/mcp", 
            expected_fields=expected_fields
        )
        
        if success:
            # Verify tools are present
            tools = data.get("tools", [])
            expected_tools = ["resolve-library-id", "query-docs"]
            
            for tool_name in expected_tools:
                tool_found = any(tool.get("name") == tool_name for tool in tools)
                if tool_found:
                    self.log_test(f"Tool '{tool_name}' present", True)
                else:
                    self.log_test(f"Tool '{tool_name}' present", False, f"Tool not found in response")
            
            # Verify endpoints
            endpoints = data.get("endpoints", {})
            expected_endpoints = ["mcp", "mcpOauth", "libraries"]
            
            for endpoint in expected_endpoints:
                if endpoint in endpoints:
                    self.log_test(f"Endpoint '{endpoint}' configured", True)
                else:
                    self.log_test(f"Endpoint '{endpoint}' configured", False, f"Endpoint not found")

    def test_libraries_catalog(self):
        """Test GET /api/libraries - library catalog with pagination"""
        print("\n🔍 Testing Libraries Catalog...")
        
        expected_fields = ["libraries", "pagination", "filters", "stats"]
        success, data = self.test_get_request(
            "Libraries Catalog", 
            "api/libraries", 
            expected_fields=expected_fields
        )
        
        if success:
            # Check pagination structure
            pagination = data.get("pagination", {})
            pagination_fields = ["total", "page", "limit", "totalPages"]
            
            for field in pagination_fields:
                if field in pagination:
                    self.log_test(f"Pagination field '{field}' present", True)
                else:
                    self.log_test(f"Pagination field '{field}' present", False)
            
            # Check libraries array
            libraries = data.get("libraries", [])
            if libraries:
                self.log_test("Libraries array not empty", True, f"Found {len(libraries)} libraries")
                
                # Check first library structure
                first_lib = libraries[0]
                lib_fields = ["id", "name", "vendor", "ecosystem", "description", "versions"]
                
                for field in lib_fields:
                    if field in first_lib:
                        self.log_test(f"Library field '{field}' present", True)
                    else:
                        self.log_test(f"Library field '{field}' present", False)
            else:
                self.log_test("Libraries array not empty", False, "No libraries found")

    def test_libraries_search(self):
        """Test GET /api/libraries?search=react - filtering"""
        print("\n🔍 Testing Libraries Search...")
        
        success, data = self.test_get_request(
            "Libraries Search (React)", 
            "api/libraries?search=react"
        )
        
        if success:
            libraries = data.get("libraries", [])
            
            # Check if React is in results
            react_found = False
            for lib in libraries:
                if "react" in lib.get("name", "").lower() or "react" in lib.get("description", "").lower():
                    react_found = True
                    break
            
            if react_found:
                self.log_test("React library found in search", True)
            else:
                self.log_test("React library found in search", False, "React not found in search results")
            
            # Test pagination with search
            pagination = data.get("pagination", {})
            if "total" in pagination:
                self.log_test("Search pagination working", True, f"Total results: {pagination['total']}")
            else:
                self.log_test("Search pagination working", False, "Pagination missing in search results")

    def test_oauth_discovery(self):
        """Test GET /api/mcp/oauth - OAuth discovery info"""
        print("\n🔍 Testing OAuth Discovery...")
        
        expected_fields = ["name", "version", "authMethod", "oauth", "supportedClients"]
        success, data = self.test_get_request(
            "OAuth Discovery Info", 
            "api/mcp/oauth", 
            expected_fields=expected_fields
        )
        
        if success:
            # Check OAuth configuration
            oauth_config = data.get("oauth", {})
            oauth_fields = ["clientId", "authorizationEndpoint", "tokenEndpoint", "scopes"]
            
            for field in oauth_fields:
                if field in oauth_config:
                    self.log_test(f"OAuth field '{field}' present", True)
                else:
                    self.log_test(f"OAuth field '{field}' present", False)
            
            # Check supported clients
            supported_clients = data.get("supportedClients", [])
            expected_clients = ["claude-code", "cursor"]
            
            for client in expected_clients:
                if client in supported_clients:
                    self.log_test(f"Client '{client}' supported", True)
                else:
                    self.log_test(f"Client '{client}' supported", False)

    def test_mcp_json_rpc_initialize(self):
        """Test MCP JSON-RPC initialize method"""
        print("\n🔍 Testing MCP JSON-RPC Initialize...")
        
        json_rpc_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {}
        }
        
        # This should fail without API key, but we test the JSON-RPC format
        success, data = self.test_post_request(
            "MCP JSON-RPC Initialize (no auth)", 
            "api/mcp", 
            json_rpc_request,
            expected_status=401  # Expected to fail without auth
        )
        
        if success:
            # Check JSON-RPC response format
            if "jsonrpc" in data and data["jsonrpc"] == "2.0":
                self.log_test("JSON-RPC format correct", True)
            else:
                self.log_test("JSON-RPC format correct", False, "Invalid JSON-RPC format")
            
            if "error" in data:
                error = data["error"]
                if "code" in error and "message" in error:
                    self.log_test("Error format correct", True, f"Error: {error['message']}")
                else:
                    self.log_test("Error format correct", False, "Invalid error format")

    def test_api_keys_management(self):
        """Test GET /api/v1/api-keys - API keys management endpoints"""
        print("\n🔍 Testing API Keys Management...")
        
        headers = {'Authorization': f'Bearer {self.auth_token}'}
        
        # Test GET /api/v1/api-keys
        success, data = self.test_get_request_with_headers(
            "API Keys List", 
            "api/v1/api-keys",
            headers=headers,
            expected_fields=["apiKeys", "total"]
        )
        
        if success:
            api_keys = data.get("apiKeys", [])
            self.log_test("API Keys array present", True, f"Found {len(api_keys)} keys")
            
            # Test POST /api/v1/api-keys
            create_data = {
                "name": "Test API Key",
                "tier": "free",
                "permissions": ["resolve-library-id", "query-docs"]
            }
            
            success_create, create_response = self.test_post_request(
                "Create API Key",
                "api/v1/api-keys",
                create_data,
                expected_status=201,
                headers=headers
            )
            
            if success_create:
                if "apiKey" in create_response and "key" in create_response["apiKey"]:
                    self.log_test("API Key creation returns full key", True)
                else:
                    self.log_test("API Key creation returns full key", False, "Missing key in response")

    def test_usage_tracking(self):
        """Test GET /api/v1/usage - Usage tracking endpoint"""
        print("\n🔍 Testing Usage Tracking...")
        
        headers = {'Authorization': f'Bearer {self.auth_token}'}
        
        success, data = self.test_get_request_with_headers(
            "Usage Statistics", 
            "api/v1/usage",
            headers=headers,
            expected_fields=["summary", "byTool", "usageOverTime", "quotas"]
        )
        
        if success:
            summary = data.get("summary", {})
            summary_fields = ["totalRequests", "totalTokens", "avgResponseTime", "successRate"]
            
            for field in summary_fields:
                if field in summary:
                    self.log_test(f"Usage summary field '{field}' present", True)
                else:
                    self.log_test(f"Usage summary field '{field}' present", False)
            
            # Test with different periods
            for period in ["day", "week", "month"]:
                success_period, _ = self.test_get_request_with_headers(
                    f"Usage Statistics ({period})", 
                    f"api/v1/usage?period={period}",
                    headers=headers
                )

    def test_admin_crawl_endpoint(self):
        """Test GET /api/admin/crawl - Admin crawl endpoint"""
        print("\n🔍 Testing Admin Crawl Endpoint...")
        
        headers = {'X-Admin-Key': 'test-admin-key'}
        
        # Test GET /api/admin/crawl
        success, data = self.test_get_request_with_headers(
            "Admin Crawl Status", 
            "api/admin/crawl",
            headers=headers,
            expected_status=403  # Expected to fail without proper admin key
        )
        
        # Test without admin key (should fail)
        success_no_auth, _ = self.test_get_request(
            "Admin Crawl (no auth)", 
            "api/admin/crawl",
            expected_status=403
        )

    def test_get_request_with_headers(self, name: str, endpoint: str, headers: Dict = None, 
                                   expected_status: int = 200, expected_fields: List[str] = None) -> Tuple[bool, Dict]:
        """Test GET request with custom headers"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, headers=headers or {}, timeout=10)
            
            if response.status_code != expected_status:
                self.log_test(name, False, f"Expected status {expected_status}, got {response.status_code}")
                return False, {}
            
            try:
                data = response.json()
            except json.JSONDecodeError:
                self.log_test(name, False, "Invalid JSON response")
                return False, {}
            
            # Check expected fields if provided
            if expected_fields:
                missing_fields = [field for field in expected_fields if field not in data]
                if missing_fields:
                    self.log_test(name, False, f"Missing fields: {missing_fields}")
                    return False, data
            
            self.log_test(name, True, f"Status: {response.status_code}", data)
            return True, data
            
        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting TwinMCP API Tests...")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test all endpoints
        self.test_mcp_server_info()
        self.test_libraries_catalog()
        self.test_libraries_search()
        self.test_oauth_discovery()
        self.test_mcp_json_rpc_initialize()
        self.test_mcp_tools_list()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed")
            return 1

def main():
    tester = TwinMCPAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
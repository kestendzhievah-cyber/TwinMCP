@echo off
REM AgentFlow Project Setup Script for Windows
echo 🚀 AgentFlow Project Setup
echo ==========================

REM Check if MCP server directory exists
if exist "mcp-server-demo" (
    echo ✅ MCP Server found in separate directory

    REM Setup MCP Server
    echo 📦 Setting up MCP Server...
    cd mcp-server-demo
    npm install
    npm run build
    cd ..

    echo 🌐 MCP Server ready on http://localhost:3003
    echo    Run: cd mcp-server-demo ^&^& npm run dev
) else (
    echo ❌ MCP Server directory not found
)

REM Setup main application
echo 🎨 Setting up AgentFlow application...
npm install
npm run build

echo ✅ AgentFlow application ready
echo 🌐 Application ready on http://localhost:3000
echo    Run: npm run dev

echo.
echo 📋 Project Structure:
echo ├── Corel.IA/           ← Next.js Application
echo └── mcp-server-demo/    ← MCP Server (Separate)
echo.
echo 🚀 To start both services:
echo 1. Terminal 1: npm run dev (AgentFlow App)
echo 2. Terminal 2: cd mcp-server-demo ^&^& npm run dev (MCP Server)

pause

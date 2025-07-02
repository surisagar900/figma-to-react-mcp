#!/bin/bash

# Frontend Dev MCP Server Installation Script

echo "🚀 Setting up Frontend Dev MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. You have version $NODE_VERSION."
    exit 1
fi

echo "✅ Node.js version check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Playwright browsers"
    exit 1
fi

echo "✅ Playwright browsers installed successfully"

# Copy environment template
if [ ! -f ".env" ]; then
    echo "📝 Creating environment configuration..."
    cp env.template .env
    echo "✅ Environment template created as .env"
    echo "⚠️  Please edit .env file with your API tokens before running the server"
else
    echo "ℹ️  .env file already exists, skipping template copy"
fi

# Build the project
echo "🏗️  Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build the project"
    exit 1
fi

echo "✅ Project built successfully"

# Run tests to verify installation
echo "🧪 Running tests to verify installation..."
npm test

if [ $? -ne 0 ]; then
    echo "⚠️  Some tests failed, but installation is complete"
else
    echo "✅ All tests passed"
fi

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your API tokens:"
echo "   - GitHub Personal Access Token"
echo "   - Figma Access Token"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Or start the production server:"
echo "   npm start"
echo ""
echo "For more information, check the README.md file." 
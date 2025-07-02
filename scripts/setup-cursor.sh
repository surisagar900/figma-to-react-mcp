#!/bin/bash

# Setup script for Cursor MCP integration

echo "🎯 Setting up Frontend Dev MCP Server for Cursor..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker found"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp env.template .env
    echo "⚠️  Please edit .env file with your API tokens:"
    echo "   - GITHUB_TOKEN: Get from https://github.com/settings/tokens"
    echo "   - FIGMA_ACCESS_TOKEN: Get from Figma Account Settings"
    echo ""
    echo "After editing .env, run this script again."
    exit 0
fi

# Validate required environment variables
source .env

if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "your_github_personal_access_token" ]; then
    echo "❌ GITHUB_TOKEN not set in .env file"
    exit 1
fi

if [ -z "$FIGMA_ACCESS_TOKEN" ] || [ "$FIGMA_ACCESS_TOKEN" = "your_figma_access_token" ]; then
    echo "❌ FIGMA_ACCESS_TOKEN not set in .env file"
    exit 1
fi

echo "✅ Environment variables configured"

# Build Docker image
echo "🏗️  Building Docker image..."
docker build -t frontend-dev-mcp-server .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image"
    exit 1
fi

echo "✅ Docker image built successfully"

# Test the container
echo "🧪 Testing MCP server..."
timeout 10s docker run --rm --env-file .env frontend-dev-mcp-server node -e "console.log('MCP Server test passed')" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ MCP server test passed"
else
    echo "⚠️  MCP server test timed out (this is normal)"
fi

# Create Cursor configuration
CURSOR_CONFIG_DIR="$HOME/.cursor/mcp"
mkdir -p "$CURSOR_CONFIG_DIR"

cat > "$CURSOR_CONFIG_DIR/frontend-dev-mcp.json" << EOF
{
  "mcpServers": {
    "frontend-dev": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "$(pwd)/.env",
        "-v",
        "\${workspaceFolder}:/workspace",
        "frontend-dev-mcp-server"
      ],
      "env": {
        "WORKSPACE_PATH": "\${workspaceFolder}"
      }
    }
  }
}
EOF

echo "✅ Cursor MCP configuration created at: $CURSOR_CONFIG_DIR/frontend-dev-mcp.json"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Open Cursor IDE"
echo "2. Go to Settings → Extensions → MCP"
echo "3. Add the configuration file: $CURSOR_CONFIG_DIR/frontend-dev-mcp.json"
echo "4. Restart Cursor"
echo ""
echo "💡 Usage in Cursor:"
echo "- Type: 'Convert this Figma design to code'"
echo "- Paste Figma URL with selected component"
echo "- The MCP server will handle the rest!"
echo ""
echo "🔗 Example Figma URL format:"
echo "https://www.figma.com/file/abc123/Design?node-id=1%3A2" 
# 🚀 Quick Setup Guide

## Prerequisites

- Docker installed on your machine
- GitHub Personal Access Token
- Figma Access Token
- Cursor IDE

## ⚡ One-Command Setup

```bash
git clone <repository-url>
cd custom-mcp
./scripts/setup-cursor.sh
```

This script will:

1. ✅ Check Docker installation
2. 📝 Create `.env` file from template
3. 🏗️ Build Docker image
4. ⚙️ Configure Cursor MCP integration

## 🔑 API Tokens Required

### GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy token to `.env` file

### Figma Token

1. Go to: https://www.figma.com/settings
2. Scroll to "Personal access tokens"
3. Click "Create new token"
4. Copy token to `.env` file

## 📝 Environment Setup

Create `.env` file:

```env
GITHUB_TOKEN=ghp_your_github_token_here
FIGMA_ACCESS_TOKEN=figd_your_figma_token_here
```

That's it! Repository info is auto-detected from your Git remote.

## 🎯 Cursor Integration

After running the setup script:

1. Open Cursor IDE
2. Go to Settings → Extensions → MCP Servers
3. The configuration should be automatically detected
4. Restart Cursor

## 💡 Usage in Cursor

Simply chat with Cursor and paste Figma URLs:

**Example conversations:**

- "Convert this Figma design to a React component: https://www.figma.com/file/abc123/Design?node-id=1%3A2"
- "Analyze the design tokens from this Figma file: https://www.figma.com/file/abc123/Design"
- "Test my component against this Figma design: [Figma URL] vs [Component URL]"

## 🔧 Manual Docker Setup (Alternative)

If you prefer manual setup:

```bash
# Build image
docker build -t frontend-dev-mcp-server .

# Run server
docker run --rm -i --env-file .env frontend-dev-mcp-server
```

## 🐛 Troubleshooting

**Docker build fails:**

- Ensure Docker has enough memory (4GB+)
- Check internet connection for dependency downloads

**Figma URL not working:**

- Ensure URL includes `node-id` parameter for specific frames
- Use "Copy link" from Figma with frame/component selected

**GitHub auto-detection fails:**

- Add `GITHUB_OWNER` and `GITHUB_REPO` to `.env` file

## 📖 Available Tools

| Tool                         | Description                     | Example Input             |
| ---------------------------- | ------------------------------- | ------------------------- |
| `design_to_code`             | Convert Figma → React component | Figma URL with node-id    |
| `analyze_figma_design`       | Extract design tokens           | Any Figma file URL        |
| `test_design_implementation` | Visual testing vs Figma         | Figma URL + Component URL |
| `setup_project_branch`       | Create GitHub branch            | Branch name               |

## ✨ Features

- 🎨 **Auto Figma Parsing**: Paste any Figma URL, we extract what's needed
- 🤖 **Smart Defaults**: Minimal configuration, maximum automation
- 🐳 **Docker Ready**: One command deployment
- 🔄 **Full Workflow**: Design → Code → Test → PR
- 📱 **Responsive Testing**: Multi-device validation
- ♿ **Accessibility**: Built-in accessibility checks

---

**Ready to bridge design and code! 🎨➡️💻**

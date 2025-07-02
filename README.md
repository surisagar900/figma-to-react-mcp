# Figma to React MCP

A powerful MCP (Model Context Protocol) server that converts Figma designs into React components automatically. Combines GitHub, Figma, and Playwright integrations for a seamless design-to-React workflow.

## ✨ Features

- **🎨 Figma Integration**: Extract designs, components, and design tokens from Figma files
- **🐙 GitHub Integration**: Create branches, generate pull requests, and manage repository operations
- **🎭 Playwright Integration**: Automated visual testing and browser automation
- **⚛️ React-Focused**: Generates TypeScript React functional components with proper typing
- **🔄 Automated Workflow**: Figma design → React component → GitHub PR in one step
- **📦 NPX Distribution**: Easy installation and setup via npx

## 🚀 Quick Start

### Easy Installation with npx

```bash
# Interactive setup (recommended for first-time users)
npx figma-to-react-mcp --setup

# Or run directly if you have tokens configured
GITHUB_TOKEN=xxx FIGMA_ACCESS_TOKEN=yyy npx figma-to-react-mcp
```

The `--setup` command will:

- Prompt for your GitHub and Figma tokens
- Configure environment variables
- Set up Cursor MCP integration automatically
- Create all necessary configuration files

### Manual Setup

1. **Get your API tokens**:

   - **GitHub**: Go to Settings → Developer settings → Personal access tokens → Generate new token with `repo` permissions
   - **Figma**: Go to Figma Settings → Account → Personal access tokens → Generate new token

2. **Run with environment variables**:
   ```bash
   GITHUB_TOKEN=your_github_token FIGMA_ACCESS_TOKEN=your_figma_token npx figma-to-react-mcp
   ```

## 🛠️ Available Tools

### 1. `design_to_code`

Converts Figma designs to **React TypeScript components** and creates GitHub PRs.

**What you get**:

- React functional component with TypeScript
- Responsive CSS styles
- Proper component structure and props
- Automatic GitHub branch and PR creation

**Example usage in Cursor**:

- Paste a Figma URL: `https://www.figma.com/file/abc123/Design?node-id=1%3A2`
- Specify component name: `HeroButton`
- Get a complete React component with GitHub PR

### 2. `test_design_implementation`

Tests generated **React components** against Figma designs using visual regression testing and accessibility validation.

### 3. `analyze_figma_design`

Analyzes Figma designs and extracts design tokens, components, and structure.

### 4. `create_design_pr`

Creates GitHub PRs with generated **React components** and comprehensive test results.

### 5. `setup_project_branch`

Creates new GitHub branches for feature development.

## 📋 CLI Commands

```bash
npx figma-to-react-mcp --setup    # Interactive setup
npx figma-to-react-mcp --help     # Show help
npx figma-to-react-mcp --version  # Show version
npx figma-to-react-mcp            # Start MCP server
```

## ⚙️ Cursor Integration

After running `npx figma-to-react-mcp --setup`, the MCP server will be automatically configured in Cursor.

**Manual Cursor Setup** (if needed):
Add this to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "frontend-dev": {
      "command": "npx",
      "args": ["figma-to-react-mcp"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "FIGMA_ACCESS_TOKEN": "your_figma_token_here"
      }
    }
  }
}
```

## 🔧 Configuration

### Environment Variables

**Required**:

- `GITHUB_TOKEN`: GitHub Personal Access Token with `repo` permissions
- `FIGMA_ACCESS_TOKEN`: Figma Access Token from your account settings

**Optional**:

- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`) - default: `info`
- `PLAYWRIGHT_BROWSER`: Browser to use (`chromium`, `firefox`, `webkit`) - default: `chromium`

## 📚 Usage Examples

### Basic Workflow

1. **Setup once**:

   ```bash
   npx frontend-dev-mcp-server --setup
   ```

2. **In Cursor**, use the MCP tools:
   - Open a Figma design
   - Copy the URL (with node selection)
   - Use the `design_to_code` tool
   - Get a React component + GitHub PR automatically

### Design to Code Flow

```
Figma Design URL → Extract Design Tokens → Generate React Component → Run Tests → GitHub PR
                                          ↓
                              TypeScript + CSS + Tests
```

## 🏗️ Development

### Local Development

```bash
git clone <your-repo>
cd figma-to-react-mcp
npm install
npm run build
npm run dev
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## 📦 Publishing

To publish your own version:

1. Update `package.json` with your package name
2. Build the project: `npm run build`
3. Publish: `npm publish`

## 🛠️ Architecture

- **MCP SDK**: Model Context Protocol implementation
- **TypeScript**: Type-safe development
- **Playwright**: Browser automation and testing
- **Octokit**: GitHub API integration
- **Axios**: HTTP client for Figma API
- **Zod**: Runtime type validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

- Create an issue in the GitHub repository
- Run `npx figma-to-react-mcp --help` for CLI help
- Check the interactive setup: `npx figma-to-react-mcp --setup`

---

**Happy coding! 🎨➡️💻**

Made with ❤️ for frontend developers who want to automate their design-to-code workflow.

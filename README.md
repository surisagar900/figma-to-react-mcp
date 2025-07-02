# Frontend Dev MCP Server

A unified MCP (Model Context Protocol) server for frontend developers that combines GitHub, Figma, and Playwright integrations to streamline the design-to-code workflow.

## 🚀 Features

### 🔄 End-to-End Workflows

- **Design-to-Code**: Extract Figma designs and generate React components automatically
- **Visual Testing**: Compare generated components with original Figma designs
- **Automated PR Creation**: Create pull requests with test results and explanations

### 🎨 Figma Integration

- Fetch design files and frames
- Extract design tokens (colors, fonts, spacing)
- Analyze component structures
- Download design assets

### 🐙 GitHub Integration

- Create branches and pull requests
- Commit generated code
- Repository management
- Automated workflow documentation

### 🎭 Playwright Integration

- Visual regression testing
- Screenshot comparison
- Responsive design testing
- Accessibility validation
- E2E testing capabilities

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd custom-mcp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Install Playwright browsers**

   ```bash
   npx playwright install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API tokens
   ```

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_default_repo

# Figma Configuration
FIGMA_ACCESS_TOKEN=your_figma_access_token

# Playwright Configuration
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TIMEOUT=30000

# Server Configuration
MCP_SERVER_NAME=frontend-dev-mcp-server
LOG_LEVEL=info
```

### Getting API Tokens

#### GitHub Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` and `workflow` scopes
3. Copy the token to your `.env` file

#### Figma Token

1. Go to Figma → Settings → Account → Personal access tokens
2. Generate a new token
3. Copy the token to your `.env` file

## 🏗️ Usage

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🛠️ Available Tools

### Workflow Tools

#### `workflow_design_to_code`

Execute complete design-to-code workflow from Figma to GitHub.

**Parameters:**

- `figmaFileId`: Figma file ID
- `frameId`: Frame ID to convert
- `componentName`: Name for the generated component
- `outputPath`: Output directory path
- `githubBranch`: GitHub branch name

**Example:**

```json
{
  "figmaFileId": "abc123def456",
  "frameId": "1:2",
  "componentName": "Hero Button",
  "outputPath": "./src/components",
  "githubBranch": "feature/hero-button"
}
```

#### `workflow_visual_testing`

Execute visual testing workflow with Figma comparison.

**Parameters:**

- `figmaFileId`: Figma file ID
- `frameId`: Frame ID for comparison
- `componentName`: Component name
- `componentUrl`: URL of the component to test
- `outputPath`: Output directory path
- `githubBranch`: GitHub branch name

#### `workflow_create_pr_with_results`

Create pull request with test results and component code.

### GitHub Tools

#### `github_create_branch`

Create a new branch in the GitHub repository.

### Figma Tools

#### `figma_get_file`

Get Figma file information and structure.

## 🏛️ Architecture

```
src/
├── config/           # Configuration management
├── integrations/     # External service integrations
│   ├── github.ts    # GitHub API integration
│   ├── figma.ts     # Figma API integration
│   └── playwright.ts # Playwright browser automation
├── services/        # Business logic services
│   └── workflow.ts  # Workflow orchestration
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   └── logger.ts    # Logging utility
└── index.ts         # Main MCP server entry point
```

## 🧪 Testing

The project includes comprehensive unit tests for all major components:

- **Configuration validation**
- **Logger functionality**
- **Integration services**
- **Workflow orchestration**

## 📝 Workflow Examples

### Complete Design-to-Code Workflow

1. **Extract Figma Design**

   ```bash
   # The workflow automatically:
   # - Fetches the Figma frame
   # - Analyzes design tokens
   # - Extracts component structure
   ```

2. **Generate Component Code**

   ```bash
   # Generates:
   # - React component with TypeScript
   # - CSS styles from design tokens
   # - Component documentation
   ```

3. **Create GitHub Branch & Commit**

   ```bash
   # Automatically:
   # - Creates new branch
   # - Commits generated files
   # - Includes descriptive commit message
   ```

4. **Run Visual Tests**

   ```bash
   # Tests include:
   # - Visual regression testing
   # - Responsive design validation
   # - Accessibility checks
   ```

5. **Create Pull Request**
   ```bash
   # PR includes:
   # - Generated component code
   # - Test results summary
   # - Visual comparison screenshots
   # - Implementation notes
   ```

## 🔧 Development

### Project Structure

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Jest**: Unit testing framework
- **Prettier**: Code formatting (optional)

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the existing issues
2. Create a new issue with detailed description
3. Include relevant logs and configuration

## 🎯 Roadmap

- [ ] Support for Vue.js and Angular component generation
- [ ] Advanced design token extraction (gradients, shadows)
- [ ] Integration with design systems
- [ ] Automated component documentation generation
- [ ] Advanced accessibility testing
- [ ] Performance testing integration
- [ ] Multi-framework support

---

**Built with ❤️ for frontend developers who want to bridge the gap between design and code.**

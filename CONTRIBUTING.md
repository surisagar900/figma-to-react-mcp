# Contributing to Frontend Dev MCP Server

## Development Workflow

This project uses automated publishing to npm via GitHub Actions. Here's how it works:

### Automatic Publishing 🚀

When you push changes to the `main` branch, the system automatically:

1. **Runs tests and linting** - Ensures code quality
2. **Detects changes** - Only publishes if `src/` or `package.json` changed
3. **Determines version bump** based on commit message:
   - `BREAKING CHANGE` or `breaking change` → **major** version (1.0.0 → 2.0.0)
   - `feat:` or `feature:` → **minor** version (1.0.0 → 1.1.0)
   - Everything else → **patch** version (1.0.0 → 1.0.1)
4. **Publishes to npm** with new version
5. **Creates GitHub release** with changelog

### Commit Message Examples

```bash
# Patch version (1.0.0 → 1.0.1)
git commit -m "fix: resolve token validation issue"
git commit -m "docs: update README"
git commit -m "chore: refactor error handling"

# Minor version (1.0.0 → 1.1.0)
git commit -m "feat: add new Figma integration"
git commit -m "feature: support multiple GitHub accounts"

# Major version (1.0.0 → 2.0.0)
git commit -m "feat: redesign CLI interface

BREAKING CHANGE: removed --legacy flag, use --config instead"
```

### Manual Publishing (Local)

If you need to publish manually:

```bash
# Patch version
npm run release:patch

# Minor version
npm run release:minor

# Major version
npm run release:major
```

### Setup GitHub Actions

To enable auto-publishing, add these secrets to your GitHub repository:

1. **`NPM_TOKEN`** - Your npm automation token:

   - Go to https://www.npmjs.com/settings/tokens
   - Create "Automation" token
   - Add as repository secret

2. **`GITHUB_TOKEN`** - Automatically provided by GitHub Actions

### Development Commands

```bash
# Development
npm run dev          # Watch mode with hot reload
npm run build        # Build TypeScript
npm test             # Run tests
npm run lint         # Check code style
npm run lint:fix     # Fix code style issues

# Testing the CLI
node dist/index.js --version
node dist/index.js --setup
```

### Before Committing

Always run these locally:

```bash
npm run build
npm test
npm run lint
```

The GitHub Action will run these checks too, but catching issues early saves time.

### Release Notes

The system automatically generates release notes from your commit messages. Write clear, descriptive commits for better changelog.

### File Structure

Only changes to these trigger publishing:

- `src/` - Source code
- `package.json` - Package configuration

Changes to docs, tests, or config files won't trigger a new release.

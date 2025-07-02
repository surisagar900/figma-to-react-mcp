# Distribution Guide

This guide explains how to distribute your Frontend Dev MCP Server as an npx package.

## 🚀 Quick Distribution Steps

### 1. Pre-Publishing Setup

```bash
# Ensure everything builds correctly
npm install
npm run build

# Test the CLI locally
node dist/index.js --help
node dist/index.js --setup
```

### 2. Update Package Information

Edit `package.json` and update:

- `name`: Choose a unique package name on npm
- `version`: Follow semantic versioning (e.g., `1.0.0`)
- `repository.url`: Your GitHub repository URL
- `bugs.url`: Your GitHub issues URL
- `homepage`: Your GitHub repository URL

### 3. Test Package Locally

```bash
# Link the package locally
npm link

# Test the npx command
npx your-package-name --help
npx your-package-name --setup
```

### 4. Publish to npm

```bash
# Login to npm (one time)
npm login

# Check what will be published
npm pack --dry-run

# Publish the package
npm publish

# For scoped packages (first time)
npm publish --access public
```

## 📋 Pre-Publication Checklist

- [ ] Package name is unique and available on npm
- [ ] Version number is updated
- [ ] All dependencies are properly listed
- [ ] Build process completes successfully
- [ ] CLI commands work locally
- [ ] README.md is comprehensive
- [ ] LICENSE file exists
- [ ] Repository URLs are correct

## 🧪 Testing Distribution

After publishing, test your package:

```bash
# Install and test from npm
npx your-package-name --setup
npx your-package-name --help
npx your-package-name --version
```

## 🔄 Updating Versions

For updates:

1. Make your changes
2. Update version in `package.json`:
   - Patch: `1.0.1` (bug fixes)
   - Minor: `1.1.0` (new features)
   - Major: `2.0.0` (breaking changes)
3. Build and test
4. Publish: `npm publish`

## 📦 What Gets Published

The package includes only:

- `dist/` - Compiled JavaScript
- `README.md` - Documentation
- `cursor-mcp-config.json` - Cursor configuration template
- `package.json` - Package metadata

## 🎯 User Experience

Once published, users can:

```bash
# One-command setup
npx your-package-name --setup

# Direct usage with tokens
GITHUB_TOKEN=xxx FIGMA_ACCESS_TOKEN=yyy npx your-package-name

# Get help
npx your-package-name --help
```

## 🔧 Troubleshooting

**Common Issues:**

1. **Package name conflicts**: Choose a unique name
2. **Permission errors**: Ensure you're logged in with `npm login`
3. **Missing files**: Check the `files` array in `package.json`
4. **Build errors**: Run `npm run build` before publishing

## 🌟 Best Practices

- Use semantic versioning
- Keep package name descriptive but concise
- Include comprehensive README
- Test thoroughly before publishing
- Monitor download statistics on npmjs.com
- Respond to user issues promptly

---

Your MCP server is now ready for global distribution! 🚀

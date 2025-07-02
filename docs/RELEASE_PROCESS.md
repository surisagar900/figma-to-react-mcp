# 🚀 Release Process Guide

This document outlines the different approaches for releasing new versions of `figma-to-react-mcp`.

## 📋 Version Types

### 🐛 Patch (x.y.Z)

- **When to use**: Bug fixes, documentation updates, minor improvements
- **Examples**:
  - Fix component generation bug
  - Update README
  - Fix TypeScript types
- **Backwards Compatible**: ✅ Yes

### ✨ Minor (x.Y.0)

- **When to use**: New features, enhancements, new tools
- **Examples**:
  - Add new MCP tool
  - Enhance component generation
  - Add new CLI features
- **Backwards Compatible**: ✅ Yes

### 💥 Major (X.0.0)

- **When to use**: Breaking changes, major refactors, API changes
- **Examples**:
  - Change MCP tool interfaces
  - Remove deprecated features
  - Major architecture changes
- **Backwards Compatible**: ❌ No

## 🛠️ Release Methods

### Method 1: Interactive CLI (Recommended)

The most user-friendly approach with guided prompts:

```bash
# Run interactive release manager
npm run release

# Or use the JavaScript version
node scripts/interactive-release.cjs
```

**Features**:

- ✅ Shows recent git changes
- ✅ Prompts for version type with explanations
- ✅ Confirmation before proceeding
- ✅ Automated testing, building, and publishing
- ✅ Git tagging and pushing
- ✅ Version reference updates

**Example Output**:

```
🚀 Figma to React MCP Release Manager

Current version: 2.0.0

📋 Recent changes:
5c2bf24 chore: bump version to 2.0.0 for React-only release
8b20e9a feat: make package explicitly React-only

🎯 Select version bump type:

1. 🐛 Patch (2.0.0 → 2.0.1)
   - Bug fixes, documentation updates
   - No new features or breaking changes

2. ✨ Minor (2.0.0 → 2.1.0)
   - New features, enhancements
   - Backwards compatible changes

3. 💥 Major (2.0.0 → 3.0.0)
   - Breaking changes
   - API changes, major refactors

Enter your choice (1/2/3):
```

### Method 2: GitHub Actions (Web UI)

Perfect for team environments and remote releases:

1. **Go to GitHub Actions tab**
2. **Select "Manual Release" workflow**
3. **Click "Run workflow"**
4. **Choose version type from dropdown**
5. **Add optional release notes**
6. **Click "Run workflow"**

**Features**:

- ✅ Web-based interface
- ✅ Team accessible
- ✅ Automated testing and publishing
- ✅ GitHub Release creation
- ✅ No local setup required

### Method 3: Direct NPM Scripts

Quick one-command releases for experienced developers:

```bash
# Patch release (2.0.0 → 2.0.1)
npm run release:patch

# Minor release (2.0.0 → 2.1.0)
npm run release:minor

# Major release (2.0.0 → 3.0.0)
npm run release:major
```

**Features**:

- ✅ Fast and direct
- ✅ No prompts (good for CI/CD)
- ❌ No safety checks
- ❌ Manual version reference updates

## 📝 Pre-Release Checklist

Before any release, ensure:

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code builds successfully (`npm run build`)
- [ ] Documentation is up to date
- [ ] CHANGELOG.md is updated (if applicable)
- [ ] Breaking changes are documented
- [ ] All commits are pushed to main branch

## 🔄 Post-Release Steps

After successful release:

1. **Verify npm package**: Check https://www.npmjs.com/package/figma-to-react-mcp
2. **Test installation**: `npx figma-to-react-mcp@latest --version`
3. **Update documentation**: If needed, update README or docs
4. **Announce release**: Share in relevant channels/communities

## 🚨 Emergency Releases

For critical bugs requiring immediate fixes:

1. **Create hotfix branch**: `git checkout -b hotfix/critical-fix`
2. **Make minimal fix**: Only fix the critical issue
3. **Test thoroughly**: Run all tests
4. **Fast-track release**: Use Method 3 for quick patch release
5. **Follow up**: Plan proper fix for next minor release

## 🛡️ Rollback Process

If a release has issues:

### NPM Rollback

```bash
# Deprecate problematic version
npm deprecate figma-to-react-mcp@2.1.0 "Deprecated due to critical bug"

# Unpublish if within 24 hours
npm unpublish figma-to-react-mcp@2.1.0
```

### Git Rollback

```bash
# Revert the release commit
git revert <release-commit-hash>

# Delete the tag
git tag -d v2.1.0
git push origin :refs/tags/v2.1.0
```

## 📊 Release Analytics

Track release success with:

- **NPM stats**: `npm view figma-to-react-mcp`
- **Download metrics**: Check npmjs.com package page
- **GitHub releases**: Monitor download counts
- **Issue reports**: Watch for bug reports post-release

## 🤝 Team Workflow

For teams:

1. **Use GitHub Actions** for consistent releases
2. **Require PR reviews** before merging to main
3. **Set up branch protection** on main branch
4. **Use semantic commit messages** for auto-detection
5. **Document breaking changes** in PR descriptions

## 📞 Support

If you encounter issues with the release process:

1. Check the logs for error details
2. Verify npm and GitHub tokens are valid
3. Ensure you have proper repository permissions
4. Create an issue with full error output

---

_This release process ensures consistent, reliable, and safe deployments of figma-to-react-mcp._

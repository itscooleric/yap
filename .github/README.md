# .github Directory

This directory contains GitHub-specific configuration, issue templates, and Copilot instructions for the Yap project.

## Contents

### 📝 Issue Templates

#### Chat Tab Review
- **`ISSUE_CHAT_TAB_REVIEW.md`** - Comprehensive testing checklist for the Chat tab feature
  - 18 major testing sections
  - 150+ specific test items
  - Complete documentation for manual testing
  - Security, performance, and accessibility reviews
  - **Use this**: Full reference for thorough testing

- **`ISSUE_TEMPLATE_CHAT_REVIEW.md`** - Quick issue template for GitHub
  - Condensed version for creating GitHub issues
  - Essential checklists and setup instructions
  - Progress tracking format
  - **Use this**: Copy-paste to create a tracking issue

### 🤖 Copilot Configuration

- **`copilot-instructions.md`** - Main Copilot instructions for Yap development
  - Project overview and architecture
  - Development workflow
  - Code patterns and conventions
  - Tool usage guidelines

### 🎯 Specialized Prompts

Located in `prompts/`:
- `chat-feature-agent.md` - LLM chat feature implementation guide
- `new-tab.md` - Adding new tabs to the UI
- `new-service.md` - Creating new backend microservices
- `code-review.md` - Code review guidelines

See [`prompts/README.md`](prompts/README.md) for details.

### 🤖 Agent Configurations

Located in `agents/`:
- `chat-feature.agent.md` - Specialized agent for chat feature development

## Creating a GitHub Issue for Chat Tab Testing

### Option 1: Using the Quick Template (Recommended)

1. Go to the [Issues page](../../issues) on GitHub
2. Click "New Issue"
3. Copy content from [`ISSUE_TEMPLATE_CHAT_REVIEW.md`](ISSUE_TEMPLATE_CHAT_REVIEW.md)
4. Paste into the issue description
5. Edit title: "Review and Test Chat Tab Feature"
6. Add labels: `testing`, `chat`, `review`, `qa`, `high-priority`
7. Assign team members
8. Click "Submit new issue"

### Option 2: Using the Full Reference

If you need the complete testing details:
1. Create a new issue as above
2. Reference the full document: [`ISSUE_CHAT_TAB_REVIEW.md`](ISSUE_CHAT_TAB_REVIEW.md)
3. Link to it in the issue: "See [full testing checklist](.github/ISSUE_CHAT_TAB_REVIEW.md)"

## Using GitHub Issue Templates

To make this template available automatically:

1. Create `.github/ISSUE_TEMPLATE/` directory
2. Add `chat-review.md`:
   ```yaml
   ---
   name: Chat Tab Review
   about: Track testing and review of the Chat tab feature
   title: 'Review and Test Chat Tab Feature'
   labels: testing, chat, review, qa
   assignees: ''
   ---
   ```
3. Include content from `ISSUE_TEMPLATE_CHAT_REVIEW.md` below the frontmatter

## Related Documentation

- [Main README](../README.md) - Project overview
- [Chat Implementation Summary](../CHAT_IMPLEMENTATION_SUMMARY.md) - What was built
- [Chat Design Docs](../docs/CHAT_DESIGN_README.md) - Design specifications
- [User Guide](../docs/USER_GUIDE.md) - User documentation
- [Testing README](../tests/README.md) - Automated test documentation

## Contributing

When adding new issue templates:
1. Create a comprehensive reference document (like `ISSUE_CHAT_TAB_REVIEW.md`)
2. Create a quick template version (like `ISSUE_TEMPLATE_CHAT_REVIEW.md`)
3. Update this README with usage instructions
4. Consider adding to `.github/ISSUE_TEMPLATE/` for automatic availability

## Questions?

- Review [Copilot Instructions](copilot-instructions.md) for development patterns
- Check [prompts/README.md](prompts/README.md) for specialized guidance
- See existing issue templates for examples

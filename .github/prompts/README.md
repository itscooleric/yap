# Yap Prompts

Specialized prompts for AI coding agents working on Yap.

## Available Prompts

| Prompt | Description |
|--------|-------------|
| [chat-feature-agent.md](chat-feature-agent.md) | Full implementation guide for LLM chat feature |
| [new-tab.md](new-tab.md) | Template for adding UI tabs with boilerplate code |
| [new-service.md](new-service.md) | Template for creating backend microservices |
| [code-review.md](code-review.md) | Checklist for reviewing code against Yap conventions |

## How to Use

### VS Code Copilot Chat

1. Open Copilot Chat (`Ctrl+Shift+I` or click chat icon)
2. Click **📎 Attach** or press `Ctrl+/`
3. Select **Attach File** → navigate to `.github/prompts/`
4. Choose the relevant prompt file
5. Type your request - Copilot follows the prompt's instructions

### Agent Mode / Copilot Edits

Reference prompts directly in your request:

```
Follow the pattern in .github/prompts/new-service.md to create an LLM proxy service
```

### Combining Prompts

For complex tasks, attach multiple prompts:

1. Attach `chat-feature-agent.md` (overall feature guidance)
2. Attach `new-tab.md` (UI patterns)
3. Ask: "Create the chat tab UI following these patterns"

## Creating New Prompts

Use this structure:

```markdown
name: yap-{prompt-name}
description: One-line description

instructions: |
  Context about when to use this prompt.
  
  ## Section 1
  - Bullet points for guidance
  
  ## Section 2
  Code examples with triple backticks
```

Keep prompts focused on one task. Reference other prompts for related tasks.

---
name: AI agent executive tools (function-calling + approval)
description: How the 9-agent team proposes executive actions and how they get approved/executed safely.
---

# Agent executive tools — propose → approve → execute

Agents never execute side effects directly. The flow is: agent emits a fenced
```action JSON block → server parses it → logs a PENDING `ai_agent_actions` row →
admin approves in `/admin/ai-agents` → server executes the real effect.

**Key constraints / lessons:**
- WhatsApp sending is DISABLED in this codebase (`sendWhatsAppMessage` returns failure).
  Any "send to customer" tool must use in-app `createNotification` + DB updates, NOT WhatsApp.
- Tool role-gating must be enforced **server-side in two places**, not just by filtering
  the prompt: when parsing the proposal (skip if `!isToolAllowed(agent.name, tool)`) AND
  again in the approve endpoint before `executeTool`. A model can hallucinate a tool name
  outside its allow-list, so prompt-level filtering alone is bypassable.
- Approval must be **idempotent**: the approve endpoint atomically claims the row
  (`UPDATE ... SET status='processing' WHERE id=$1 AND status='pending' RETURNING *`)
  and returns 409 if no row. Without this, double-click / concurrent approvals re-run
  side effects (duplicate broadcasts, repeated price changes). `status` is a plain
  VARCHAR(50) with no CHECK constraint, so transient states like 'processing' are fine.

**Why:** these were the two blocking findings in code review — broken authorization
boundary and replayable side effects.

**Client gotcha:** `adminFetch`/`adminApiRequest` in admin pages return the raw
`Response`, not parsed JSON. Call `.json()` in the mutationFn before reading the body
(e.g. `execResult`), otherwise onSuccess sees a Response object.

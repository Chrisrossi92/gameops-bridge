# AI Operator Reasoning Gateway

`POST /api/operator/reason` is the protected gateway that will later connect sanitized Operator context to Codex-style reasoning.

It does not install, invoke, or depend on Codex yet. Current mode is a deterministic placeholder.

## Endpoint

```sh
curl -sS \
  -H "content-type: application/json" \
  -H "x-gameops-operator-key: $GAMEOPS_OPERATOR_KEY" \
  -d '{"request":"analyze-current-context"}' \
  http://127.0.0.1:3001/api/operator/reason
```

The endpoint is admin-protected by `GAMEOPS_OPERATOR_KEY`. It is not dashboard-public.

## Current Request

Only one request is supported:

```json
{
  "request": "analyze-current-context"
}
```

An optional `question` field may be included for display context, but the gateway still runs the fixed read-only analysis.

## Current Response

The response includes:

- `engine: "placeholder"`
- read-only status
- answer headline and bullets
- capped evidence from the sanitized context pack
- limitations
- recommended next actions
- confidence

## Security Model

The gateway builds the existing Operator context pack internally and reasons only over that sanitized summary.

Current safeguards:

- no shell execution
- no restart, deploy, update, cleanup, or write actions
- no Codex call
- no external AI call
- no raw logs
- no file contents
- redaction applied
- capped evidence and bounded response fields

Treat responses as operationally sensitive. They may include server health, repo names, branch names, warning summaries, and deployment-relevant recommendations.

## Future Codex Integration

Future Codex integration should happen behind this server-side gateway, after the same context-pack sanitization and admin authorization checks. The browser should not receive `GAMEOPS_OPERATOR_KEY`, Codex credentials, raw logs, or file contents.

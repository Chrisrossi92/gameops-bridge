# AI Operator Context Pack

`GET /api/operator/context-pack` prepares a sanitized, read-only Operator context bundle for future Codex reasoning.

It is admin-protected with `GAMEOPS_OPERATOR_KEY` and is not exposed through the dashboard-safe browser endpoints.

Example:

```bash
curl -s \
  -H "x-gameops-operator-key: $GAMEOPS_OPERATOR_KEY" \
  http://127.0.0.1:3001/api/operator/context-pack
```

The response includes:

- current operator brief
- daily brief
- what changed
- operator insights
- recent timeline events, capped
- repository state summaries
- warnings and recommended focus items

Safety notes:

- The context pack is read-only.
- It does not include raw logs.
- It does not include file contents.
- It applies the Operator redaction layer to strings.
- It is intended to be safe to copy into Codex for future reasoning.
- Treat it as operationally sensitive because it may include server state, repo names, branch names, and deployment-relevant summaries.

Do not point Operator config at `.env`, SSH, certificate, private key, or database dump paths.

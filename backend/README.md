# AgentGate Backend

FastAPI backend for AgentGate — human authorization gateway for AI agent transactions.

## Running locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/docs`.

---

## MCP Server

AgentGate ships a built-in MCP (Model Context Protocol) server so any AI agent
on any platform can use AgentGate as a native tool — no SDK install required.

### Tools exposed

| Tool | Description |
|------|-------------|
| `authorize_transaction` | Submit a transaction for authorization before executing it |
| `check_authorization_status` | Poll a pending request for human approval |
| `cancel_authorization` | Cancel a pending request that is no longer needed |

### Remote (recommended for production)

Connect directly to the deployed server — no local setup required.

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "agentgate": {
      "url": "https://agent-gate-production.up.railway.app/mcp"
    }
  }
}
```

**Cursor** (`.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "agentgate": {
      "url": "https://agent-gate-production.up.railway.app/mcp"
    }
  }
}
```

**VS Code** (`.vscode/mcp.json` in your project):

```json
{
  "servers": {
    "agentgate": {
      "type": "http",
      "url": "https://agent-gate-production.up.railway.app/mcp"
    }
  }
}
```

### Local (for development)

Run the FastAPI app locally (`uvicorn app.main:app --reload`), then use stdio
transport to point your client at it:

**Claude Desktop / Cursor (local):**

```json
{
  "mcpServers": {
    "agentgate": {
      "command": "python",
      "args": ["backend/mcp_runner.py"],
      "env": {
        "AGENTGATE_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### Testing with MCP Inspector

```bash
pip install mcp[cli]
mcp dev backend/mcp_runner.py
```

This opens the MCP Inspector in your browser where you can invoke all three
tools interactively with test credentials.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTGATE_API_URL` | `https://agent-gate-production.up.railway.app` | Base URL the MCP tools call |

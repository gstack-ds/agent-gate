-- OAuth 2.1 tables for MCP authentication
-- Public clients only (no client_secret); tokens stored as SHA-256 hashes.

CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id   TEXT PRIMARY KEY,
    redirect_uri_prefixes  JSONB NOT NULL DEFAULT '[]',
    client_name TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash             TEXT NOT NULL UNIQUE,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id             TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    redirect_uri          TEXT NOT NULL,
    code_challenge        TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    scope                 TEXT NOT NULL DEFAULT 'authorize',
    expires_at            TIMESTAMPTZ NOT NULL,
    used_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash  TEXT NOT NULL UNIQUE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id   TEXT NOT NULL,
    scope       TEXT NOT NULL DEFAULT 'authorize',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user    ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires  ON oauth_auth_codes(expires_at);

-- Built-in public client: accepts any localhost callback (MCP standard)
INSERT INTO oauth_clients (client_id, redirect_uri_prefixes, client_name)
VALUES ('mcp-default', '["http://localhost", "http://127.0.0.1"]', 'MCP Client')
ON CONFLICT (client_id) DO NOTHING;

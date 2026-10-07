/**
 * Which usage provider reports the quota a model provider bills against.
 *
 * Quota provider ids mostly match OpenCode provider ids; these are the ones
 * that do not. Unmatched ids pass through unchanged and match nothing.
 *
 * `claude-code` is the provider the opencode-claude integration registers, and
 * it bills against the same Claude subscription the `claude` quota reports.
 * `kilocode` / `kilo-code` are the same Kilo Gateway account as `kilo`.
 */
const QUOTA_PROVIDER_ALIASES = new Map<string, string>([
  ['openai', 'codex'],
  ['chatgpt', 'codex'],
  ['anthropic', 'claude'],
  ['claude-code', 'claude'],
  ['gemini', 'google'],
  ['kilocode', 'kilo'],
  ['kilo-code', 'kilo'],
]);

const normalize = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

export const resolveQuotaProviderId = (modelProviderId: string | null | undefined): string | null => {
  const normalized = normalize(modelProviderId);
  if (!normalized) return null;
  return QUOTA_PROVIDER_ALIASES.get(normalized) ?? normalized;
};


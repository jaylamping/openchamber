import { describe, expect, test } from 'bun:test';
import { resolveQuotaProviderId } from './quotaProvider';

describe('resolveQuotaProviderId', () => {
  test('passes through ids that already match a quota provider', () => {
    expect(resolveQuotaProviderId('opencode-go')).toBe('opencode-go');
  });

  test('maps the known divergences', () => {
    expect(resolveQuotaProviderId('openai')).toBe('codex');
    expect(resolveQuotaProviderId('anthropic')).toBe('claude');
    expect(resolveQuotaProviderId('kilocode')).toBe('kilo');
    expect(resolveQuotaProviderId('kilo-code')).toBe('kilo');
  });

  test('maps the opencode-claude integration provider onto Claude quota', () => {
    expect(resolveQuotaProviderId('claude-code')).toBe('claude');
  });

  test('is case and whitespace tolerant, and rejects empties', () => {
    expect(resolveQuotaProviderId('  OpenAI ')).toBe('codex');
    expect(resolveQuotaProviderId('')).toBeNull();
    expect(resolveQuotaProviderId(null)).toBeNull();
  });
});


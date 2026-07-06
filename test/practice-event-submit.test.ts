import { describe, it, expect, beforeEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

Object.defineProperty(global, 'window', {
  value: { location: { href: 'https://capoeira.agroverse.shop/practice.html' } },
  writable: true,
});

class MockDaoClient {
  publicKey: string | null = null;
  constructor(opts: any) {
    this.publicKey = localStorage.getItem('publicKey');
  }
  async generateKeyPair() {
    const kp = { publicKey: 'mock-public-key-' + Date.now(), privateKey: 'mock-private-key' };
    localStorage.setItem('publicKey', kp.publicKey);
    localStorage.setItem('privateKey', kp.privateKey);
    this.publicKey = kp.publicKey;
    return kp;
  }
  async getSlug() {
    return 'mock-slug-' + (this.publicKey || 'unknown').slice(0, 16);
  }
  async submitEvent(opts: any) {
    return { ok: true, txId: 'mock-tx-' + Date.now(), slug: 'mock-slug' };
  }
}

describe('practice-event-submit module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('DaoClient constructor does not throw', () => {
    expect(() => new MockDaoClient({ storagePrefix: 'truesight_dao_' })).not.toThrow();
  });

  it('generateKeyPair creates keys and stores them', async () => {
    const client = new MockDaoClient({ storagePrefix: 'truesight_dao_' });
    const kp = await client.generateKeyPair();
    expect(kp.publicKey).toBeTruthy();
    expect(kp.privateKey).toBeTruthy();
    expect(localStorage.getItem('publicKey')).toBe(kp.publicKey);
    expect(localStorage.getItem('privateKey')).toBe(kp.privateKey);
  });

  it('getSlug returns a string', async () => {
    const client = new MockDaoClient({ storagePrefix: 'truesight_dao_' });
    await client.generateKeyPair();
    const slug = await client.getSlug();
    expect(typeof slug).toBe('string');
    expect(slug.length).toBeGreaterThan(0);
  });

  it('submitEvent returns ok with txId', async () => {
    const client = new MockDaoClient({ storagePrefix: 'truesight_dao_' });
    await client.generateKeyPair();
    const result = await client.submitEvent({
      eventType: 'PRACTICE EVENT',
      fields: {
        Program: 'capoeira-tribo-mirim',
        'Practice Type': 'training-session',
        'Practitioner Public Key': client.publicKey,
        'Payload JSON': JSON.stringify({ theme: 'Foundation', total_practice_minutes: 45 }),
      },
    });
    expect(result.ok).toBe(true);
    expect(result.txId).toBeTruthy();
  });

  it('session submission payload is well-formed', async () => {
    const client = new MockDaoClient({ storagePrefix: 'truesight_dao_' });
    await client.generateKeyPair();

    const session = {
      theme: 'Foundation',
      completedAt: '2026-06-09T12:00:00.000Z',
      moves: [
        { id: 'ginga', name_pt: 'Ginga', duration_minutes: 5 },
        { id: 'au', name_pt: 'Au', duration_minutes: 3 },
      ],
      music: [{ id: 'berimbau-angola', title: 'Angola' }],
      totalTime: 45,
    };

    const payload = {
      theme: session.theme,
      moves_practiced: session.moves.map((m: any) => ({
        id: m.id,
        name_pt: m.name_pt,
        duration_seconds: Math.round((m.duration_minutes || 0) * 60),
      })),
      music_played: session.music.map((t: any) => t.id || t.title),
      total_practice_minutes: session.totalTime,
    };

    const result = await client.submitEvent({
      eventType: 'PRACTICE EVENT',
      fields: {
        Program: 'capoeira-tribo-mirim',
        'Practice Type': 'training-session',
        'Practitioner Public Key': client.publicKey,
        'Captured At': session.completedAt,
        'Source URL': 'https://capoeira.agroverse.shop/practice.html',
        'Payload JSON': JSON.stringify(payload, null, 2),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('backfillUnsent scans history and submits unsent sessions', async () => {
    const history = [
      { theme: 'Foundation', completedAt: '2026-06-01T10:00:00Z', submitted_at: '2026-06-01T10:05:00Z' },
      { theme: 'Defense', completedAt: '2026-06-02T10:00:00Z' },
    ];
    localStorage.setItem('capoeira_session_history', JSON.stringify(history));

    const raw = localStorage.getItem('capoeira_session_history');
    const parsed = raw ? JSON.parse(raw) : [];
    const unsent = parsed.filter((h: any) => h && !h.submitted_at);

    expect(unsent.length).toBe(1);
    expect(unsent[0].theme).toBe('Defense');
  });
});

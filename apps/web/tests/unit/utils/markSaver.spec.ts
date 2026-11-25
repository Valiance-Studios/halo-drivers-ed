import type {SkillResult} from '@hde/shared';
import type {MarkState} from '@/utils/markSaver';

import {describe, expect, it, vi} from 'vite-plus/test';
import {MarkSaver} from '@/utils/markSaver';

function setup() {
  const sent: [string, SkillResult | null][] = [];
  const pending: {resolve: () => void; reject: (error: Error) => void}[] = [];
  const states: Record<string, MarkState | null> = {};
  const save = vi.fn(
    (skillId: string, result: SkillResult | null) =>
      new Promise<void>((resolve, reject) => {
        sent.push([skillId, result]);
        pending.push({resolve, reject});
      }),
  );
  const saver = new MarkSaver<SkillResult | null>(save, (skillId, state) => {
    states[skillId] = state;
  });

  return {saver, sent, pending, states};
}

describe('MarkSaver', () => {
  it("sends one skill's marks in order, skipping ones already replaced", async () => {
    const {saver, sent, pending, states} = setup();
    saver.mark('brake', 'pass');
    saver.mark('brake', 'fail');
    saver.mark('brake', null);
    expect(sent).toEqual([['brake', 'pass']]);
    expect(states.brake).toBe('saving');

    pending[0]!.resolve();
    await vi.waitFor(() =>
      expect(sent).toEqual([
        ['brake', 'pass'],
        ['brake', null],
      ]),
    );
    pending[1]!.resolve();
    await saver.settled();
    expect(states.brake).toBeNull();
  });

  it('saves different skills at the same time', () => {
    const {saver, sent} = setup();
    saver.mark('brake', 'pass');
    saver.mark('engine', 'fail');

    expect(sent).toHaveLength(2);
  });

  it('reports a failure, and clears it when a retry succeeds', async () => {
    const {saver, pending, states} = setup();
    saver.mark('brake', 'pass');
    pending[0]!.reject(new Error('Offline'));
    await saver.settled();
    expect(states.brake).toBe('failed');

    saver.mark('brake', 'pass');
    pending[1]!.resolve();
    await saver.settled();
    expect(states.brake).toBeNull();
  });
});

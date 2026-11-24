import type {SkillResult} from '@hde/shared';

export type MarkState = 'saving' | 'failed';

/**
 * Saves each skill's mark as it is made. A skill's marks go one at a time, and only its latest one is sent next,
 * so quick taps cannot arrive out of order. Different skills save at the same time.
 */
export class MarkSaver {
  private readonly save: (skillId: string, result: SkillResult | null) => Promise<unknown>;
  private readonly onState: (skillId: string, state: MarkState | null) => void;
  private readonly waiting = new Map<string, SkillResult | null>();
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    save: (skillId: string, result: SkillResult | null) => Promise<unknown>,
    onState: (skillId: string, state: MarkState | null) => void,
  ) {
    this.save = save;
    this.onState = onState;
  }

  mark(skillId: string, result: SkillResult | null): void {
    this.waiting.set(skillId, result);

    if (!this.running.has(skillId)) {
      const run = this.run(skillId).finally(() => this.running.delete(skillId));
      this.running.set(skillId, run);
    }
  }

  /** Resolves once nothing is being saved. */
  async settled(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all(this.running.values());
    }
  }

  private async run(skillId: string): Promise<void> {
    this.onState(skillId, 'saving');
    let failed = false;

    while (this.waiting.has(skillId)) {
      const result = this.waiting.get(skillId) ?? null;
      this.waiting.delete(skillId);

      try {
        await this.save(skillId, result);
        failed = false;
      } catch {
        failed = true;
      }
    }

    this.onState(skillId, failed ? 'failed' : null);
  }
}

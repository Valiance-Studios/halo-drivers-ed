export type MarkState = 'saving' | 'failed';

/**
 * Saves each item's value as it changes: a skill's mark, or the notes. An item's values go one at a time, and only
 * its latest one is sent next, so quick changes cannot arrive out of order. Different items save at the same time.
 */
export class MarkSaver<Value> {
  private readonly save: (id: string, value: Value) => Promise<unknown>;
  private readonly onState: (id: string, state: MarkState | null) => void;
  private readonly waiting = new Map<string, Value>();
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    save: (id: string, value: Value) => Promise<unknown>,
    onState: (id: string, state: MarkState | null) => void,
  ) {
    this.save = save;
    this.onState = onState;
  }

  mark(id: string, value: Value): void {
    this.waiting.set(id, value);

    if (!this.running.has(id)) {
      const run = this.run(id).finally(() => this.running.delete(id));
      this.running.set(id, run);
    }
  }

  /** Resolves once nothing is being saved. */
  async settled(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all(this.running.values());
    }
  }

  private async run(id: string): Promise<void> {
    this.onState(id, 'saving');
    let failed = false;

    while (this.waiting.has(id)) {
      const value = this.waiting.get(id) as Value;
      this.waiting.delete(id);

      try {
        await this.save(id, value);
        failed = false;
      } catch {
        failed = true;
      }
    }

    this.onState(id, failed ? 'failed' : null);
  }
}

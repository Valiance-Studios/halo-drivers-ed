import type {SkillResult} from '@hde/shared';

/** A skill's result, as it is shown to people. */
export function resultName(result: SkillResult | undefined): string {
  if (!result) {
    return 'Not marked';
  }

  return result === 'pass' ? 'Passed' : 'Needs practice';
}

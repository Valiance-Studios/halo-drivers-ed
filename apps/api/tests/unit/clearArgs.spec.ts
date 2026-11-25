import {describe, expect, it} from 'vite-plus/test';
import {parseClearArgs} from '#src/db/clearData.ts';

describe('parseClearArgs', () => {
  it.each([
    [['all'], {kind: 'all'}],
    [['student', 'Pat@Example.com'], {kind: 'student', email: 'pat@example.com'}],
    [['instructor', 'arbiter'], {kind: 'instructor', slug: 'arbiter'}],
  ])('only previews %j', (args, target) => {
    expect(parseClearArgs(args)).toEqual({target, deployed: false, confirm: null});
  });

  it('takes which database to use, and to confirm', () => {
    expect(parseClearArgs(['all', '--deployed', '--confirm', 'deployed'])).toEqual({
      target: {kind: 'all'},
      deployed: true,
      confirm: 'deployed',
    });
  });

  // "all" with a name could be a mistyped "student", so it must not clear everything.
  it.each([
    [[]],
    [['everything']],
    [['student']],
    [['instructor']],
    [['all', 'pat@example.com']],
    [['student', 'a@example.com', 'b@example.com']],
    [['all', '--confirm']],
    [['all', '--force']],
    [['all', '--deployed=yes']],
  ])('refuses %j', (args) => {
    expect(parseClearArgs(args)).toBeNull();
  });
});

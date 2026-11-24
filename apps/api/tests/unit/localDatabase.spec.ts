import {describe, expect, it} from 'vite-plus/test';
import {assertLocalDatabase} from '#src/db/localDatabase.ts';

describe('assertLocalDatabase', () => {
  it('allows databases on this machine', () => {
    expect(() => assertLocalDatabase('postgres://hde:hde@localhost:5433/db')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://hde:hde@127.0.0.1:5433/db')).not.toThrow();
  });

  it('refuses any other host, such as Neon', () => {
    expect(() => assertLocalDatabase('postgres://u:p@ep-x-pooler.us-east-2.aws.neon.tech/db?sslmode=require')).toThrow('Refusing');
  });
});

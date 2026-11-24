import {describe, expect, it} from 'vite-plus/test';
import {VEHICLES} from '#src/db/catalogData.ts';
import {CURRICULUM} from '#src/db/curriculumData.ts';

describe('curriculum', () => {
  it.each(VEHICLES)('has a numbered lesson for each one the $slug course requires', ({slug, lessonsRequired}) => {
    const numbers = CURRICULUM.filter(({vehicleSlug}) => vehicleSlug === slug).map(({number}) => number);

    expect(numbers).toEqual(Array.from({length: lessonsRequired}, (_, index) => index + 1));
  });

  it('has skills in every lesson, and no two lessons of a course with one title', () => {
    const titles = CURRICULUM.map(({vehicleSlug, title}) => `${vehicleSlug}: ${title}`);

    expect(CURRICULUM.filter(({skills}) => skills.length === 0)).toEqual([]);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

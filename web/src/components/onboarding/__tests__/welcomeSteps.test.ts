import { describe, it, expect } from 'vitest';
import { welcomeSteps } from '../welcomeSteps';
import type { WelcomeStep } from '../welcomeSteps';

describe('welcomeSteps', () => {
  it('ステップが1つ以上定義されている', () => {
    expect(welcomeSteps.length).toBeGreaterThan(0);
  });

  it('各ステップが必須フィールドを持つ', () => {
    welcomeSteps.forEach((step: WelcomeStep) => {
      expect(step.icon).toBeDefined();
      expect(typeof step.iconBg).toBe('string');
      expect(typeof step.iconColor).toBe('string');
      expect(typeof step.title).toBe('string');
      expect(typeof step.description).toBe('string');
      expect(Array.isArray(step.details)).toBe(true);
    });
  });

  it('各ステップのtitleが空でない', () => {
    welcomeSteps.forEach((step) => {
      expect(step.title.length).toBeGreaterThan(0);
    });
  });

  it('各ステップのdescriptionが空でない', () => {
    welcomeSteps.forEach((step) => {
      expect(step.description.length).toBeGreaterThan(0);
    });
  });

  it('各ステップのdetailsが1つ以上ある', () => {
    welcomeSteps.forEach((step) => {
      expect(step.details.length).toBeGreaterThan(0);
    });
  });

  it('各ステップのiconがReactコンポーネントとして利用可能である', () => {
    welcomeSteps.forEach((step) => {
      expect(step.icon).toBeDefined();
      // LucideIcon is a ForwardRef object or function depending on the build
      expect(['function', 'object']).toContain(typeof step.icon);
    });
  });

  it('ステップのtitleが重複していない', () => {
    const titles = welcomeSteps.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('8つのステップが定義されている', () => {
    expect(welcomeSteps).toHaveLength(8);
  });
});

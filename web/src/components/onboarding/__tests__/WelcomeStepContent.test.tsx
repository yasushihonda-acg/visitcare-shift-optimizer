import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeStepContent } from '../WelcomeStepContent';
import type { WelcomeStep } from '../welcomeSteps';

const MockIcon = ({ className }: { className?: string }) => (
  <svg data-testid="mock-icon" className={className} />
);

const createStep = (overrides?: Partial<WelcomeStep>): WelcomeStep => ({
  icon: MockIcon as unknown as WelcomeStep['icon'],
  iconBg: 'bg-primary/10',
  iconColor: 'text-primary',
  title: 'テストステップ',
  description: 'テストの説明文です。',
  details: ['詳細1', '詳細2', '詳細3'],
  ...overrides,
});

describe('WelcomeStepContent', () => {
  it('タイトルが表示される', () => {
    render(<WelcomeStepContent step={createStep()} />);
    expect(screen.getByText('テストステップ')).toBeInTheDocument();
  });

  it('説明文が表示される', () => {
    render(<WelcomeStepContent step={createStep()} />);
    expect(screen.getByText('テストの説明文です。')).toBeInTheDocument();
  });

  it('詳細リストが全て表示される', () => {
    render(<WelcomeStepContent step={createStep()} />);
    expect(screen.getByText('詳細1')).toBeInTheDocument();
    expect(screen.getByText('詳細2')).toBeInTheDocument();
    expect(screen.getByText('詳細3')).toBeInTheDocument();
  });

  it('アイコンが表示される', () => {
    render(<WelcomeStepContent step={createStep()} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('アイコンにiconColorクラスが適用される', () => {
    render(<WelcomeStepContent step={createStep({ iconColor: 'text-sky-500' })} />);
    const icon = screen.getByTestId('mock-icon');
    expect(icon.getAttribute('class')).toContain('text-sky-500');
  });

  it('details が1件のみの場合でも正しく表示される', () => {
    render(<WelcomeStepContent step={createStep({ details: ['唯一の詳細'] })} />);
    expect(screen.getByText('唯一の詳細')).toBeInTheDocument();
  });
});

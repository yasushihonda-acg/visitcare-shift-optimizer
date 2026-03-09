import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttTimeHeader } from '../GanttTimeHeader';
import { GanttScaleProvider } from '../GanttScaleContext';
import { GANTT_START_HOUR, GANTT_END_HOUR } from '../constants';

function renderWithProvider(slotWidth = 4) {
  return render(
    <GanttScaleProvider value={slotWidth}>
      <GanttTimeHeader />
    </GanttScaleProvider>,
  );
}

describe('GanttTimeHeader', () => {
  it('「ヘルパー」ラベルが表示される', () => {
    renderWithProvider();

    expect(screen.getByText('ヘルパー')).toBeInTheDocument();
  });

  it('時刻ラベルがGANTT_START_HOURからGANTT_END_HOUR-1まで表示される', () => {
    renderWithProvider();

    for (let h = GANTT_START_HOUR; h < GANTT_END_HOUR; h++) {
      expect(screen.getByText(`${h}:00`)).toBeInTheDocument();
    }
  });

  it('GANTT_END_HOUR自体のラベルは表示されない', () => {
    renderWithProvider();

    expect(screen.queryByText(`${GANTT_END_HOUR}:00`)).not.toBeInTheDocument();
  });

  it('時刻ラベルの数がGANTT_END_HOUR - GANTT_START_HOURと一致する', () => {
    renderWithProvider();

    const expectedCount = GANTT_END_HOUR - GANTT_START_HOUR;
    const hourLabels = [];
    for (let h = GANTT_START_HOUR; h < GANTT_END_HOUR; h++) {
      hourLabels.push(screen.getByText(`${h}:00`));
    }
    expect(hourLabels).toHaveLength(expectedCount);
  });
});

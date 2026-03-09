import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttScaleProvider, useSlotWidth } from '../GanttScaleContext';
import { SLOT_WIDTH_PX } from '../constants';

function SlotWidthDisplay() {
  const slotWidth = useSlotWidth();
  return <span data-testid="slot-width">{slotWidth}</span>;
}

describe('GanttScaleContext', () => {
  it('Providerなしではデフォルト値（SLOT_WIDTH_PX）を返す', () => {
    render(<SlotWidthDisplay />);

    expect(screen.getByTestId('slot-width').textContent).toBe(String(SLOT_WIDTH_PX));
  });

  it('Providerで指定した値を返す', () => {
    render(
      <GanttScaleProvider value={10}>
        <SlotWidthDisplay />
      </GanttScaleProvider>,
    );

    expect(screen.getByTestId('slot-width').textContent).toBe('10');
  });

  it('ネストしたProviderでは内側の値が優先される', () => {
    render(
      <GanttScaleProvider value={10}>
        <GanttScaleProvider value={20}>
          <SlotWidthDisplay />
        </GanttScaleProvider>
      </GanttScaleProvider>,
    );

    expect(screen.getByTestId('slot-width').textContent).toBe('20');
  });
});

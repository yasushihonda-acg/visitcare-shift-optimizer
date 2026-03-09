import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnavailableBlocksOverlay } from '../UnavailableBlocksOverlay';
import type { UnavailableBlock } from '../constants';

describe('UnavailableBlocksOverlay', () => {
  it('ブロックが空配列の場合は何もレンダリングしない', () => {
    const { container } = render(<UnavailableBlocksOverlay blocks={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('off_hoursブロックがtitleとスタイルつきでレンダリングされる', () => {
    const blocks: UnavailableBlock[] = [
      { left: 10, width: 50, label: '勤務時間外', type: 'off_hours' },
    ];

    render(<UnavailableBlocksOverlay blocks={blocks} />);

    const el = screen.getByTitle('勤務時間外');
    expect(el).toBeInTheDocument();
    expect(el.style.left).toBe('10px');
    expect(el.style.width).toBe('50px');
  });

  it('day_offブロックがレンダリングされる', () => {
    const blocks: UnavailableBlock[] = [
      { left: 0, width: 200, label: '非勤務日', type: 'day_off' },
    ];

    render(<UnavailableBlocksOverlay blocks={blocks} />);

    const el = screen.getByTitle('非勤務日');
    expect(el).toBeInTheDocument();
    expect(el.style.left).toBe('0px');
    expect(el.style.width).toBe('200px');
  });

  it('unavailableブロックがレンダリングされる', () => {
    const blocks: UnavailableBlock[] = [
      { left: 30, width: 100, label: '希望休', type: 'unavailable' },
    ];

    render(<UnavailableBlocksOverlay blocks={blocks} />);

    const el = screen.getByTitle('希望休');
    expect(el).toBeInTheDocument();
  });

  it('複数ブロックが同時にレンダリングされる', () => {
    const blocks: UnavailableBlock[] = [
      { left: 0, width: 50, label: '勤務時間外', type: 'off_hours' },
      { left: 100, width: 80, label: '希望休', type: 'unavailable' },
      { left: 200, width: 60, label: '勤務時間外', type: 'off_hours' },
    ];

    render(<UnavailableBlocksOverlay blocks={blocks} />);

    const offHoursEls = screen.getAllByTitle('勤務時間外');
    expect(offHoursEls).toHaveLength(2);
    expect(screen.getByTitle('希望休')).toBeInTheDocument();
  });
});

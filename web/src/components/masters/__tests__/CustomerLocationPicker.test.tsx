import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerLocationPicker } from '../CustomerLocationPicker';

// ── モック ──────────────────────────────────────────────────────

const mockPanTo = vi.fn();
const mockUseMap = vi.fn(() => ({ panTo: mockPanTo }));

vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="google-map" data-center={JSON.stringify(props.defaultCenter)}>
      {children}
    </div>
  ),
  AdvancedMarker: ({ position, draggable }: { position: { lat: number; lng: number }; draggable?: boolean }) => (
    <div
      data-testid="google-marker"
      data-lat={position.lat}
      data-lng={position.lng}
      data-draggable={draggable}
    />
  ),
  useMap: () => mockUseMap(),
}));

// ── テスト ──────────────────────────────────────────────────────

describe('CustomerLocationPicker', () => {
  it('マップコンポーネントが表示される', () => {
    render(
      <CustomerLocationPicker lat={31.5916} lng={130.5571} onLocationChange={vi.fn()} />
    );
    expect(screen.getByTestId('google-map')).toBeInTheDocument();
  });

  it('マーカーが表示される', () => {
    render(
      <CustomerLocationPicker lat={31.5916} lng={130.5571} onLocationChange={vi.fn()} />
    );
    expect(screen.getByTestId('google-marker')).toBeInTheDocument();
  });

  it('有効な座標が渡されたときその座標がマーカーに反映される', () => {
    render(
      <CustomerLocationPicker lat={35.0} lng={139.0} onLocationChange={vi.fn()} />
    );
    const marker = screen.getByTestId('google-marker');
    expect(marker.getAttribute('data-lat')).toBe('35');
    expect(marker.getAttribute('data-lng')).toBe('139');
  });

  it('座標が0のときデフォルト位置が使用される', () => {
    render(
      <CustomerLocationPicker lat={0} lng={0} onLocationChange={vi.fn()} />
    );
    const map = screen.getByTestId('google-map');
    const center = JSON.parse(map.getAttribute('data-center')!);
    expect(center.lat).toBe(31.5916);
    expect(center.lng).toBe(130.5571);
  });

  it('マーカーがドラッグ可能に設定されている', () => {
    render(
      <CustomerLocationPicker lat={31.5916} lng={130.5571} onLocationChange={vi.fn()} />
    );
    const marker = screen.getByTestId('google-marker');
    expect(marker.getAttribute('data-draggable')).toBe('true');
  });
});

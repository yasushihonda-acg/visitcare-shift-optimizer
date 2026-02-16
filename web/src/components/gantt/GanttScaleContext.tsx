'use client';

import { createContext, useContext } from 'react';
import { SLOT_WIDTH_PX } from './constants';

const GanttScaleContext = createContext<number>(SLOT_WIDTH_PX);

export const GanttScaleProvider = GanttScaleContext.Provider;

export function useSlotWidth(): number {
  return useContext(GanttScaleContext);
}

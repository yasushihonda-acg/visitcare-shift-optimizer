import type { TrainingStatus } from '@/types';

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  not_visited: '未訪問',
  training: '同行研修中',
  independent: '自立',
};

export const TRAINING_STATUS_VARIANT: Record<TrainingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  not_visited: 'outline',
  training: 'destructive',
  independent: 'secondary',
};

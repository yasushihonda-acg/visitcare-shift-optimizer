'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { welcomeSteps } from './welcomeSteps';
import { WelcomeStepContent } from './WelcomeStepContent';

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeDialog({ open, onClose }: WelcomeDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = welcomeSteps.length;
  const isLastStep = currentStep === totalSteps - 1;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
      setCurrentStep(0);
    }
  };

  const goNext = () => {
    if (isLastStep) {
      onClose();
      setCurrentStep(0);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-center font-serif">
            VisitCare シフト最適化の使い方
          </DialogTitle>
          <DialogDescription className="text-center">
            ステップ {currentStep + 1} / {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <WelcomeStepContent step={welcomeSteps[currentStep]} />

        {/* ドットインジケーター */}
        <div className="flex items-center justify-center gap-1.5">
          {welcomeSteps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStep(idx)}
              aria-label={`ステップ ${idx + 1}`}
              className={`rounded-full transition-all ${
                idx === currentStep
                  ? 'h-2 w-6 bg-primary'
                  : 'h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {currentStep > 0 ? (
            <Button variant="ghost" size="sm" onClick={goPrev}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              前へ
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleOpenChange.bind(null, false)}>
              スキップ
            </Button>
          )}
          <Button
            size="sm"
            onClick={goNext}
            className={
              isLastStep
                ? 'bg-gradient-to-r from-[oklch(0.50_0.13_200)] to-[oklch(0.56_0.14_188)] text-white hover:opacity-90'
                : ''
            }
          >
            {isLastStep ? (
              '始める'
            ) : (
              <>
                次へ
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

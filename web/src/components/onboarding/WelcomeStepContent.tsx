import type { WelcomeStep } from './welcomeSteps';

interface WelcomeStepContentProps {
  step: WelcomeStep;
}

export function WelcomeStepContent({ step }: WelcomeStepContentProps) {
  const Icon = step.icon;

  return (
    <div className="flex flex-col items-center text-center min-h-[240px]">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${step.iconBg}`}>
        <Icon className={`h-8 w-8 ${step.iconColor}`} />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        {step.details.map((detail) => (
          <li key={detail} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
            <span className="text-left">{detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

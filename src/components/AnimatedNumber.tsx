import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  duration = 240,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const reqIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect user's motion preference
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(value);
      return;
    }

    const startVal = displayValue;
    const endVal = value;
    if (startVal === endVal) return;

    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Fast easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = startVal + (endVal - startVal) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        reqIdRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    reqIdRef.current = requestAnimationFrame(step);
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [value, duration]);

  const formatted = format ? format(Math.round(displayValue)) : Math.round(displayValue);

  return <span className={className}>{formatted}</span>;
};

export const AnimatedCurrency: React.FC<{
  value: number;
  className?: string;
  duration?: number;
}> = ({ value, className = '', duration = 240 }) => {
  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      className={className}
      format={(n) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
    />
  );
};

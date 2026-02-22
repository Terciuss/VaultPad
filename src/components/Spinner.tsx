// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

const sizes = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-10 h-10 border-3",
} as const;

interface SpinnerProps {
  size?: keyof typeof sizes;
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} rounded-full border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 animate-spin ${className}`}
    />
  );
}

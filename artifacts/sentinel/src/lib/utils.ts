import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined) return "—";
  return score.toString();
}

export function getSeverityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical': return 'text-destructive bg-destructive/10 border-destructive/20';
    case 'high': return 'text-orange-600 bg-orange-500/10 border-orange-500/20';
    case 'medium': return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
    case 'low': return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
    case 'informational': return 'text-slate-600 bg-slate-500/10 border-slate-500/20';
    default: return 'text-slate-600 bg-slate-500/10 border-slate-500/20';
  }
}

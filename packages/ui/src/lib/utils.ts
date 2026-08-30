import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
export const EASE = 'cubic-bezier(.32,.72,0,1)';
export const BARH = 52;

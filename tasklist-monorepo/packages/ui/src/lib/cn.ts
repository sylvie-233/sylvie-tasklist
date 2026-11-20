import { clsx, type ClassValue } from 'clsx';

/** 合并 className（clsx 薄封装，便于以后接入 tailwind-merge）。 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// clsx handles conditional classes; twMerge resolves conflicting utilities.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

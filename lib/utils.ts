import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toProperName(input: string) {
  const normalized = (input ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) return "";

  const capWord = (w: string) => {
    const lower = w.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  // Handle "denmar-martinez" and "o'brien"
  const capComplex = (w: string) =>
    w
      .split("-")
      .map((part) => part.split("'").map(capWord).join("'"))
      .join("-");

  return normalized
    .split(" ")
    .filter(Boolean)
    .map(capComplex)
    .join(" ");
}

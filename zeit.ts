import { ZEITZONE } from "./config.ts";

export function jetztText(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: ZEITZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d) + " Uhr";
}

import pino, { type DestinationStream, type Logger } from "pino";

export type { Logger };

export function createLogger(level: string, stream?: DestinationStream): Logger {
  return pino({ level }, stream);
}

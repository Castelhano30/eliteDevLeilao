/** Único arquivo de `apps/api/src` autorizado a usar `Date`/`Date.now()` (T6). */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Relógio controlável para testes e seed. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date | string = "2026-01-01T00:00:00.000Z") {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date | string): void {
    this.current = new Date(date);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

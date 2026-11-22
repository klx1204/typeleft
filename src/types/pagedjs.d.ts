declare module 'pagedjs' {
  export class Previewer {
    preview(
      content: string | Node,
      stylesheets?: Array<string | Node>,
      renderTo?: Element,
      options?: Record<string, unknown>,
    ): Promise<{ total: number; pages: unknown[] }>;
  }
  export class Polisher {
    add(...args: unknown[]): unknown;
  }
}

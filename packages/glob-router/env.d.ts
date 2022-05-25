interface ImportMeta {
  readonly hot?: ViteHotContext;
}

interface ViteHotContext {
  readonly data: any;

  accept(): void;
  accept(cb: (mod: any) => void): void;
  accept(dep: string, cb: (mod: any) => void): void;
  accept(deps: readonly string[], cb: (mods: any[]) => void): void;

  dispose(cb: (data: any) => void): void;
  decline(): void;
  invalidate(): void;

  // `InferCustomEventPayload` provides types for built-in Vite events
  on<T extends string>(
    event: T,
    cb: (payload: InferCustomEventPayload<T>) => void
  ): void;
  send<T extends string>(event: T, data?: InferCustomEventPayload<T>): void;
}

interface InferCustomEventPayload<T> {}

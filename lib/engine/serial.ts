let chain: Promise<unknown> = Promise.resolve();

/** Runs storage read-modify-write tasks one at a time, since ticks from several tabs arrive together. */
export function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(() => task());
  chain = run.catch(() => {});
  return run;
}

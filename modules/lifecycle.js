// One owner for each view/render. Aborting an owner invalidates every continuation.
export function createRenderScope() {
  let controller = new AbortController();
  return {
    next() { controller.abort(); controller = new AbortController(); return controller.signal; },
    cancel() { controller.abort(); },
    get signal() { return controller.signal; }
  };
}

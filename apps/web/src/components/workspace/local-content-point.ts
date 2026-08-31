/** Map a viewport click to coordinates inside a pan-transformed workspace layer. */
export function localContentPointFromClient(
  clientX: number,
  clientY: number,
  panEl: HTMLElement,
): { x: number; y: number } {
  const rect = panEl.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

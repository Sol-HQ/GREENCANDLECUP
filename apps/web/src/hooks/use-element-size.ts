"use client";

import { useEffect, useState, type RefObject } from "react";

export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  minHeight = 280,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setSize({
        width: el.clientWidth,
        height: Math.max(el.clientHeight, minHeight),
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, minHeight]);

  return size;
}

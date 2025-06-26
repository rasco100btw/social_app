import { useState, useEffect, useRef, useCallback } from 'react';

interface VirtualListOptions<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  containerHeight: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function useVirtualList<T>({
  items,
  itemHeight,
  overscan = 3,
  containerHeight,
  onEndReached,
  endReachedThreshold = 0.8
}: VirtualListOptions<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const ticking = useRef(false);

  const totalHeight = items.length * itemHeight;
  const visibleItems = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const handleScroll = useCallback(() => {
    if (!containerRef.current || ticking.current) return;

    ticking.current = true;
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const currentScrollTop = containerRef.current.scrollTop;
      setScrollTop(currentScrollTop);

      // Check if we need to load more
      if (onEndReached) {
        const scrolledRatio = (currentScrollTop + containerHeight) / totalHeight;
        if (scrolledRatio > endReachedThreshold) {
          onEndReached();
        }
      }

      lastScrollTop.current = currentScrollTop;
      ticking.current = false;
    });
  }, [containerHeight, totalHeight, endReachedThreshold, onEndReached]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const visibleItemsData = items.slice(startIndex, endIndex).map((item, index) => ({
    item,
    index: startIndex + index,
    style: {
      position: 'absolute',
      top: (startIndex + index) * itemHeight,
      height: itemHeight,
      left: 0,
      right: 0,
    } as const,
  }));

  return {
    containerRef,
    containerStyle: {
      height: containerHeight,
      overflow: 'auto',
      position: 'relative' as const,
    },
    totalHeight,
    visibleItemsData,
  };
}
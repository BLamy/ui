'use client';
import { useEffect, useState } from 'react';
import { onFontsLoaded } from '@/lib/diagram-text';

/** Goes up each time fonts finish loading: put it in the deps of whatever measures text. */
export function useFontVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => onFontsLoaded(() => setVersion((v) => v + 1)), []);
  return version;
}

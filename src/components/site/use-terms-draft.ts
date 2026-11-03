'use client';

import { useState } from 'react';

const termsPaths = new Set(['/term', '/privacy/collection', '/privacy', '/term/marketing']);

export function isTermsPath(pathname: string) {
  return termsPaths.has(pathname);
}

export function useTermsDraft<T>(_key: string, initial: T) {
  return useState(initial);
}

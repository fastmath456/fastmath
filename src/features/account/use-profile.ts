'use client';

import { readResponse } from '@/lib/http';

import { useQuery } from '@tanstack/react-query';
import type { Profile } from './types';

export function useProfile(state = '') {
  return useQuery<Profile>({ queryKey: ['profile',state], queryFn: async () => {
    const response = await fetch('/api/profile');
    const data = await readResponse<Profile>(response);
    if ([data.name,data.email,data.image,data.avatar,data.birthday,data.phone].some(value => typeof value !== 'string') || typeof data.marketing !== 'boolean') throw new Error('Invalid profile response');
    return data;
  } });
}

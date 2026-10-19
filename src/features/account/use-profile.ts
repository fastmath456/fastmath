'use client';

import { dataPath, readResponse } from '@/lib/http';

import { useQuery } from '@tanstack/react-query';
import { useMockReady } from '@/app/providers';
import type { Profile } from './types';

export function useProfile(state = '') {
  const ready = useMockReady();
  return useQuery<Profile>({ queryKey: ['profile',state], enabled: ready, queryFn: async () => {
    const response = await fetch(dataPath(`/__mock/profile?state=${encodeURIComponent(state)}`,'/api/profile'));
    const data = await readResponse<Profile>(response);
    if ([data.name,data.email,data.image,data.avatar,data.birthday,data.phone].some(value => typeof value !== 'string') || typeof data.marketing !== 'boolean') throw new Error('Invalid profile response');
    return data;
  } });
}

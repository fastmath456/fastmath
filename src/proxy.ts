import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/server';

const guard = api(async ctx => {
  if (await ctx.optionalUser()) return NextResponse.redirect(new URL('/', ctx.request.url));
  return NextResponse.next();
});

export function proxy(request: NextRequest) {
  return guard(request, { params: Promise.resolve({}) });
}

export const config = { matcher: ['/login', '/signup', '/reset-password'] };

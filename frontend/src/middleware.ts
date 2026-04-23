export { auth as default } from '@/auth';

export const config = {
  matcher: ['/dashboard/:path*', '/games/:path*', '/wallet/:path*', '/admin/:path*'],
};

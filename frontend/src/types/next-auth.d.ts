import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    applicationToken: string;
    user: {
      id: string;
      role: string;
      username: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    username?: string;
    applicationToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: string;
    applicationToken: string;
    username: string;
  }
}

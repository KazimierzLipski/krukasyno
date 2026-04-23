import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL ?? 'http://api-gateway:4000';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_GATEWAY_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.username,
            role: data.user.role,
            applicationToken: data.token,
          };
        } catch {
          return null;
        }
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          const res = await fetch(`${API_GATEWAY_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleId: account.providerAccountId,
              email: user.email,
              name: user.name,
            }),
          });

          if (!res.ok) return false;

          const data = await res.json();
          // Mutate user object so the jwt callback picks it up
          user.id = data.user.id;
          (user as Record<string, unknown>).role = data.user.role;
          (user as Record<string, unknown>).applicationToken = data.token;
          (user as Record<string, unknown>).username = data.user.username;
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as Record<string, unknown>).role as string;
        token.applicationToken = (user as Record<string, unknown>).applicationToken as string;
        token.username = (user as Record<string, unknown>).username as string ?? user.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      (session as Record<string, unknown> & typeof session).applicationToken = token.applicationToken as string;
      (session.user as Record<string, unknown> & typeof session.user).role = token.role as string;
      (session.user as Record<string, unknown> & typeof session.user).username = token.username as string;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
});

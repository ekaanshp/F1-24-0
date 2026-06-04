// =============================================================================
// NextAuth Configuration — F1 TeamBuilder
// =============================================================================
// Uses Auth.js v5 (next-auth@beta) with JWT session strategy.
// Providers: Google OAuth + Discord OAuth (configure in .env.local)
//
// TODO(security): Implement CSRF protection for auth endpoints
// TODO(security): Configure rate limiting on auth endpoints
// TODO(security): Set up MFA for strengthened authentication
// =============================================================================

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth',
    // TODO: Add custom error and signOut pages
  },

  callbacks: {
    // TODO: Extend session/jwt callbacks to include user ID, roles, etc.
    // async session({ session, token }) {
    //   return session;
    // },
    // async jwt({ token, user }) {
    //   return token;
    // },
  },
});

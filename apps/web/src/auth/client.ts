/**
 * Client-Safe Auth Entry Point
 *
 * Browser-safe auth functions for client components.
 * This file has NO server-only code or Node.js dependencies.
 */

"use client";

// Re-export only client-safe functions from next-auth/react
export { signIn, signOut, useSession, SessionProvider } from "next-auth/react";

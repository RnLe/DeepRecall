# Drizzle Migrations - Web Server CAS

**Layer 1**: Local Content-Addressed Storage (CAS) for the Web platform.

Server-side SQLite migrations for tracking blob files and filesystem paths in `data/library/`. Used by Next.js API routes for file management. Each platform (Desktop, Mobile) will have its own blob tracking system.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The typed API client runs server-side (React Server Components), so the
  // browser never calls the backend API directly. This is deliberate: the LLM
  // API key must never reach the browser (design.md §15.1, UX.md §31).
  env: {},

  // The product-facing route is /components. `/modules` was the pre-adaptation
  // path and is kept as a permanent redirect so existing links, bookmarks and
  // anything already published against the old path keep working.
  //
  // This affects the browser route only. The backend API path is still
  // `GET /modules`, unchanged — see lib/api/endpoints.ts.
  async redirects() {
    return [
      { source: "/modules", destination: "/components", permanent: true },
      { source: "/modules/:path*", destination: "/components/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

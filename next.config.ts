import type { NextConfig } from 'next';

/**
 * Intentionally empty.
 *
 * The one thing worth configuring here would be `outputFileTracingIncludes`,
 * to force the workbook in `data/` into the serverless bundle — a file read at
 * runtime is easy for the tracer to miss, and the app would then work locally
 * and fail once deployed. Checking the build's `.nft.json` traces shows the
 * workbook is already included for `/`, `/api/plan` and `/api/assistant`, so
 * adding the option would be noise.
 */
const nextConfig: NextConfig = {};

export default nextConfig;

// The commit this build came from, so automation can tell when a deploy is live.
export const GET = () => new Response(process.env.VERCEL_GIT_COMMIT_SHA ?? 'local');

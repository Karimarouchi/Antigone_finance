// TODO[port]: copy the design from app/(protected)/projects/page.tsx in the source project.
// Use the codemod at tools/migrate-supabase-to-api.mjs to convert REST calls.
export default function Page() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-medium">Projets</h1>
      <p className="opacity-60 text-sm mt-2">A porter depuis le projet source.</p>
    </div>
  );
}

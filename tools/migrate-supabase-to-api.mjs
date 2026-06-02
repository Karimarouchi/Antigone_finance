#!/usr/bin/env node
/**
 * tools/migrate-supabase-to-api.mjs
 *
 * Best-effort codemod that rewrites the most common Next.js + Supabase
 * idioms found in the source project so the ported files can compile in
 * the Vite + REST setup.
 *
 * Usage:
 *   node tools/migrate-supabase-to-api.mjs           # rewrite src/
 *   node tools/migrate-supabase-to-api.mjs path/...  # rewrite a specific file/dir
 *
 * What it does (line-based, deliberately conservative):
 *
 *  1. Drops Next.js client directives (`'use client'`).
 *  2. Replaces `next/link` ↔ `react-router-dom` Link and `href` → `to`.
 *  3. Replaces `next/navigation` `useRouter().push(x)` → `useNavigate()(x)`.
 *  4. Replaces `next/image` with a plain `<img>` placeholder (manual review).
 *  5. Removes `import { getSupabaseBrowser } from '@/lib/supabase-browser'`
 *     and inserts `import { api } from '@/lib/api'` instead.
 *  6. Annotates each `supabase.from('...').select|insert|update|delete()` chain
 *     with a `// TODO[migrate]:` comment listing the REST endpoint to target,
 *     based on the table → URL map below.
 *  7. Replaces `supabase.storage.from('bucket').upload(...)` and `.getPublicUrl()`
 *     with a `// TODO[migrate]: POST /api/storage/upload/<bucket>` note.
 *  8. Replaces `supabase.channel(...).on('postgres_changes', ...)`
 *     with a `// TODO[migrate]: STOMP subscribe('/topic/...')` note.
 *
 * The codemod NEVER tries to fully translate query chains — it just makes
 * them visible. You finish each TODO[migrate] by hand.
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? path.resolve('src');
const TABLE_TO_ROUTE = {
  clients: '/api/clients',
  contacts: '/api/contacts',
  payments: '/api/payments',
  payment_partials: '/api/payments/:id/partials',
  service_library: '/api/service-library',
  templates: '/api/templates',
  client_reminders: '/api/client-reminders',
  counters: '/api/counters/:type',
  employees: '/api/employees',
  employee_contract_history: '/api/employees/:id/contracts',
  salaire_mensuel: '/api/payroll/salaires',
  salary_partials: '/api/payroll/salaires/:id/partials',
  charge_fixe_def: '/api/charges/fixes',
  charge_fixe_paiement: '/api/charges/fixes/:id/paiements',
  charge_variable: '/api/charges/variables',
  dettes: '/api/dettes',
  dette_paiements: '/api/dettes/:id/paiements',
  autres_revenus: '/api/autres-revenus',
  cnss_trimestre: '/api/cnss/trimestres',
  cnss_paiement_historique: '/api/cnss/historique',
  notifications: '/api/notifications',
  messages: '/api/messages',
  user_notes: '/api/notes',
  calendar_entries: '/api/calendar',
  profiles: '/api/admin/users',
  user_features: '/api/admin/users/:id/features',
  invite_codes: '/api/admin/invites',
  facture_history: '/api/history/factures',
  devis_history: '/api/history/devis',
};

const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);

function* walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const c of fs.readdirSync(p)) yield* walk(path.join(p, c));
  } else if (exts.has(path.extname(p))) {
    yield p;
  }
}

function rewrite(src, filePath) {
  let s = src;
  let changed = false;

  // 1. Drop `'use client'` (harmless in Vite but noisy).
  const before1 = s;
  s = s.replace(/^['"]use client['"];?\s*\n/m, '');
  if (s !== before1) changed = true;

  // 2. next/link
  if (/from\s+['"]next\/link['"]/.test(s)) {
    s = s.replace(/import\s+Link\s+from\s+['"]next\/link['"];?/g,
      "import { Link } from 'react-router-dom';");
    s = s.replace(/<Link\s+href=/g, '<Link to=');
    changed = true;
  }

  // 3. next/navigation
  if (/from\s+['"]next\/navigation['"]/.test(s)) {
    s = s.replace(/import\s+\{([^}]+)\}\s+from\s+['"]next\/navigation['"];?/g,
      (_, names) => {
        const has = (n) => names.split(',').map((x) => x.trim()).includes(n);
        const out = [];
        if (has('useRouter') || has('usePathname'))
          out.push("import { useNavigate, useLocation } from 'react-router-dom';");
        return out.join('\n');
      });
    s = s.replace(/const\s+router\s*=\s*useRouter\(\);?/g,
      'const navigate = useNavigate();');
    s = s.replace(/router\.push\(([^)]+)\)/g, 'navigate($1)');
    s = s.replace(/router\.replace\(([^)]+)\)/g, 'navigate($1, { replace: true })');
    s = s.replace(/const\s+pathname\s*=\s*usePathname\(\);?/g,
      'const pathname = useLocation().pathname;');
    changed = true;
  }

  // 4. next/image
  if (/from\s+['"]next\/image['"]/.test(s)) {
    s = s.replace(/import\s+Image\s+from\s+['"]next\/image['"];?/g,
      "// TODO[migrate]: <Image /> replaced with plain <img />");
    s = s.replace(/<Image\b/g, '<img');
    s = s.replace(/<\/Image>/g, '</img>');
    changed = true;
  }

  // 5. Supabase client import → axios api
  if (/getSupabaseBrowser|getSupabaseServer|createBrowserClient|createServerClient/.test(s)
      || /from\s+['"]@\/lib\/supabase(?:-browser|-server|-admin)?['"]/.test(s)) {
    s = s.replace(/import\s+[^;]+\s+from\s+['"]@\/lib\/supabase(?:-browser|-server|-admin)?['"];?/g, '');
    if (!s.includes("from '@/lib/api'") && !s.includes('from "@/lib/api"')) {
      s = `import { api } from '@/lib/api';\n` + s;
    }
    changed = true;
  }

  // 6. Annotate supabase.from(...) chains
  s = s.replace(/supabase\.from\(['"]([^'"]+)['"]\)([^;]*);/g, (full, table, rest) => {
    const route = TABLE_TO_ROUTE[table] ?? `/api/${table}`;
    return `// TODO[migrate]: ${route} — was: supabase.from('${table}')${rest.trim()}\n${full}`;
  });

  // 7. Annotate supabase.storage.*
  s = s.replace(/supabase\.storage\.from\(['"]([^'"]+)['"]\)([^;]*);/g, (full, bucket, rest) => {
    return `// TODO[migrate]: POST /api/storage/upload/${bucket} — was: supabase.storage.from('${bucket}')${rest.trim()}\n${full}`;
  });

  // 8. Annotate realtime channels
  s = s.replace(/supabase\.channel\(([^)]+)\)([^;]*);/g, (full, name, rest) => {
    return `// TODO[migrate]: subscribe('/topic/...') via @/lib/ws — was: supabase.channel(${name})${rest.trim()}\n${full}`;
  });

  if (s !== src) changed = true;
  return { changed, content: s };
}

let total = 0, modified = 0;
for (const f of walk(SRC)) {
  total++;
  const src = fs.readFileSync(f, 'utf8');
  const { changed, content } = rewrite(src, f);
  if (changed) {
    fs.writeFileSync(f, content);
    modified++;
    console.log(`✔ rewrote ${path.relative(process.cwd(), f)}`);
  }
}
console.log(`\nDone: ${modified}/${total} files modified.`);

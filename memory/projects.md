# Projects

## AI See You CRM

**Context:** Commercial navigation priority defect. CRM contains all 4,996 certified hotels, including the original 228 Sydney hotels.

**Current:** CRM PR 29 is merged and deployed. Country, Destination, and Hotel group navigation passes independent code and service checks. Browser interaction verification remains pending.

**Pending:**

- Daily incremental and weekly full reconciliation schedules are enabled through the completed-import certification gate.
- Complete commercial workflow acceptance with the live hotel universe.
- Complete signed-in browser checks for the new navigation controls. The in-app browser backend is unavailable during this session.
- Keep large-scale contact enrichment paused until navigation interaction verification passes.
- Read PR 30's release receipt for the bounded noindex/nofollow deployment verification. Do not repeat deployment without checking current evidence.
- Retire the expired temporary operator role through Supabase-managed administration. Reviewed SQL cleanup lacks required privileges.
- Preserve the certified 4,996-hotel manifest, 76 destinations, and four countries.
- Production retains four pre-existing baseline CI failure categories. The PR 65 exception does not waive new regressions.
- Preserve founder-only access, Production authority, no private-mail processing, and no outbound email.

**Evidence:** memory/sessions/2026-09-07-commercial-navigation.md and docs/commercial-navigation-acceptance-2026-09-07.md. Prior import evidence remains in memory/sessions/2026-09-06-production-hotel-import.md.

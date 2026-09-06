# Projects

## AI See You CRM

**Context:** Phase 5 Production hotel import. CRM contains all 4996 certified hotels, including the original 228 Sydney hotels.

**Current:** Production PR 65 and CRM PRs 26 and 27 are deployed. Full import and post-rotation idempotent rerun pass.

**Pending:**

- Daily incremental and weekly full reconciliation schedules are enabled through the completed-import certification gate.
- Complete commercial workflow acceptance with the live hotel universe.
- Retire the expired temporary operator role through Supabase-managed administration. Reviewed SQL cleanup lacks required privileges.
- Preserve the certified 4,996-hotel manifest, 76 destinations, and four countries.
- Production retains four pre-existing baseline CI failure categories. The PR 65 exception does not waive new regressions.
- Preserve founder-only access, Production authority, no private-mail processing, and no outbound email.

**Evidence:** memory/sessions/2026-09-06-production-hotel-import.md.

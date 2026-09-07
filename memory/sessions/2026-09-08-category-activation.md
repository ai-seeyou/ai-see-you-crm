# Category activation, 8 September 2026

Project: AI See You CRM. Memory backend: local markdown.

## Approval and decisions

- Founder explicitly approves Production PR80 and only the reviewed Category function's ten-second timeout.
- Preserve all authentication, scoped read protections, Production authority and credentials boundaries.
- Use complete deployed synchronisation, not local or warm-query results, for certification.
- After certification, reconcile and activate, prove idempotency and verify Businesses, Contacts and Coverage in the browser.
- Contact enrichment remains paused until the full live release gate passes.
- Create non-blocking performance follow-up after activation. Optimisation does not delay a reliable certified immediate release.

## Actions and evidence

- Independently reverify PR80 head c61b38b2872d0bd6a3f846edfe1e1737245629df and prior zero-new-signature CI comparison.
- Parent reruns the exact isolated local migration and rollback tests successfully.
- Merge PR80 at402126e6ac71e51b4f1cf253785f86429b06bd2a.
- Execute exact migration40c69c4e265a4b484beeb3a8e32bd8d92a2ff2065ebea225fd9ab899af1829d9 once.
- Independent preflight/postflight confirms source27c4d3a5, OID186018, owner, ACL, STABLE status, definer, current verifier and existing settings unchanged.
- Only Category gains statement_timeout=10s. Anon remains3s, authenticated/authenticator remain8s. Hotel function sources and settings remain unchanged.
- No Edge redeployment occurs. Version8 custom-token gateway configuration remains intact.
- Queue fresh dry taskcrm-category-dry-2f44792544ae4abfbbb9e2033878e7dc, requestce26afec-822a-48d0-a4f2-9002d5619297.
- Queue SHA d6ee01eae6f0bef2a26fd8f43d5eb51ab08c63d5c236e45eda18523ae2f73146.
- Dry run completes20:15:47.046UTC on7 September, first attempt,29GETrequests, noHTTP500, activatedfalse.
- Exact snapshot54795ad01a12590eb549b840b015372fc7cc9bff1af154610dcfb1b3d27d055e and all four canonical digests match independent evidence.
- Certified totals: nine Categories,77 destinations,4,272 properties,13,184 memberships,4,272 linked and zero unresolved.
- Independent reference gate confirms5,010 unique hotels and exact hotelIDdigest37928f110ade40f5dd3c3e0ed7682687c1ed7b0859052a66aa4bf3eb2c26cdeb.
- Execute reviewed activation queue99a3d4d07557c834d325c115134012b58be07706269b103b71fa2e74c55c8cfe.
- First commit taskcrm-category-commit-b65c854b61d440378a1b32e5609cd040 completes20:18:47.841UTC, first attempt,29GETrequests.
- CRM Category state becomes revision1 and exact certified snapshot at20:18:47.703UTC.
- Active membership digest recomputes tob86871baa52e29ce747bd2aead1ad03f1961bd008ade478fd702df7b6b0a7a43.
- All5,010 profiles and references remain intact. Registry has nine values and zero retired values. No identity conflicts appear.
- Real-data checks: Gold Coast Luxury18, Sydney Boutique42, Australia Accessible434, Accor Luxury34, Sydney Accor Luxury4.
- Current qualifying hotel assignments return zero contacts. These SQL results do not establish positive live Contact behaviour.
- All three live CRM domains remain READY at8c529b8551cb8b417ddad6f609f28cab745d10ad.
- Browser discovery remains empty. Parent requests the founder's signed-in CRM tab asynchronously without bypassing authentication.
- GitHub Issues is disabled in CRM. Durable non-blocking taskCAT-PERF-001 is recorded in docs/core-category-delivery-2026-09-07.md.

## Pending

- Complete live browser Businesses, Contacts and Coverage acceptance. Do not claim SQL checks substitute for browser certification.
- Preserve separate Production migration-ledger and expired-role cleanup items from the earlier project record.
- Do not repeat approved migrations to create ledger entries.

## Idempotency completion

- Corrected queue SHA d0637387fd8dca986621374f45c526eaade868a90e79ad73e09e2b1b3ade8ffd passes independent review.
- Strengthened acceptance SHA d853f1120a2a9aa5df376af5d3ace46dc50de38133cb280cec0e382a77c68000 catches missing links and fingerprints row versions.
- Execute one idempotency taskcrm-category-idempotency-458bac2033d24432b7e608e4087ce525 through the existing COMMIT worker.
- It completes20:25:13.750UTC on its first attempt with one GET request. All evidence digests/counts remain exact.
- Parent compares the complete before/after acceptance objects. They match byte-for-byte after JSON parsing.
- Membership row fingerprint c569b6255ae3d9da397b255743f3512743c94bf75c2430329265ea233c1e2e07 remains unchanged.
- Registry row fingerprint489e66708ef210d66019553445a2f4c4f75c29c4157d946677a8e353051761dd remains unchanged.
- Snapshot row fingerprint f020276d28bb239b532b90ec071b19bf12a1e12b493cbb8288c8bdd0eaa91c95 remains unchanged.
- State row fingerprint95d10b142e55cb81754f13d1376a7e7dbb84510024047ec29d2fe82feefc4df4 remains unchanged.
- Registry, memberships, snapshot and active pointer receive no unnecessary rewrites. Revision and updatedAt remain unchanged.
- The rerun writes only its normal task execution metadata. No duplicate Category records appear.
- Independent reviewer certifies DATA RELEASE and IDEMPOTENCY PASS against the same final evidence.
- Browser and positive live Contacts checks remain explicitly uncertified. No release of the contact-enrichment pause occurs.

## Rules and limitations

- Ten seconds applies only to the reviewed function. This approval does not permit general timeout increases.
- The failed earlier tasks remain historical. No old task is reset or used as activation evidence.
- Independent comparison catches a repeatable idempotency-queue guard and missing-link checks before execution; builder corrections remain in review.
- Counts and logical digests alone do not prove absence of rewrites. Capture row-version fingerprints for the rerun.
- Second pass complete. No additional founder decision or credential access occurs.

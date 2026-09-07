# Category registry retirement execution

Date: 7 September 2026

Status: Complete and independently verified.

## Authority and source

The founder authorised the retirement of RE-0009 Extended Stay and RE-0011 Group.

Production PR 66 supplied the reviewed correction.

- PR: `ai-seeyou/tri#66`
- PR head: `418ce1350c985e38dc731aad607c20a74158edb1`
- Merge commit: `e9f427172170956093c971a18868edecafd55584`
- Reviewed migration SHA-256: `dc86b55e0dbdbf5303372c5097bc7b11634d1353108256f7ee2f71efea364e50`

## Execution

The operator applied the exact reviewed SQL to Production project `tnskqujimizlsmsmonor`.

The apply completed at `2026-09-07T04:03:11.165162Z`.

The command completed in 0.924 seconds with exit code zero.

The Management API request boundary was `32405c619e1e1a5db2d9052bdb55ca70`.

The repair changed only `recommendation_environments.lifecycle_status` for RE-0009 and RE-0011.

The existing update trigger changed both `updated_at` values.

Every other governed value remained unchanged.

The other nine core environments remained active.

## Out-of-band repair rationale

PR 66 used migration version `20260907140000`.

Production already records that version as `fix_rate_limit_increment_variable_conflict`.

Normal migration application would create a false or conflicting ledger entry.

The operator therefore applied the exact reviewed SQL as an authorised two-row metadata repair.

The operator did not add, edit or remove any migration history row.

The existing ledger entry remained unchanged after the repair.

This operation differs from the Category membership audit.

The membership audit used SELECT-only queries and changed no Production state.

## Certified table fingerprints

Every after-state count and SHA-256 matched its before-state value.

| Table | Rows | Before and after SHA-256 |
| --- | ---: | --- |
| `ceil_classification_assignments` | 1,784 | `3666f65c964bf8bccf503a78c12f2344c8609676da898c9792fa171e45629072` |
| `chains` | 232 | `ebdc7e1439d40192e20160343b02663f69c3ac36af57fafe1754ecc4f8b30b13` |
| `entities` | 10,985 | `7efd5feafea9971df51ab3c78ed7f1102a32e10fa40fc6e383503e29bfb97cbb` |
| `entity_aliases` | 25,915 | `1d4577a3fe57ce35c3dad1db2c3ab74f1f4c6b3e6847d4db9382cce61ee33cd4` |
| `entity_scores` | 108,008 | `05e11686d9f7c92f2a27cd86e663c29da75d6b20c501a9af139ff01b8a588275` |
| `generations` | 3 | `08b427bb96f8743de42a7706d02defe65eb51b3f1eb46483a1b9dc2c0971aa9c` |
| `parsed_mentions` | 512,501 | `4e8716069acb6b080a3ce0772a6a48b315ec54369813ac9e26d855ef81d7d5f3` |
| `query_jobs` | 81,281 | `17b429cb0d0047fd360eb0d08516eb7bdc9a55bf850e24335ebcea48b9863214` |
| `recommendation_observations` | 336,199 | `1037d6e4cc07b6be0048a1737fb9aa21b918ede282e5373922181eb1a6b65bea` |
| `registry_snapshots` | 76 | `0c7aa3102ce722e16003f99173c158196e6ad6f9da8f5a337cfc74ce1e063023` |
| `run_configs` | 181 | `358587835e945cc7beb4b97ca544d5c3cf2fc8ff76618bfbf47f6ea49334d907` |
| `runs` | 190 | `3b9ba54f860fa4e19288094ecbac2137b4634aabea5bc29d48b7e616cd592c8e` |
| `sub_category_scores` | 8,473 | `7a54bcab2746dfceb3b5e5d1e8d612e829d90eeeec83d2fdbc2a7fc726c67830` |

## Historical integrity

The ten target template mappings retained SHA-256 `01546563920a981bbcc428dc094dd18cb97b05a9acd0f81d9b6fa9c4a4552b64`.

The ten target templates retained SHA-256 `2e702a5d658ceb71f3b33267b641c0a76804e2be29a528ed2710f0a190cec997`.

The 94 derived prompts retained SHA-256 `7d66a0dc8511a85cd06cc6f7025fb8bb3b164798bf2b36002eb2a4badbb1f3cc`.

The 637 target observations retained SHA-256 `c3f4a5b3b8bbd3a19e8effe2f0720572cf8f0d8bc4b87cabe49397d9d4e853bb`.

The 1,252 target scores retained SHA-256 `9a917488baeb6861e92d8b5fbff4d782756bae6f3d605342c050d7b4ba7ebcd5`.

## CRM read boundary

The CRM view definition retained SHA-256 `18f27f06ef66e7e1cabb049948661fc855e111ef685192bb49d900a9a47b297a`.

The CRM RPC definition retained SHA-256 `adcbb74e4004b434f88a7bfd261866af1cf302f411d29d539b5e16bbc7f39727`.

The RPC grant set retained SHA-256 `8f0b1ad87217a4f6bde482574facba428f252f592dd90e9174f64546fcdb1d02`.

The view grant set retained SHA-256 `aeafde5e418b3585f48165b50d537ecbbb1ef618a80a4a0be1528e3194213c82`.

The CRM read token still reaches only the approved GET-only RPC contract.

## Evidence files

- Before-state JSON SHA-256: `7f6ce0b8d9055fb15641144b0d6a1584357b6b4de1f104e6cc00cab9b7466650`
- After-state JSON SHA-256: `5a22dd113111f893639fbba4d34605ffe0d9773b40a2f9a33830ceb50bc89275`

The temporary evidence files remain under `/private/tmp` for programme closeout.

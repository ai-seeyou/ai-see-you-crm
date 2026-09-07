# Category local full-universe acceptance, 7 September 2026

## Scope

This check uses the isolated local `crm_navigation_scale_test` database.
It does not recalculate Production data.
It does not certify the live UI or Production SQL.
It makes no Production request or write.

Migration 67, `20260907160000_governed_core_categories`, applied successfully before this check.

## Certified input

The source artifact is `/private/tmp/recommendation-environment-prompt-reconciliation.json`.
It contains 13,184 certified membership pairs across 4,272 Production properties.
Its membership SHA-256 is `17f4e08afbc1364011d0a4280d6bf6d3253df131b50451b699d6faa80c761729`.

The temporary registry contains these nine governed active categories:

| ID | Name |
| --- | --- |
| RE-0001 | Luxury |
| RE-0002 | Family |
| RE-0003 | Business |
| RE-0004 | Budget |
| RE-0005 | Boutique |
| RE-0006 | Romantic |
| RE-0007 | Wellness |
| RE-0008 | Airport and Transit |
| RE-0010 | Accessible |

Exact Production references linked 4,261 properties and 13,153 pairs.
Eleven properties and 31 pairs remained unresolved.
Independent live proof identifies all eleven unresolved properties as Yorkshire Dales properties.

## Method

The check staged every pair in a marked temporary normalized snapshot.
It resolved companies through matching profiles and confirmed, current Production external references.
It activated that snapshot only inside the isolated local database.

Each expected set used an independent intersection.
The first set used certified Luxury property IDs.
The second set used the existing geographic and hotel group filters without Category criteria.
The API Category filter returned the same company IDs for every case.

Contacts returned zero because this local full-universe copy contains no contacts.
Coverage totals matched the expected Business totals for every case.

## Results

| Combined criteria | Businesses | Contacts | Coverage | Business query | Contact query | Coverage query |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Luxury | 1,127 | 0 | 1,127 | 9.1 ms | 26.2 ms | 35.1 ms |
| Luxury and Australia | 210 | 0 | 210 | 7.4 ms | 9.4 ms | 18.7 ms |
| Luxury and United Kingdom | 829 | 0 | 829 | 7.1 ms | 7.1 ms | 20.1 ms |
| Luxury and Sydney | 20 | 0 | 20 | 12.2 ms | 17.8 ms | 23.8 ms |
| Luxury and Gold Coast | 18 | 0 | 18 | 11.0 ms | 14.9 ms | 20.2 ms |
| Luxury and Accor | 34 | 0 | 34 | 13.8 ms | 18.9 ms | 26.8 ms |
| Luxury, Sydney, Australia and Accor | 4 | 0 | 4 | 18.6 ms | 25.5 ms | 28.6 ms |

The navigation query returned all nine Category facets in 61.0 ms.
These durations are single local measurements, not latency guarantees.

## Cleanup

The check restored the prior active pointer and revision.
The active pointer is null and its revision is zero.
The temporary snapshot count is zero.
No acceptance fixture remains in the local database.

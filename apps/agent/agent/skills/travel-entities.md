---
description: Use when researching or writing about a hotel, a group, a brand, a management company, an owner, a ship or a destination organisation, and whenever a business carries a `structure` block.
---

# Travel businesses, and what you may say about them

A hotel is not one business. "Sofitel Sydney Darling Harbour" is a property.
Somebody owns the freehold. Somebody else operates it under a management
agreement. The name over the door belongs to a brand. The brand belongs to a
group. A destination organisation covers the city it stands in. Those are five
businesses, five separate commercial relationships with us, and five separate
rows in this CRM.

Treating the property as a standalone company is the mistake this whole section
exists to stop. It produces a brief about a hotel that never mentions the group
that decides its distribution, and it puts the wrong person on the record.

## What the CRM records, and where you see it

Every business carries `entityType` and a vertical.

| Entity type | What it is |
| --- | --- |
| `HOTEL` | One property, one address |
| `HOTEL_GROUP` | The parent that owns the brands |
| `HOTEL_BRAND` | The name over the door |
| `MANAGEMENT_COMPANY` | Runs properties under a management agreement |
| `OWNERSHIP_GROUP` | Holds the asset, usually invisible to a guest |
| `DESTINATION_ORGANISATION` | A tourism board or a convention bureau |
| `CRUISE_LINE`, `CRUISE_SHIP` | A ship is a sellable unit, like a property |
| `TOUR_OPERATOR` | Sells itineraries |
| `OTHER` | Nothing recorded. Read it as unknown, never as independent |

`read_company_history` returns a `structure` block on every business, and the
company preamble prints the same thing. It gives you:

- what the business **is part of**: its group, its brand, its manager, its owner,
  the destination organisation whose territory it sits in
- what **sits under it**: the properties under a group, the properties a
  management company runs, capped, with the true total beside it
- who is **responsible for it**: people who cover this business and are paid by
  another business in the group

`read_crm_history` returns the same block for the contact's employer, plus
`coverage`, which is every business that person covers.

**Only current records appear.** A relationship or an assignment that has ended
is left out. If it is not in the block, do not describe it as current, and never
write that a hotel is managed by a company the CRM stopped recording last year.

## The person to write to is often not employed there

A Group Director of Distribution sits at the management company and covers a
hundred and eighty properties. They are the right person to write to about any
one of them. They appear in the property's `structure.responsible` with their
employer named, and the property appears in their `coverage`.

Two rules follow.

1. **Do not move them.** They work where their record says they work. A person
   responsible for a property is not employed by it.
2. **File what you learn against the right record.** Something you learn about
   one covered property is recorded against that property, not against the
   person and not against their employer.

## You may not create structure

You have no tool that creates a relationship between two businesses, and no tool
that makes somebody responsible for one. That is deliberate. Who owns, brands,
manages or covers a hotel is a commercial fact, and a wrong one is worse than a
missing one: it sends an email to the wrong company and it corrupts the coverage
a founder reads.

So when you work out that a property belongs to a group:

- **Write it in the brief and name the source.** That is what a brief is for.
- **Record what you can as a fact**, with its evidence kind, the way
  `skills/evidence.md` describes. A person decides whether it becomes structure.
- **Say what you could not check.** "The CRM does not record which group this
  property belongs to, and I could not confirm one" is a useful sentence. "This
  is an independent hotel" is a claim, and you do not have the evidence for it.

`record_job_change` refuses a move between two businesses that are already
related in the CRM, because "moved to Accor" for a Sofitel general manager is
almost always you mistaking the group for the employer.

## Blank is not empty

`entityType` of `OTHER`, no vertical and no relationships means **nobody has
filled it in yet**. It does not mean the business stands alone. Say we do not
know. Filling the gap with a guess is the one outcome worse than the gap.

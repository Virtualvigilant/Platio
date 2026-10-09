# Restaurant storefronts

Each restaurant's public page is generated from its configuration record by one tested template. A restaurant chooses its colour, logo, cover image, description, hours and menu. It never chooses the layout, fonts or status colours, and it cannot supply CSS or HTML.

## What a restaurant can change

| Setting         | Token or slot            | Constraint                                                                                            |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Primary colour  | `tenant`                 | Must reach 4.5:1 against its text colour. The admin wizard checks it and blocks publishing otherwise. |
| Text on primary | `on-tenant`              | `#ffffff` or `ink`, whichever passes. Set with `tenant`, never alone.                                 |
| Logo            | RestaurantCard logo tile | Square crop at 56px. Falls back to initials on `tenant`.                                              |
| Cover image     | Restaurant header        | Optional. Text never sits on the photo.                                                               |
| Layout variant  | Template                 | One of a small fixed set.                                                                             |

## Where the tenant colour appears

Only on the restaurant's own identity: the logo tile and its profile header band. Wrap a storefront in an element that sets `--tenant` and `--on-tenant`; everything outside keeps DineFlow teal.

The tenant colour never replaces `brand` on buttons, never colours a status pill and never appears in the restaurant workspace or admin console, so "Ready for collection" looks the same at every restaurant.

## Defaults

A missing colour falls back to `brand`, a missing logo to initials, a missing description to the cuisine labels. Draft and suspended restaurants never render publicly. Preview mode shows them only to admins.

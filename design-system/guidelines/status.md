# Order and payment status

An order has two separate states: the **order status** (where the food is) and the **payment status** (where the money is). Show both whenever money is involved. A cancelled order with a pending refund shows both facts, never one misleading status.

## Order status

| Server state           | Customer sees                    | Staff sees           | Pill            | Glyph          | Next states                                                   |
| ---------------------- | -------------------------------- | -------------------- | --------------- | -------------- | ------------------------------------------------------------- |
| `pending_payment`      | Confirming payment               | Awaiting payment     | amber outline   | clock          | awaiting_restaurant, expired, failed, cancelled               |
| `awaiting_restaurant`  | Awaiting restaurant confirmation | New order            | amber soft      | clock          | accepted, rejected, cancelled                                 |
| `accepted`             | Accepted                         | Accepted             | brand outline   | progress       | preparing, ready_for_collection, cancelled (audited)          |
| `preparing`            | Preparing                        | Preparing            | brand soft      | progress       | ready_for_collection                                          |
| `ready_for_collection` | Ready for collection             | Ready for collection | brand solid     | bell           | collected, or back to preparing through an audited correction |
| `collected`            | Collected                        | Collected            | neutral soft    | check          | terminal                                                      |
| `rejected`             | Rejected                         | Rejected             | danger soft     | cross          | terminal; starts the refund path if money was taken           |
| `cancelled`            | Cancelled                        | Cancelled            | danger outline  | cross          | terminal; payment tracked separately                          |
| `expired`              | Expired                          | Expired              | neutral outline | slashed circle | terminal                                                      |
| `failed`               | Failed                           | Failed               | danger outline  | alert          | terminal                                                      |

Only `ready_for_collection` gets a solid fill: it is the one state where the customer has to act.

## Payment status

| State              | Label             | Pill            | Glyph        |
| ------------------ | ----------------- | --------------- | ------------ |
| `pending`          | Payment pending   | amber outline   | clock        |
| `confirmed`        | Payment confirmed | brand soft      | check        |
| `failed`           | Payment failed    | danger soft     | cross        |
| `pay_at_pickup`    | Pay at pickup     | neutral outline | ring         |
| `refund_initiated` | Refund initiated  | amber soft      | return arrow |
| `refund_completed` | Refund completed  | neutral soft    | check        |

## Restaurant and connection status

| Status       | Pill                            | Rule                                                |
| ------------ | ------------------------------- | --------------------------------------------------- |
| Open         | brand soft, dot                 | Ordering enabled. Add "until 21:00".                |
| Paused       | amber soft, pause               | Browsable; ordering disabled with the reason.       |
| Closed       | neutral outline, slashed circle | Browsable; "opens 07:30".                           |
| Live         | brand soft, dot                 | The queue is current.                               |
| Reconnecting | amber soft, clock               | "Last updated 12:41. The queue may be out of date." |
| Offline      | danger soft, cross              | Same message, plus "Retry now".                     |

## Telling states apart

Teal (in progress), amber (waiting) and red (stopped) also differ in form and always carry a word and a glyph, so the queue reads correctly in greyscale and for colour-blind staff. Never show a status as a coloured dot alone.

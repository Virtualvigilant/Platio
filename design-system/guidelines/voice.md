# Voice and copy

Every message names the order, says what happened and gives the next action. Notification templates are configurable and versioned; these are the defaults.

## Event messages

| Event                          | Student                                                                             | Restaurant                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Order created, payment pending | "We're confirming your payment. Don't place the order again yet."                   | No alert until the order is actionable.                                    |
| Payment confirmed, order sent  | "Payment confirmed. We've sent your order to [Restaurant]."                         | "New paid order #[number]. Review and accept or reject it."                |
| Restaurant accepts             | "[Restaurant] accepted your order. Estimated ready time: [time]."                   | Shown in the order timeline.                                               |
| ETA changed                    | "Your order's estimated ready time changed to [time]. [Reason if supplied]."        | Updated ETA with the previous value.                                       |
| Order ready                    | "Your order is ready for collection. Show code [code] at [Restaurant]."             | "Order #[number] is marked ready; verify pickup before marking collected." |
| Rejected or cancelled          | The reason if available, and the current refund or payment state.                   | The result and any financial follow-up.                                    |
| Refund                         | "Refund initiated" or "Refund completed", only when the recorded state supports it. | Refund or payment exception status.                                        |

## Words to use

| Say                                                                                  | Not                                      |
| ------------------------------------------------------------------------------------ | ---------------------------------------- |
| estimated ready time                                                                 | guaranteed ready time, AI-predicted time |
| Ready for collection                                                                 | Done, Finished                           |
| Payment pending                                                                      | Processing, Failed (on a timeout)        |
| Pause new orders / Resume orders                                                     | Close shop, Go offline                   |
| Your cart contains items from [Restaurant]. Start a new cart for [Other Restaurant]? | Error: multiple restaurants              |
| This item just became unavailable. Remove it or return to the menu.                  | Error 409                                |

## Notes and free text

Item notes are allowed, but the field says the kitchen may not be able to honour every request. Order notes are length-limited and never ask for payment details.

## Staff wording

Staff copy names the job, not the system state: "New order", "Mark ready", "Verify code & collect". Show who changed an estimate and when: "Updated 12:38 by Wanjiku".

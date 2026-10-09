import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AccentBar,
  BusinessStatus,
  Button,
  Callout,
  DataTable,
  MenuItem,
  OrderStatus,
  OrderTicket,
  OrderTimeline,
  PaymentStatus,
  PickupCode,
  PrepTimePicker,
  PriceSummary,
  QuantityStepper,
  RestaurantCard,
  Wordmark,
} from "@/components/ui";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { formatKES } from "@/domain/money";
import { ORDER_STATUSES } from "@/domain/orders/state-machine";
import { PAYMENT_STATUSES } from "@/domain/payments/state-machine";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`ds-${name}`}
      className="flex min-w-0 flex-col gap-3 border-t border-line pt-6"
    >
      <h2 id={`ds-${name}`} className="m-0 font-sans text-heading text-brand">
        {name}
      </h2>
      {children}
    </section>
  );
}

/** Every component with example data, for checking the port against the design system. */
export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-3">
        <Wordmark />
        <AccentBar />
        <p className="m-0 max-w-[65ch] font-serif text-lede text-ink-muted">
          The DineFlow design system in code. Everything below uses example data. Guidelines live in{" "}
          <code>design-system/guidelines</code>.
        </p>
      </div>

      <Specimen name="Button">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Place order · KES 650</Button>
          <Button variant="secondary">Add note</Button>
          <Button variant="quiet">View details</Button>
          <Button loading loadingLabel="Placing order…">
            Place order
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" variant="danger">
            Reject
          </Button>
          <Button size="lg">Accept</Button>
          <Button size="lg" variant="secondary">
            Pause new orders
          </Button>
          <Button disabled>Unavailable</Button>
        </div>
      </Specimen>

      <Specimen name="Status">
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((s) => (
            <OrderStatus key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatus status="awaiting_restaurant" audience="staff" />
          <OrderStatus status="pending_payment" audience="staff" />
          <OrderStatus status="ready_for_collection" size="lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_STATUSES.map((s) => (
            <PaymentStatus key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <BusinessStatus status="open" detail="until 21:00" />
          <BusinessStatus status="paused" detail="not taking new orders" />
          <BusinessStatus status="closed" detail="opens 07:30" />
        </div>
        <div className="flex flex-col gap-2">
          <ConnectionStatus state="live" lastSynced="12:41" />
          <ConnectionStatus state="reconnecting" lastSynced="12:41" />
          <ConnectionStatus state="offline" lastSynced="12:41" />
        </div>
      </Specimen>

      <Specimen name="Callout">
        <Callout title="Pickup instructions">
          Collect from the side window next to the library entrance. Have your pickup code ready.
        </Callout>
        <Callout tone="warning" title="Prices changed since you added these items">
          Mama Oliech Kitchen updated two prices. Your new total is {formatKES(72000)}. Review your
          cart before you pay.
        </Callout>
        <Callout tone="danger" title="This item just became unavailable">
          Beef samosa (×2) sold out while it was in your cart. Remove it or return to the menu.
        </Callout>
      </Specimen>

      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen name="RestaurantCard">
          <RestaurantCard
            name="Mama Oliech Kitchen"
            cuisine={["Kenyan", "Fish", "Rice"]}
            status="open"
            statusDetail="until 21:00"
            readyIn="15–20 min"
            priceCue="KES 80–350"
            tenantColor="#7a2e12"
            tenantOnColor="#ffffff"
          />
          <RestaurantCard
            name="Campus Grill"
            cuisine={["Burgers", "Chips"]}
            status="paused"
            priceCue="KES 420–450"
          />
          <RestaurantCard
            name="Bean & Leaf Café"
            cuisine={["Coffee", "Pastries"]}
            status="closed"
            statusDetail="opens 07:30"
          />
        </Specimen>

        <Specimen name="MenuItem">
          <div>
            <MenuItem
              name="Pilau with kachumbari"
              description="Spiced rice with beef, served with fresh tomato and onion salad."
              priceMinor={35000}
              prepMinutes={15}
              action={<Button variant="secondary">Add</Button>}
            />
            <MenuItem
              name="Githeri bowl"
              description="Maize and beans stewed with onion and dhania."
              priceMinor={22000}
              prepMinutes={10}
              tags={["Vegetarian"]}
              action={<Button variant="secondary">Add</Button>}
            />
            <MenuItem
              name="Beef samosa (2 pcs)"
              description="Fried to order."
              priceMinor={10000}
              available={false}
            />
          </div>
        </Specimen>

        <Specimen name="QuantityStepper and PriceSummary">
          <QuantityStepper defaultValue={2} label="Quantity of chapati" />
          <PriceSummary
            lines={[
              { label: "Subtotal (3 items)", amountMinor: 62000 },
              {
                label: "Service fee",
                amountMinor: 3000,
                hint: "Charged by DineFlow to run ordering.",
              },
            ]}
            totalMinor={65000}
            footnote="You can cancel until the restaurant accepts your order."
          />
        </Specimen>

        <Specimen name="PickupCode">
          <div className="grid gap-4 sm:grid-cols-2">
            <PickupCode code="K7A4" orderNumber={1042} restaurant="Mama Oliech Kitchen" />
            <PickupCode orderNumber={1043} restaurant="Campus Grill" />
          </div>
        </Specimen>

        <Specimen name="OrderTimeline">
          <div className="grid gap-8 sm:grid-cols-2">
            <OrderTimeline
              status="preparing"
              times={{
                received: "12:31",
                awaiting_restaurant: "12:31",
                accepted: "12:33",
                preparing: "12:35",
              }}
              eta={{
                time: "12:50",
                updatedAt: "12:38",
                reason: "The kitchen is busier than usual.",
              }}
            />
            <OrderTimeline
              status="rejected"
              times={{ received: "12:31", awaiting_restaurant: "12:31", rejected: "12:34" }}
              stopReason="Kitchen too busy. Your refund has been requested."
            />
          </div>
        </Specimen>

        <Specimen name="PrepTimePicker">
          <PrepTimePicker suggested={15} />
        </Specimen>
      </div>

      <Specimen name="OrderTicket">
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OrderTicket
            number={1042}
            isNew
            status="awaiting_restaurant"
            ageMinutes={2}
            receivedAt="12:31"
            mode="pickup"
            payment="confirmed"
            items={[
              { qty: 2, name: "Pilau with kachumbari", options: "Large · extra kachumbari" },
              { qty: 1, name: "Passion juice" },
            ]}
            note="No chilli on one of the pilau, please."
            actions={
              <>
                <Button size="lg" variant="danger">
                  Reject
                </Button>
                <Button size="lg">Accept</Button>
              </>
            }
          />
          <OrderTicket
            number={1039}
            status="preparing"
            ageMinutes={9}
            receivedAt="12:24"
            mode="dine_in"
            payment="pay_at_pickup"
            eta="12:40"
            items={[
              { qty: 1, name: "Githeri bowl" },
              { qty: 3, name: "Chapati" },
            ]}
            actions={
              <>
                <Button size="lg" variant="secondary">
                  Change time
                </Button>
                <Button size="lg">Mark ready</Button>
              </>
            }
          />
        </div>
      </Specimen>

      <Specimen name="DataTable">
        <DataTable
          caption="Today at Mama Oliech Kitchen"
          rowHeaders
          columns={[
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value", numeric: true },
            { key: "note", label: "Definition" },
          ]}
          rows={[
            {
              id: 1,
              metric: "Orders",
              value: "48",
              note: "Paid or pay-at-pickup orders received today.",
            },
            {
              id: 2,
              metric: "Gross order value",
              value: formatKES(2134000),
              note: "Before fees and refunds. Not a settlement figure.",
            },
            {
              id: 3,
              metric: "Ready by communicated ETA",
              value: "87%",
              note: "Share of orders marked ready by the last ETA shown.",
            },
          ]}
        />
      </Specimen>
    </main>
  );
}

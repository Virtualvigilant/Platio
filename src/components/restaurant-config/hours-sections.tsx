import type { Interval } from "@/domain/restaurants/hours-form";
import { ClosuresEditor, type ClosureView } from "./closures-editor";
import { HoursEditor } from "./hours-editor";
import { OperationsForm, type OperationsValues } from "./operations-form";
import { ConfigSection, type NextStep } from "./parts";

/**
 * Opening hours, temporary closures and operations: wizard step 4 and the hours part of the
 * restaurant's own settings page. Each part saves on its own.
 */
export function HoursSections({
  restaurantId,
  hours,
  closures,
  operations,
  wizard = false,
  nextStep,
}: {
  restaurantId: string;
  hours: Interval[];
  closures: ClosureView[];
  operations: OperationsValues;
  wizard?: boolean;
  nextStep?: NextStep;
}) {
  return (
    <>
      <ConfigSection
        id="opening-hours"
        title="Opening hours"
        description={
          wizard
            ? "When customers can order, in Nairobi time. Needed before publishing: hours for at least one day. Periods can’t run past midnight."
            : "When customers can order, in Nairobi time. Periods can’t run past midnight."
        }
      >
        <HoursEditor restaurantId={restaurantId} saved={hours} />
      </ConfigSection>

      <ConfigSection
        id="closures"
        title="Temporary closures"
        description="Close for a holiday or an event without changing the weekly hours."
      >
        <ClosuresEditor restaurantId={restaurantId} closures={closures} />
      </ConfigSection>

      <ConfigSection
        id="operations"
        title="Orders and preparation"
        description="How customers order and collect, and the preparation times staff start from."
      >
        <OperationsForm
          restaurantId={restaurantId}
          saved={operations}
          wizard={wizard}
          nextStep={nextStep}
        />
      </ConfigSection>
    </>
  );
}

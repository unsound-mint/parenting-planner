import { demoFamilies } from "@/lib/demo-families";
import { FamilyCard } from "./family-card";
import { OwnDetails } from "./own-details";

// Four synthetic families side by side, then the form for a judge's own details.
export function FamilyPicker() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {demoFamilies.map((f) => (
        <FamilyCard key={f.template} family={f} />
      ))}
      <OwnDetails />
    </ul>
  );
}

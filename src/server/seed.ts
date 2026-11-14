import "server-only";
import { db, schema } from "./db";

const DAY = 24 * 60 * 60 * 1000;

// Creates a fresh synthetic family for one demo visitor and returns its id.
// Keep this in sync with docs/demo-script.md: the script assumes this exact data.
export function createDemoFamily(): string {
  return db.transaction((tx) => {
    const [family] = tx
      .insert(schema.families)
      .values({ babyName: "Maya", dueDate: new Date(Date.now() + 21 * DAY), stage: "pregnancy" })
      .returning()
      .all();

    const [mom, partner] = tx
      .insert(schema.members)
      .values([
        { familyId: family.id, role: "mom", name: "Emily" },
        { familyId: family.id, role: "partner", name: "Jake" },
      ])
      .returning()
      .all();

    tx.insert(schema.tasks)
      .values([
        { familyId: family.id, title: "Pack the hospital bag", assigneeId: mom.id, activeFrom: "pregnancy" },
        { familyId: family.id, title: "Install the car seat", assigneeId: partner.id, activeFrom: "pregnancy" },
        { familyId: family.id, title: "Prepare questions for the 36-week visit", assigneeId: mom.id, activeFrom: "pregnancy" },
        // Agreed during pregnancy, shows up once the baby is home.
        {
          familyId: family.id,
          title: "Night shift",
          kind: "shift",
          status: "accepted",
          assigneeId: mom.id,
          activeFrom: "baby_home",
          startMinute: 2 * 60,
          endMinute: 7 * 60,
        },
        { familyId: family.id, title: "Groceries for the first week", assigneeId: partner.id, activeFrom: "baby_home" },
      ])
      .run();

    return family.id;
  });
}

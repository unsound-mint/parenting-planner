import { mockMiddleware, type MockTable } from "./registry";
import { appointmentQuestionMocks } from "./fixtures/appointment-questions";
import { babyMocks } from "./fixtures/baby";
import { careMocks } from "./fixtures/care";
import { directoryMocks } from "./fixtures/directory";
import { moodPatternMocks } from "./fixtures/mood-patterns";
import { passportMocks } from "./fixtures/passport";
import { peopleMocks } from "./fixtures/people";
import { pricingMocks } from "./fixtures/pricing";
import { weeklyPlanMocks } from "./fixtures/weekly-plan";
import { todayMocks } from "./fixtures/today";

// Every feature registers its preview mocks here, one import per file in
// ./fixtures. Fixture data is synthetic and matches the demo family (Emily,
// week 25, due 2027-02-27; partner Jake). See registry.ts for when it is used.
const tables: MockTable[] = [
  appointmentQuestionMocks,
  babyMocks,
  careMocks,
  directoryMocks,
  moodPatternMocks,
  passportMocks,
  peopleMocks,
  pricingMocks,
  todayMocks,
  weeklyPlanMocks,
];

export const previewMocks = mockMiddleware(Object.assign({}, ...tables));

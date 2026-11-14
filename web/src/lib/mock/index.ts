import { mockMiddleware, type MockTable } from "./registry";
import { adminMocks } from "./fixtures/admin";
import { appointmentQuestionMocks } from "./fixtures/appointment-questions";
import { babyMocks } from "./fixtures/baby";
import { birthPlanMocks } from "./fixtures/birth-prep";
import { calendarEventMocks } from "./fixtures/calendar-events";
import { calendarFeedMocks } from "./fixtures/calendar-feed";
import { careMocks } from "./fixtures/care";
import { childcareMocks } from "./fixtures/childcare";
import { demoMocks } from "./fixtures/demo";
import { directoryMocks } from "./fixtures/directory";
import { insuranceMocks } from "./fixtures/insurance";
import { leaveMocks } from "./fixtures/leave";
import { learnMocks } from "./fixtures/learn";
import { loadMapMocks } from "./fixtures/load-map";
import { milestoneMocks } from "./fixtures/milestones";
import { moodPatternMocks } from "./fixtures/mood-patterns";
import { notificationMocks } from "./fixtures/notifications";
import { postcardMocks } from "./fixtures/postcard";
import { peopleMocks } from "./fixtures/people";
import { portraitMocks } from "./fixtures/portraits";
import { pregnancyGrowthMocks } from "./fixtures/pregnancy-growth";
import { pricingMocks } from "./fixtures/pricing";
import { scheduleMocks } from "./fixtures/schedule";
import { simulatorMocks } from "./fixtures/simulator";
import { stageNowMocks } from "./fixtures/stage-now";
import { weeklyPlanMocks } from "./fixtures/weekly-plan";
import { taskMocks } from "./fixtures/tasks";
import { todayMocks } from "./fixtures/today";
import { wellbeingMocks } from "./fixtures/wellbeing";

// Every feature registers its preview mocks here, one import per file in
// ./fixtures. Fixture data is synthetic and matches the demo family (Emily,
// week 25, due 2027-02-27; partner Jake). See registry.ts for when it is used.
const tables: MockTable[] = [
  adminMocks,
  appointmentQuestionMocks,
  babyMocks,
  birthPlanMocks,
  calendarEventMocks,
  calendarFeedMocks,
  careMocks,
  childcareMocks,
  demoMocks,
  directoryMocks,
  insuranceMocks,
  leaveMocks,
  learnMocks,
  loadMapMocks,
  milestoneMocks,
  moodPatternMocks,
  notificationMocks,
  peopleMocks,
  postcardMocks,
  portraitMocks,
  pregnancyGrowthMocks,
  pricingMocks,
  taskMocks,
  todayMocks,
  wellbeingMocks,
  weeklyPlanMocks,
  scheduleMocks,
  simulatorMocks,
  stageNowMocks,
];

export const previewMocks = mockMiddleware(Object.assign({}, ...tables));

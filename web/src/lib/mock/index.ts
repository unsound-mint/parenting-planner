import { mockMiddleware, type MockTable } from "./registry";
import { pricingMocks } from "./fixtures/pricing";
import { scheduleMocks } from "./fixtures/schedule";
import { simulatorMocks } from "./fixtures/simulator";
import { todayMocks } from "./fixtures/today";

// Every feature registers its preview mocks here, one import per file in
// ./fixtures. Fixture data is synthetic and matches the demo family (Emily,
// week 25, due 2027-02-27; partner Jake). See registry.ts for when it is used.
const tables: MockTable[] = [pricingMocks, todayMocks, scheduleMocks, simulatorMocks];

export const previewMocks = mockMiddleware(Object.assign({}, ...tables));

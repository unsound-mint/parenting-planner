import { mockMiddleware, type MockTable } from "./registry";
import { pricingMocks } from "./fixtures/pricing";
import { taskMocks } from "./fixtures/tasks";

// Every feature registers its preview mocks here, one import per file in
// ./fixtures. Fixture data is synthetic and matches the demo family (Emily,
// week 25, due 2027-02-27; partner Jake). See registry.ts for when it is used.
const tables: MockTable[] = [pricingMocks, taskMocks];

export const previewMocks = mockMiddleware(Object.assign({}, ...tables));

import { createItemHandlers } from "@/lib/api/crud";
import { automationConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(automationConfig);

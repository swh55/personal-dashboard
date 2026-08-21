import { createItemHandlers } from "@/lib/api/crud";
import { happinessConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(happinessConfig);

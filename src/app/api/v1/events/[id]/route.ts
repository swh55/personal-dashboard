import { createItemHandlers } from "@/lib/api/crud";
import { eventsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(eventsConfig);

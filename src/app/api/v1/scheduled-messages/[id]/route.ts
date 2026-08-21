import { createItemHandlers } from "@/lib/api/crud";
import { scheduledMessagesConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(scheduledMessagesConfig);

import { createCollectionHandlers } from "@/lib/api/crud";
import { scheduledMessagesConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(scheduledMessagesConfig);

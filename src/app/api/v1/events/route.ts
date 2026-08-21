import { createCollectionHandlers } from "@/lib/api/crud";
import { eventsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(eventsConfig);

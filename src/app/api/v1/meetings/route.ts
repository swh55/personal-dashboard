import { createCollectionHandlers } from "@/lib/api/crud";
import { meetingsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(meetingsConfig);

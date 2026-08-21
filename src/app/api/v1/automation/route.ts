import { createCollectionHandlers } from "@/lib/api/crud";
import { automationConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(automationConfig);

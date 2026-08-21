import { createCollectionHandlers } from "@/lib/api/crud";
import { happinessConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(happinessConfig);

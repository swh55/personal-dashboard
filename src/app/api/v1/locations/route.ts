import { createCollectionHandlers } from "@/lib/api/crud";
import { locationsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(locationsConfig);

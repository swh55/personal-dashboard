import { createCollectionHandlers } from "@/lib/api/crud";
import { integrationsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(integrationsConfig);

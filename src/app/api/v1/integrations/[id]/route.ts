import { createItemHandlers } from "@/lib/api/crud";
import { integrationsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(integrationsConfig);

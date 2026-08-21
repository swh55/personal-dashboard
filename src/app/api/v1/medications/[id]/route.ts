import { createItemHandlers } from "@/lib/api/crud";
import { medicationsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(medicationsConfig);

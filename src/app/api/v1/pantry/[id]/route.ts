import { createItemHandlers } from "@/lib/api/crud";
import { pantryConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(pantryConfig);

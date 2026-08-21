import { createItemHandlers } from "@/lib/api/crud";
import { debtsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(debtsConfig);

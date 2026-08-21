import { createItemHandlers } from "@/lib/api/crud";
import { habitsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(habitsConfig);

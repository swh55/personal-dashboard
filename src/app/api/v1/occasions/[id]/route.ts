import { createItemHandlers } from "@/lib/api/crud";
import { occasionsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(occasionsConfig);

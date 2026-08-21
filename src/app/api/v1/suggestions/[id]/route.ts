import { createItemHandlers } from "@/lib/api/crud";
import { suggestionsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(suggestionsConfig);

import { createItemHandlers } from "@/lib/api/crud";
import { assetsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(assetsConfig);

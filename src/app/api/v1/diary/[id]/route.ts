import { createItemHandlers } from "@/lib/api/crud";
import { diaryConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(diaryConfig);

import { createCollectionHandlers } from "@/lib/api/crud";
import { diaryConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(diaryConfig);

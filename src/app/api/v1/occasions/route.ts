import { createCollectionHandlers } from "@/lib/api/crud";
import { occasionsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(occasionsConfig);

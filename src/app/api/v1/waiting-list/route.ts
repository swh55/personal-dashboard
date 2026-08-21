import { createCollectionHandlers } from "@/lib/api/crud";
import { waitingListConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(waitingListConfig);

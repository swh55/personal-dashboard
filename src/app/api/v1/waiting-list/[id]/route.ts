import { createItemHandlers } from "@/lib/api/crud";
import { waitingListConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(waitingListConfig);

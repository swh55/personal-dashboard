import { createItemHandlers } from "@/lib/api/crud";
import { accountsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(accountsConfig);

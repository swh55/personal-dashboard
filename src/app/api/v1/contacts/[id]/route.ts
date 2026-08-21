import { createItemHandlers } from "@/lib/api/crud";
import { contactsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(contactsConfig);

import { createCollectionHandlers } from "@/lib/api/crud";
import { contactsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(contactsConfig);

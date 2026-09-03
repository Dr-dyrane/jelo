import { requireCustomer } from "@/lib/customer/access";
import type { CustomerConcernRecord } from "@/lib/customer/concern-repository";
import { customerConcernService } from "@/lib/customer/concern-service";
import { createSyntheticCustomerPortal } from "@/lib/customer/development-fixture";
import type { CustomerPortalShelfItem } from "@/lib/customer/portal-model";
import type { CustomerShelfRecord } from "@/lib/customer/shelf-repository";
import { customerShelfService } from "@/lib/customer/shelf-service";
import { measureCustomerPrivateResponseOperation } from "@/lib/customer/private-telemetry";

export const dynamic = "force-dynamic";

const PRIVATE_DOWNLOAD_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Content-Disposition": 'attachment; filename="jelocare-data.json"',
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const customer = await requireCustomer();
  return measureCustomerPrivateResponseOperation(
    { surface: "shelf", operation: "export" },
    async () => {
      let shelfRecords: readonly (
        CustomerPortalShelfItem | CustomerShelfRecord
      )[];
      let concernRecords: readonly CustomerConcernRecord[];
      if (customer.source === "synthetic-development") {
        shelfRecords = createSyntheticCustomerPortal().shelf;
        concernRecords = [];
      } else {
        const [shelfRead, concernRead] = await Promise.all([
          customerShelfService.read(customer),
          customerConcernService.read(customer),
        ]);
        if (
          shelfRead.status === "unavailable" ||
          concernRead.status === "unavailable"
        ) {
          return Response.json(
            {
              status: "unavailable",
              message: "Your data export is unavailable right now.",
            },
            { status: 503, headers: PRIVATE_DOWNLOAD_HEADERS },
          );
        }
        shelfRecords = shelfRead.items;
        concernRecords = concernRead.concerns;
      }

      const items = shelfRecords.map((item) => ({
        identityVersionId: item.identityVersionId,
        savedAt: item.savedAt,
        saveOrigin: item.saveOrigin,
        lifecycleState: item.lifecycleState,
        reviewedSnapshot: item.snapshot,
      }));
      const concerns = concernRecords.map((concern) => ({
        slug: concern.concernSlug,
        savedAt: concern.savedAt,
        source: concern.origin,
      }));

      return new Response(
        JSON.stringify(
          {
            format: "jelocare-customer-data-export-v1",
            exportedAt: new Date().toISOString(),
            items,
            concerns,
          },
          null,
          2,
        ),
        {
          status: 200,
          headers: PRIVATE_DOWNLOAD_HEADERS,
        },
      );
    },
  );
}

'use client';

/* The Cloudflare parts, with the catalog, on an entry of their own: it's about 150 KB, and an app that doesn't draw Cloudflare's
   services shouldn't get it. */
export { CloudflareDiagram } from './components/cloudflare-diagram';
export type { CloudflareDiagramChange, CloudflareDiagramProps } from './components/cloudflare-diagram';
export { CLOUDFLARE_CATALOG } from './lib/cloudflare-catalog.generated';
export type {
  CatalogBinding, CatalogClass, CatalogContextType, CatalogField, CatalogHandlers, CatalogMethod, CatalogOtherKey, CatalogProduct, CatalogProperty, CatalogReceive, CatalogRunner, CatalogSurface, CloudflareCatalog,
} from './lib/cloudflare-catalog';
export {
  ENV_PORT, EVENTS_PORT, SERVICE_NODE, SERVICE_PRODUCTS, bindingName, catalogBinding, catalogProduct, linkBetween, linkOf, methodSignature, runsCode, serviceIconName, serviceNodeHeight, servicePorts,
} from './lib/cloudflare-services';
export type { CloudflareEdge, CloudflareService, ServiceLink, ServiceLinkCheck } from './lib/cloudflare-services';

'use client';

/* The Cloudflare parts, with the catalog, on an entry of their own, which is their one import path: it's about 150 KB, and an
   app that doesn't draw Cloudflare's services shouldn't get it. */
export {
  CloudflareDiagram, CloudflareServiceSearch, cloudflareBoardProps,
} from './components/cloudflare-diagram';
export type {
  CloudflareBoardOptions, CloudflareBoardProps, CloudflareDiagramChangeDetails, CloudflareDiagramChangeReason, CloudflareDiagramProps, CloudflareMachineChangeReason,
  CloudflareServiceSearchProps,
} from './components/cloudflare-diagram';
export { CLOUDFLARE_SYSTEM_NODE, cloudflareBoardBounds, cloudflareBoardData, cloudflareEdgeTitle, cloudflareEnvironmentNode, cloudflareNoun, placeInLayers } from './lib/cloudflare-board';
export type { CloudflareBoardData, CloudflareBoardDataOptions, CloudflareServiceEdgeData, CloudflareServiceNodeData } from './lib/cloudflare-board';
export { CLOUDFLARE_CATALOG } from './lib/cloudflare-catalog.generated';
export type {
  CatalogBinding, CatalogClass, CatalogContextType, CatalogField, CatalogHandlers, CatalogMethod, CatalogOtherKey, CatalogProduct, CatalogProperty, CatalogReceive, CatalogRunner, CatalogSurface, CloudflareCatalog,
} from './lib/cloudflare-catalog';
export {
  ENV_PORT, EVENTS_PORT, SERVICE_PRODUCTS, bindingName, catalogBinding, catalogProduct, handlerNames, linkBetween, linkOf, methodSignature, newEdge, repeatsLink, runsCode, serviceIconName, servicePorts,
} from './lib/cloudflare-services';
export type {
  CloudflareConsumerSettings, CloudflareEdge, CloudflareMigration, CloudflareService, CloudflareSettings, CloudflareTrigger, ServiceLink, ServiceLinkCheck,
} from './lib/cloudflare-services';
export {
  BINDING_NAME, EMPTY_SYSTEM, addService, checkMachines, edgeBinding, machineEvents, machineReceives, machinesPast, parseSystem, removeServices, searchCatalog,
  serviceEntries, serviceFacts, serviceHandlers, serviceName, sharedServices, systemEnvironments, systemFacts, systemToJson, validateSystem,
} from './lib/cloudflare-system';
export type { CloudflareEntry, CloudflareFact, CloudflareFactSection, CloudflareSystem, SystemIssue } from './lib/cloudflare-system';
export { WRANGLER_RESOURCE_FIELDS, compareWrangler, readWrangler, readWranglerEnvironments, writeWrangler } from './lib/cloudflare-wrangler';
export type {
  WranglerCompare, WranglerDifference, WranglerEnvironmentsRead, WranglerNeed, WranglerNote, WranglerOptions, WranglerRead, WranglerSetting, WranglerWrite,
} from './lib/cloudflare-wrangler';
export { looksLikeWorkerdConfig, parseCapnp, readWorkerdConfig } from './lib/cloudflare-workerd';
export type { CapnpConst, CapnpValue, WorkerdNote, WorkerdRead, WorkerdSocket } from './lib/cloudflare-workerd';

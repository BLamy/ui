/* The Worker the runtime lives in. The Sandbox library runs all of it (`serveSandbox`); this file is here so that the
   app's bundler builds the Worker, with the runtime in it. What the block adds is one rule: HTTP requests for tailnet
   addresses go to the page, which has the tailnet connection, and everything else goes out from the Worker itself. */
import { serveSandbox } from '@/lib/sandbox/worker';
import { isTailnetUrl } from './tailnet-fetch';

serveSandbox({ hostFetch: isTailnetUrl });

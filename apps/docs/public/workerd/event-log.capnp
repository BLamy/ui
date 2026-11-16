using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "do-storage", disk = (path = "do-storage", writable = true)),
  ],
  sockets = [ (name = "http", address = "127.0.0.1:19610", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [
    (name = "worker.js", esModule = embed "worker.js"),
    (name = "event-log.server", esModule = embed "event-log.js"),
    (name = "account.js", esModule = embed "account.js"),
  ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ACCOUNTS", durableObjectNamespace = "ProofAccount") ],
  durableObjectNamespaces = [ (className = "ProofAccount", uniqueKey = "event-log", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);

---
description: Point a block at an OpenAPI spec and an operation, and docstream renders the endpoint, its parameters, responses, schemas, a cURL sample and an example response, straight from the spec.
---

# OpenAPI operations

Don't hand-write endpoint docs that drift from the API. Name the operation and link the spec, and docstream loads the spec and renders the operation from it. The spec here is [`specs/petstore.json`](specs/petstore.json), a file in this site's docs folder right next to this page, so the link is relative, the same as on GitHub:

{% openapi-operation spec="petstore" path="/pet/{petId}" method="get" %}
[petstore](specs/petstore.json)
{% endopenapi-operation %}

```md
{% openapi-operation spec="petstore" path="/pet/{petId}" method="get" %}
[petstore](specs/petstore.json)
{% endopenapi-operation %}
```

## The block

| Part | Meaning |
| --- | --- |
| `path` | The key under `paths` in the spec, exactly as written there, braces included: `/pet/{petId}`. |
| `method` | `get`, `post`, `put`, `delete`… in any case. Defaults to `get`. |
| `spec` | A name for the spec. It is kept with the block and round-trips, but the renderer reads the URL from the body. |
| Body | One Markdown link, `[name](url)`, to the spec, JSON or YAML: a relative path to a file next to the page, or any URL. |

`{% openapi %}…{% endopenapi %}` is accepted as an alias.

## What renders

From the operation and the spec around it:

- **Title**: the operation's `summary`, or `METHOD /path`.
- **Endpoint**: a colored method badge, the first entry of `servers`, and the path.
- **Description**: rendered as docstream Markdown, so a spec's descriptions can use hints, tabs and code fences (see the YAML example below).
- **Authorizations**: the security schemes the operation (or the spec) requires, with each one's description.
- **Parameters**: name, type, location (`path`, `query`, `header`, `cookie`), required or optional, and description. `$ref` parameters are resolved.
- **Responses**: one expandable row per status code, 2xx open by default, listing the JSON schema's fields with `$ref`s resolved.
- **A cURL sample**: the server plus the path, with a bearer `Authorization` header when the operation needs auth.
- **An example response**: synthesized from the 2xx JSON schema. It uses each field's `example` when there is one, the first `enum` value otherwise, then a placeholder for its type.

Specs are loaded once per URL and cached for the page, so ten blocks against the same spec cost one request.

## Where the spec comes from

The spec link goes through docstream's [asset resolver](06-assets.md), like an image or a 3D model:

| Host | `[api](specs/api.json)` loads |
| --- | --- |
| `DocsSite` | The file `specs/api.json` from the files you gave the site, resolved against the page's folder. This site passes its `docs/` folder's `.json` and `.yaml` files along with the Markdown: `import.meta.glob("../docs/**/*.{md,json,yaml,yml}", …)`. See [Docs sites](../02-docs-site/04-loading-files.md). |
| An `AssetResolverProvider` | Whatever your resolver returns for `specs/api.json` — a `blob:` URL of a file the reader opened, a signed URL… |
| `setAssetBase(repo, branch, filePath)` | The file in that GitHub repository, next to `filePath`. |
| Nothing | The URL as written, relative to the page's URL. |

A full URL (`https://…/openapi.json`) is fetched as is; the server must then send CORS headers that allow your docs' origin.

## More Petstore

The pet store inventory needs an API key, so its Authorizations section is filled in:

{% openapi-operation spec="petstore" path="/store/inventory" method="get" %}
[petstore](specs/petstore.json)
{% endopenapi-operation %}

Finding pets by status shows a query parameter and an array response:

{% openapi-operation spec="petstore" path="/pet/findByStatus" method="get" %}
[petstore](specs/petstore.json)
{% endopenapi-operation %}

## YAML specs

YAML works the same way. This spec is [`specs/model-library.yaml`](specs/model-library.yaml), also in the docs folder. Its `/models` description contains a `{% hint %}`, which docstream renders, and its schemas use `$ref`, `enum` and `example`:

{% openapi-operation spec="model-library" path="/models" method="get" %}
[model-library](specs/model-library.yaml)
{% endopenapi-operation %}

{% openapi-operation spec="model-library" path="/models/{modelId}" method="get" %}
[model-library](specs/model-library.yaml)
{% endopenapi-operation %}

```yaml title="model-library.yaml (excerpt)"
paths:
  /models:
    get:
      summary: List models
      description: |
        Returns every model in the library, newest first.

        {% hint style="info" %}
        This description is Markdown, rendered by docstream itself, so GitBook blocks work here too.
        {% endhint %}
```

A text spec is parsed as JSON when it starts with `{`, and as YAML otherwise.

## When something is missing

| Situation | The block shows |
| --- | --- |
| No link in the body | "Set an OpenAPI spec URL…" |
| The spec doesn't load (network, CORS, non-2xx) | The error, e.g. "Failed to load spec (404)" |
| The spec loads but has no such operation | "Operation GET /pets not found in spec." |

{% hint style="warning" %}
A spec on another origin is fetched by the reader's browser, so it must be served with CORS headers that allow your docs' origin. Many internal APIs don't — keep a copy of the spec in your docs folder instead, as this page does, and it loads from the VFS with no request at all.
{% endhint %}

## OpenApiOperation

The block renders `OpenApiOperation`, which you can use on its own:

```tsx title="Endpoint.tsx"
import { OpenApiOperation } from "@brett_lamy/docstream"
// or: import { OpenApiOperation } from "@brett_lamy/docstream/openapi"

export function Endpoint() {
  return <OpenApiOperation specUrl="https://petstore3.swagger.io/api/v3/openapi.json" path="/pet/{petId}" method="get" />
  // A relative specUrl goes through the AssetResolverProvider above it, as in Markdown.
}
```

| Prop | Type | Purpose |
| --- | --- | --- |
| `specUrl` | `string` | The OpenAPI document (JSON or YAML). |
| `path` | `string` | The key in `paths`. |
| `method` | `string` | The HTTP method, any case. |

It's styled by the `.oas-*` classes in `styles.css`: `.oas`, `.oas-method-get` / `-post` / `-put` / `-delete`, `.oas-code-2` / `-4` / `-5` and so on.

## See also

{% content-ref url="../07-reference/04-components.md" %}
Every component docstream exports
{% endcontent-ref %}

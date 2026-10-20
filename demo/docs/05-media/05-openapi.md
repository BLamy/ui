---
description: Point a block at an OpenAPI spec and an operation, and docstream renders the endpoint, its parameters, responses, schemas, a cURL sample and an example response, straight from the spec.
---

# OpenAPI operations

Don't hand-write endpoint docs that drift from the API. Name the operation and link the spec, and docstream fetches the spec in the reader's browser and renders the operation from it:

{% openapi-operation spec="petstore" path="/pet/{petId}" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}

```md
{% openapi-operation spec="petstore" path="/pet/{petId}" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}
```

## The block

| Part | Meaning |
| --- | --- |
| `path` | The key under `paths` in the spec, exactly as written there, braces included: `/pet/{petId}`. |
| `method` | `get`, `post`, `put`, `delete`… in any case. Defaults to `get`. |
| `spec` | A name for the spec. It is kept with the block and round-trips, but the renderer reads the URL from the body. |
| Body | One Markdown link, `[name](url)`, to the spec. JSON or YAML. |

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

Specs are fetched once per URL and cached for the page, so ten blocks against the same spec cost one request.

## More Petstore

The pet store inventory needs an API key, so its Authorizations section is filled in:

{% openapi-operation spec="petstore" path="/store/inventory" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}

Finding pets by status shows a query parameter and an array response:

{% openapi-operation spec="petstore" path="/pet/findByStatus" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}

## Your own spec, in YAML

A spec can be any URL the browser can fetch, including a static file next to your docs. This one is served from this site, `/docstream/specs/model-library.yaml`. Its `/models` description contains a `{% hint %}`, which docstream renders, and its schemas use `$ref`, `enum` and `example`:

{% openapi-operation spec="model-library" path="/models" method="get" %}
[model-library](/docstream/specs/model-library.yaml)
{% endopenapi-operation %}

{% openapi-operation spec="model-library" path="/models/{modelId}" method="get" %}
[model-library](/docstream/specs/model-library.yaml)
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
The spec is fetched by the reader's browser, so it must be served with CORS headers that allow your docs' origin. Petstore sends `Access-Control-Allow-Origin: *`. Many internal APIs don't, so serve a copy of the spec next to your docs instead.
{% endhint %}

## OpenApiOperation

The block renders `OpenApiOperation`, which you can use on its own:

```tsx title="Endpoint.tsx"
import { OpenApiOperation } from "@brett_lamy/docstream"
// or: import { OpenApiOperation } from "@brett_lamy/docstream/openapi"

export function Endpoint() {
  return <OpenApiOperation specUrl="https://petstore3.swagger.io/api/v3/openapi.json" path="/pet/{petId}" method="get" />
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

/* The page being exported: a src-only demo (files come from the resolver) and an install box. */
export const PAGE = `# Status badges

One component, three looks.

{% demo src="demos/badges" %}

{% tabs title="Installation" sync="install-method" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/docstream react{% endcommand %}
{% endtab %}
{% endtabs %}
`

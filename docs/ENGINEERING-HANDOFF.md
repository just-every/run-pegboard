# Engineering handoff

Open a task, choose **Engineering handoff**, and link an existing Vector issue,
Jira Cloud issue, GitHub issue or GitHub pull request. This door is private to the
owner or administrator who supplied the source authority and still requires
current task edit authority and enabled workspace integrations.

Choose a direction and map source status IDs to the business indicator. Map
source owner IDs to current Pegboard people explicitly. A missing status mapping
holds the indicator. Neither mapping assigns the business task, changes its
status nor decides an approval. The page shows the immutable source identity,
source owner, mapped owner, last checked time and unavailable causes. Each read
uses a credential for that request only. Source credentials and provider bodies
are never persisted. A source refusal ends the link; revoked links cannot be
reactivated by replay. An outage clears the indicator until a successful refresh.

Vector uses the operator-configured `PEGBOARD_VECTOR_ORIGIN`. Jira accepts an
HTTPS Atlassian Cloud site origin. GitHub uses its official API origin. Local
schema-edge overrides are honored only in local runtime mode. Provider redirects
are refused. Jira credentials are the provider's base64 encoding of an email
address and API token; the other two services use a bearer credential. Use a
credential scoped to the selected source. No live account qualification is claimed.

A return update requires a current review version, a mapped destination status,
current source readback and an explicit human confirmation. Vector receives its
required expected version. Jira checks the chosen transition against current
available transitions. GitHub issue states use the official update endpoint;
GitHub pull requests are read-only here, with no merge or code review operation.
Jira and GitHub do not provide Vector's optimistic version fence: a source-side
edit in the final network interval can still race a human-reviewed write.
An interrupted status send stays uncertain until source readback; no automatic
retry or background outbound job exists.

Publishing a backlink is a separate reviewed disclosure. It posts only an opaque
link marker and the selected task URL, without titles, notes or source transcript
content. Access to the Pegboard task stays unchanged. Comments use Vector's scoped
comment API, Jira's document body and GitHub's issue comments. Before posting,
scan at most five pages of 100 comments; an incomplete scan refuses the write.
A lost response is read back, and an unresolved comment is never posted again.
Revocation cannot retract an operation already admitted by the external provider.

Native archives retain link identities but clear source context and restore all
links revoked. Task erasure cascades to its engineering links. Future PEG-027,
PEG-038 and PEG-062 doors inherit these source authority, review and uncertainty
boundaries. There is no recorder, issue tracker, engineering cycle or launch
approval engine in this feature.

Protocol references:

- [Vector scoped native API](https://github.com/just-every/run-vector/blob/main/docs/API.md)
- [Jira Cloud issue operations](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)
- [Jira Cloud issue comments](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/)
- [GitHub REST issues](https://docs.github.com/en/rest/issues/issues)
- [GitHub REST issue comments](https://docs.github.com/en/rest/issues/comments)
- [GitHub REST pull requests](https://docs.github.com/en/rest/pulls/pulls)

CT-approved defaults (23 October 2026, 12:11Z): owner or administrator only; source context private
to its authorizing administrator; explicit read consent and separate exact
outbound consent; no standing outbound authority; current task permissions
always required. Verified provider event delivery and replay, shared source-grant administration and live qualification remain
unproved, so PEG-040 stays partial.

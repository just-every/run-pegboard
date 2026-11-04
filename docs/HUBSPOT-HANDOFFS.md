# Reviewed HubSpot delivery

Open Settings → Commercial handoffs as the installation owner. Explicitly
authorize a portal with a credential for that request. A signed HubSpot app event
alone is not tenant consent. Revoking the portal cancels its authority permanently;
a later authorization does not revive reviews bound to the earlier grant.

Subscribe the HubSpot app to deal-stage property changes at
`/api/v1/commercial/hubspot/events`. Configure its client secret privately as
`PEGBOARD_HUBSPOT_CLIENT_SECRET` in the installation runtime. The receiver checks
the v3 HMAC signature and five-minute timestamp window before accepting identities.
It stores the portal, deal, event and occurrence identities, without the event body.
Duplicate and reopened events preserve the original source mapping and commitment.
Their permanent audit receipts identify that same retained native handoff, so a
retried event never leaves an audit reference to a nonexistent delivery source.
An event creates neither a project nor a grant.

The owner reviews the current won-stage evidence, permitted deal name and close
expectation, source revision and backlink, exact template version, roles, dates,
owner and empty client audience. Explicit adoption creates one private native
project through the ordinary template service; rules stay inactive. Assigned
people receive no new access. Declining creates no project. Contacts, email,
amounts, account health, ticket SLA and unselected customer properties are excluded.

Every delivery-status return needs a separate exact human review. The HubSpot
portal must already define writable custom deal properties
`pegboard_delivery_status` (enumeration, permitting `in_progress` and `delivered`)
and `pegboard_delivery_operation` (string). Pegboard validates their official
property definitions. It writes only the selected status and opaque operation ID;
CRM stage and customer content stay at the source. Credentials are invocation-only.
Current portal, project, source and review authority are checked again before claim.

A persisted claim precedes the write. All writes require readback. A lost response
or uncertain readback remains a visible exception; reconciliation reads only and
never retries the write. A later human-reviewed status cannot be overwritten by
replaying an older acknowledged receipt. Exported archives preserve historical
mappings with portal authority inactive and every review expired. Exact owner
review and legal holds govern commercial erasure under `docs/DATA-CUSTODY.md`.

This implementation is qualified against official-schema network-edge fakes only.
It does not establish live HubSpot app registration or source-owner consent.
Orbit, Salesforce, Buoy, Linen and HappyToHelp are not connected. No common
cross-product handoff protocol or product migration is implemented.

Official network contracts:

- [Deal objects and property updates](https://developers.hubspot.com/docs/api/crm/deals)
- [Pipelines and stage metadata](https://developers.hubspot.com/docs/api/crm/pipelines)
- [Custom property definitions](https://developers.hubspot.com/docs/api/crm/properties)
- [Account identity](https://developers.hubspot.com/docs/api/account-info)
- [Webhook events](https://developers.hubspot.com/docs/api/webhooks)
- [Request signature validation](https://developers.hubspot.com/docs/api/webhooks/validating-requests)

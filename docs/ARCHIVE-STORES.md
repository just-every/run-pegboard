# Archive store inventory

This inventory covers every database table created by the current core migrations.
Base discovers portable tables from the live schema; it does not use a fixed product
allowlist. An archive manifest declares its exact included and excluded table names,
row counts, schema, source identity, ordered part checksums and closing digest.

Current migration inventory: 159 included unchanged, 20 included with
inactive normalization, 62 excluded (241 total, including engine and
runtime bookkeeping). Tables Base creates dynamically for transfer jobs, snapshots,
staging and lease bookkeeping are always excluded by its reserved prefix.

Included identity mappings are historical custody, not an invitation or session.
The archive keeps the original owner identity. It does not transfer ownership to a
newly bootstrapped owner. Use native CLI restore before claiming the empty destination;
then establish native sign-in with fresh local configuration. An already claimed or
populated installation is not an eligible destination. The HTTP door shares this
policy and refuses an occupied destination at finalization; it supplies no bootstrap
exception. Personal work travels only in this explicitly owner-authorized archive,
without making it visible through ordinary member doors.

Calendar IDs, task IDs, event IDs and operation identities remain historical source
provenance. Connections restore disconnected. Every restored block is permanently
marked historical, including scheduled, pending and cancelled source blocks. Sync
and delete refuse before the provider edge, even after a fresh connection consent.
New reservations require a fresh preview and a new operation identity. Old previews
are absent. Reconnecting never adopts an old event automatically or deletes it.

Sign-in tokens and sessions, API and analyst keys, provider secrets and active share
capabilities are excluded. Grants and approval routes are revoked, pending access
requests become stale, goal-source tokens are cleared, feeds disconnected, recurring
jobs held, processor consent denied, rules disabled and queued rule work pending.
Queued or pending bundle jobs become cancelled. Completed outcomes, immutable audit,
notices and human decisions remain provenance and do not independently authorize a
send, approval or job. Readiness and discussion notice tables are delivery receipts,
not send queues. External time delivery records require a new one-use credential
and separately reviewed receiver reconciliation; restoration does not dispatch them.

The native sanity journey compares all declared counts with actual archive rows,
checks independently seeded installation counts and source graph identities, restores
through the supported CLI, then compares every carried row with a fresh CLI export.
Base advances its authentication generation on export; the journey checks that
specific difference. Retained PDF bytes are independently hashed at input, archive
read and restored download, with both version links preserved. This is database byte
custody, not R2 or an exact-limit qualification.

Future product imports, autonomous agents and connectors inherit this inventory
and inactive-restore obligation when their doors land. New execution authority must
be explicitly normalized before it can travel. Live R2 multipart transfer, derived
and incomplete-object cleanup, PEG-082 limit and migrated proof qualification,
PEG-084 suppression and sender reauthorization, and installed native-device paths
remain unproved. No receiving duty is waived by an excluded runtime cache.

| Store | Disposition | Treatment |
| --- | --- | --- |
| `oa_auth_audit` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_auth_settings` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_bootstrap` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_credentials` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_dev_credentials` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_domain_rules` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_external_identities` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_first_run` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_identity_provider_health` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_identity_providers` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_invitation_cancellations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_limits` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_logout_events` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_oidc_limits` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_oidc_transactions` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_operators` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oa_owner_signins` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_policy_approvals` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_policy_runs` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_provider_session_pins` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_provider_sessions` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_sessions` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_setup_links` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_step_up_challenges` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oa_tokens` | excluded | Native authentication credentials, sessions or transient challenges; identity mappings are listed separately. |
| `oc_idp_grants` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `oc_owner_claims` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_access_requests` | inactive | Retain product rows; normalize `status`, `expires_at`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_agent_outputs` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_agent_retrieval` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_analytics_dependencies` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_analytics_guards` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_analytics_keys` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_analytics_rows` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_analytics_runs` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_analytics_schedules` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_analytics_snapshots` | excluded | Analyst credentials and their bounded credential-owned snapshots, scheduling and cursors; native dashboards and report event history remain included. |
| `peg_api_cursors` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_api_events` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_api_guards` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_api_intents` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_api_keys` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_api_receipts` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_approval_links` | inactive | Retain product rows; normalize `revoked_at`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_approval_owners` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_approval_reminders` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_approval_reopen_guards` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_approval_routes` | inactive | Retain product rows; normalize `withdrawn_at`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_approval_tasks` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_approval_votes` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_approvers` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_attachments` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_audit` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_availability_history` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_availability_revisions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_baseline_tasks` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_baselines` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_brief_versions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bulk_effects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bulk_operations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bulk_undos` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bundle_adoptions` | inactive | Retain product rows; normalize `enabled`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_bundle_history` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bundle_items` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bundle_jobs` | inactive | Retain product rows; normalize `status`, `finished_at`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_bundle_run_tasks` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bundle_runs` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bundle_versions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_bundles` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_calendar_blocks` | inactive | Retain product rows; normalize `restored_inactive`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_calendar_connections` | inactive | Retain product rows; normalize `active`, `restored_inactive`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_calendar_previews` | excluded | Source installation review capability; never reusable after restore. |
| `peg_canvas_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_canvas_nodes` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_capacity_erased_sources` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_capacity_feeds` | inactive | Retain product rows; normalize `active`, `fetched_at`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_capacity_profiles` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_comments` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_conversion_effects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_conversion_links` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_conversion_repairs` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_conversions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_data_erased_objects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_data_erasing_proofs` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_data_erasing_tasks` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_data_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_data_holds` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_data_receipts` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_data_revision` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_decision_guards` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_delivery_records` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_departure_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_departure_revision` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_dependencies` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_duplicate_staged` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_duplicate_tasks` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_effort_allocations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_effort_mappings` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_engineering_links` | inactive | Retain product rows; normalize `revoked_at`, `source_status`, `source_owner`, `mapped_owner`, `source_version`, `indicator`, `pending_status`, `state`, `cause`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_epoch` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_erased_people` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_field_definitions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_field_values` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_field_versions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_goal_audience` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_goal_checkins` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_goal_events` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_goal_links` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_goal_sources` | inactive | Retain product rows; normalize `token_hash`, `ended_at`, `ended_cause`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_goals` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_grants` | inactive | Retain product rows; normalize `revoked_at`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_history` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_inbox` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_local_rule_activations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_local_rule_runs` | inactive | Retain product rows; normalize `status`, `activation_id`, `outcome`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_local_rules` | inactive | Retain product rows; normalize `enabled`, `activation_id`, `activated_by`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_meeting_adoptions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_meeting_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_meeting_proposals` | inactive | Retain product rows; normalize `title`, `owner_id`, `due_date`, `date_resolved`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_meetings` | inactive | Retain product rows; normalize `revoked_at`, `segments`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_occurrence_reviews` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_occurrences` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_permanent_audit` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_guards` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_layout` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_moves` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_revision` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_rules` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_sections` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_personal_settings` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_portfolio_filters` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_portfolio_members` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_portfolio_policies` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_portfolio_projects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_portfolios` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_processor_deletions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_processor_policies` | inactive | Retain product rows; normalize `approved`, `sharing`, `training`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_project_completion` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_project_duplicates` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_project_fields` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_project_request_intake` | excluded | Unconfirmed blind intake; the durable access request and decision remain included. |
| `peg_projects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_proof_decisions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_proof_versions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_proofs` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_readiness_deliveries` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_readiness_preferences` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_readiness_state` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_readiness_task_preferences` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_readiness_transitions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_recovery` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_recurrences` | inactive | Retain product rows; normalize `active`, `held`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_recurring_grants` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_ref_prefixes` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_report_dashboards` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_report_events` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_report_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_report_snapshots` | excluded | Expiring authorized download snapshot; recreate from restored native dashboard and event history. |
| `peg_resource_plans` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_retention_classes` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_reusable_template_versions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_reusable_templates` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_agent_sources` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_effect_runs` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_link_generations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_mutation_generations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_requests` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_suggestions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_rule_work_effects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_schedule_changes` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_schedule_sets` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_search_records` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_sections` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_comments` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_delivery_records` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_discussion_notices` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_discussion_preferences` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_draft_rejections` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_drafts` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_receipts` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_review_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_status_revisions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_rights_copies` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_rights_events` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_status_rights_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_status_rights_requests` | inactive | Retain product rows; normalize `handler_until`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_status_updates` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_tag_projects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_tags` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_task_collaborators` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_task_decisions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_task_projects` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_task_refs` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_task_tags` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_tasks` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_teams` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_adoption_history` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_applications` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_origins` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_rule_activations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_rule_events` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_rule_execution_guards` | excluded | Transaction guard or in-progress destructive scope; not completed product data. |
| `peg_template_rule_generated_tasks` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_rule_runs` | inactive | Retain product rows; normalize `status`, `activation_id`, `outcome`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_template_rule_versions` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_rules` | inactive | Retain product rows; normalize `enabled`, `activation_id`. Terminal rule and bundle outcomes retain their historical result. |
| `peg_template_staged_rules` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_template_task_origins` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_time_authority_guards` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_time_deliveries` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_time_delivery_history` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_time_entries` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_time_history` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_time_off` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_timesheets` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_webhook_deliveries` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_webhooks` | excluded | Source API keys, replay or delivery cursors and webhook send authority; permanent redacted audit remains included. |
| `peg_work_templates` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_working_calendars` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_workspace_members` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `peg_workspaces` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `rer_command_receipts` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_dependency_codes` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_dependency_installation` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `rer_dependency_keys` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_dependency_link` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `rer_dependency_pending` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_erasure_blobs` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_erasure_guard` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_erasure_operations` | included | Retain every row and writable cell, including relationships and byte payloads. |
| `rer_erasure_scope` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_mail_development_outbox` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_epochs` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_guard` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_jobs` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_journal` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_owned` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_parts` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_segments` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `rer_portability_state` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |
| `sqlite_sequence` | excluded | Runtime bookkeeping, transfer staging, local effect capture or provider secrets; durable product journals remain included. |

## Reproduce native custody

The ordinary `test:graph:custody` selector runs the bounded archive sanity journey.
The fixed installation run uses that same public-door journey with 500 workspace
members and 10,000 tasks in one project, plus private personal work, shared task
membership, retained comments, work history and two real PDF proof versions:

```sh
PEGBOARD_ARCHIVE_SCALE=1 node --test --test-name-pattern='^Data custody archive round trip' tests/work-graph.test.mjs
```

Run it on a committed tree outside push Verify. It restores that exact tree through
native CLI doors and emits the independently compared counts and file digests.
It does not dispatch a live provider, simulate R2 qualification or bypass the
empty-installation requirement. The browser selector is `PEGBOARD_JOURNEY=archive-custody`;
its assertions run at 1440 pixels, with optional review captures at 1440 and 390.

# Delivery

Track FinBuddy work in the [FinBuddy GitHub Project](https://github.com/users/theharithsa/projects/1). The [Sprint planning view](https://github.com/users/theharithsa/projects/1/views/2) shows open work by iteration. The [Milestones view](https://github.com/users/theharithsa/projects/1/views/3) groups tracked work by its repository milestone. Use the [repository milestones](https://github.com/theharithsa/finbuddy/milestones?state=all) for releases, discovery, and ongoing dependency work.

- [Roadmap](https://github.com/users/theharithsa/projects/1/views/4) shows scheduled work on the Sprint timeline, grouped by milestone.
- [Kanban](https://github.com/users/theharithsa/projects/1/views/5) shows work by Status, with labels, milestones, and sprints on cards.
- [Issues](https://github.com/users/theharithsa/projects/1/views/6) shows each issue's type label alongside its milestone and sprint. Choose Bug report, Feature request, Task, or Agent brief at intake. Issues created without a type are classified by the issue type assignment workflow.
- [Open work](https://github.com/users/theharithsa/projects/1/views/7) groups open issues by milestone and shows parent issues and sub-issue progress. [Open issues by status](https://github.com/users/theharithsa/projects/1/insights/1) shows current issue counts by Status.

New items enter the Project through GitHub auto-add. The milestone assignment workflow sends unassigned Dependabot PRs to **Dependency maintenance** and other unassigned work to **Backlog triage**.

Review open work at the start and end of each sprint, check dependencies before starting a task, and publish a Project update when the plan, progress, or risk changes. Keep ownership and decisions in the issue or PR. The Project uses the repository's milestone and the Sprint field as the sources for outcomes and scheduling. The built-in Project workflows move closed items and merged PRs to Done and reopened items to Todo.

[FinVision discovery](https://github.com/theharithsa/finbuddy/issues/125) tracks account and data ownership, the first page and sync contract, and verification and rollout as linked sub-issues. Their dependencies and current sprint are in GitHub.

FinBuddy uses the bundled skills and foundation validation from [App Launchpad v1.12.2](https://github.com/theharithsa/app-launchpad-template/tree/v1.12.2). [Project metadata](../project.json) records the source commit.

GitHub automatically deletes eligible head branches after a pull request merges. See the [branch cleanup procedure](../.agents/skills/app-launchpad/references/github-release.md#automatic-branch-cleanup) for verification.

- [Issue-to-merge and release procedure](../.agents/skills/app-launchpad/references/github-release.md)
- [Authorization and safety](../.agents/skills/app-launchpad/references/safety.md)
- [Evidence states](../.agents/skills/app-launchpad/references/evidence.md)
- [Baseline repository ruleset](repository-ruleset.md)
- [Template versions and consumer upgrades](versioning.md)

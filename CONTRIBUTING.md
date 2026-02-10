# Contributing to agent-sdk

Thank you for your interest in contributing to the agent-sdk project! This document outlines the contribution workflow and repository security practices.

## Contribution Workflow

1. **Fork the repository** — Create your own fork of the project
2. **Create a feature branch** — Branch off from `main` with a descriptive name (e.g., `feature/add-logging`)
3. **Make your changes** — Implement your feature or fix
4. **Commit your work** — Write clear, descriptive commit messages
5. **Push to your fork** — Push your branch to your forked repository
6. **Open a pull request** — Submit a PR against the `main` branch with a clear description
7. **Code review** — Address feedback from reviewers
8. **Merge** — Once approved and CI passes, your PR will be merged

## Repository Security

The `main` branch is protected with the following rules to ensure code quality and stability:

- **Pull Request Required** — All changes must go through a pull request; direct pushes to `main` are not allowed
- **Code Review Required** — At least one approval is required before merging
- **Stale Review Dismissal** — Reviews are automatically dismissed when new commits are pushed, ensuring reviewers re-evaluate changes
- **CI Status Checks** — All automated tests and checks must pass (Node 18 and Node 20 CI jobs)
- **Up-to-date Branches** — Branches must be up to date with `main` before merging
- **Linear History** — Merge commits are not allowed; branches are rebased or squashed to maintain a clean history
- **No Force Pushes** — Force pushes are disabled to prevent accidental history rewrites
- **No Deletions** — The `main` branch cannot be deleted

These protections ensure that the `main` branch remains stable and all code is properly reviewed and tested.

## Setting Up Branch Protection

If you have admin access to the repository, you can configure these branch protection rules automatically by running:

```bash
bash scripts/setup-branch-protection.sh
```

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Admin access to the repository

The script will configure all the rules listed above on the `main` branch.

## Questions?

If you have questions about the contribution process or need help, please open an issue or reach out to the maintainers.


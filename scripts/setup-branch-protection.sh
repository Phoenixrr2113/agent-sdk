#!/bin/bash

# Branch Protection Setup Script
# 
# This script configures GitHub branch protection rules on the 'main' branch
# using the GitHub CLI (gh).
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - Admin access to the repository
#   - Run from the repository root directory
#
# Usage:
#   bash scripts/setup-branch-protection.sh
#
# The script will configure the following rules on the 'main' branch:
#   - Require pull request before merging
#   - Require at least 1 approval
#   - Dismiss stale reviews on new pushes
#   - Require status checks to pass (CI checks)
#   - Require branches to be up to date before merging
#   - Restrict push access (no direct pushes to main)
#   - Require linear history (no merge commits)
#   - No force pushes
#   - No deletions

set -e

# Get the repository owner and name from git remote
REPO=$(git config --get remote.origin.url | sed 's/.*[:/]\([^/]*\)\/\([^/]*\)\.git$/\1\/\2/')

if [ -z "$REPO" ]; then
  echo "Error: Could not determine repository from git remote"
  exit 1
fi

echo "Configuring branch protection for repository: $REPO"
echo ""

# Require pull request before merging
echo "Setting: Require pull request before merging..."
gh api --method PUT repos/$REPO/branches/main/protection \
  --input - <<EOF
{
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "required_status_checks": {
    "strict": true,
    "contexts": ["ci (18)", "ci (20)"]
  },
  "enforce_admins": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": null
}
EOF

echo "✓ Branch protection configured successfully!"
echo ""
echo "Rules applied to 'main' branch:"
echo "  ✓ Require pull request before merging"
echo "  ✓ Require at least 1 approval"
echo "  ✓ Dismiss stale reviews on new pushes"
echo "  ✓ Require status checks to pass (ci (18), ci (20))"
echo "  ✓ Require branches to be up to date before merging"
echo "  ✓ Restrict push access (no direct pushes)"
echo "  ✓ Require linear history (no merge commits)"
echo "  ✓ No force pushes"
echo "  ✓ No deletions"


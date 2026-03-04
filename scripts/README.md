# Scripts

Deployment and maintenance scripts for the clinical management system.

**Prerequisites for all scripts**: AWS CLI configured with a valid profile (default: `aski`).
Set `AWS_PROFILE=your-profile` to override.

---

## deploy-backend-pipeline.sh

Deploys the AWS CodePipeline that automatically builds and deploys the backend on every push to `main`.

**Prerequisites**: AWS CLI, git remote pointing to GitHub, GitHub personal access token stored in AWS Secrets Manager as `github-token`.

```bash
# From project root
./scripts/deploy-backend-pipeline.sh
```

What it does:
- Auto-detects GitHub owner/repo from git remote
- Deploys `infrastructure/backend-pipeline.yaml` via CloudFormation
- The pipeline triggers on changes to `backend/`

---

## deploy-frontend-pipeline.sh

Deploys the AWS CodePipeline that builds the React app and syncs it to S3/CloudFront.

**Prerequisites**: Same as backend pipeline. S3 bucket and CloudFront distribution must exist.

```bash
./scripts/deploy-frontend-pipeline.sh
```

What it does:
- Deploys `infrastructure/frontend-pipeline.yaml` via CloudFormation
- Triggers on changes to `frontend/react-app/`

---

## fix-apigw-after-deploy.sh

Restores API Gateway configuration (CORS GatewayResponses and UsagePlan stage link) that SAM overwrites on each deploy.

**Run this after every `sam deploy`.**

```bash
./scripts/fix-apigw-after-deploy.sh
```

Hardcoded values (edit the script if your API changes):
- `API_ID`: REST API ID
- `USAGE_PLAN_ID`: API Gateway usage plan ID
- `API_KEY_ID`: API key ID
- `REGION`: `us-east-1`

---

## reset_db.sh

Deletes all items from every DynamoDB table, leaving the database empty.

**Warning**: This is destructive and irreversible. For development/staging only.

```bash
./scripts/reset_db.sh
```

After running, recreate the platform superuser:

```bash
curl -X POST https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/platform/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourPassword123"}'
```

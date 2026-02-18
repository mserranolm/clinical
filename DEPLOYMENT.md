# 🚀 Clinical Backend Deployment Guide

## Overview
This guide provides step-by-step instructions to deploy the Clinical Management System backend infrastructure using AWS SAM.

## Prerequisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Configure AWS SSO (recommended)
aws configure sso
```

### 2. SAM CLI Installation
```bash
# Install SAM CLI
brew install aws-sam-cli

# Verify installation
sam --version
```

### 3. Go Environment
```bash
# Ensure Go 1.22+ is installed
go version
```

## 🔧 Deployment Steps

### Step 1: Clone and Navigate
```bash
git clone <repository-url>
cd clinical/backend
```

### Step 2: Configure Environment Variables
Create or verify your AWS profile:
```bash
# Login to AWS SSO
aws sso login --profile aski

# Verify access
aws sts get-caller-identity --profile aski
```

### Step 3: Build the Application
```bash
# Build the SAM application
sam build
```

### Step 4: Deploy Infrastructure
```bash
# Deploy to us-east-1 region
sam deploy --stack-name clinical-backend \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --profile aski \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset
```

### Step 5: Verify Deployment
```bash
# Get the API endpoint URL
aws cloudformation describe-stacks \
  --stack-name clinical-backend \
  --region us-east-1 \
  --profile aski \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text

# Test the health endpoint
curl -X GET "<API_URL>/health"
```

## 📊 Infrastructure Components

### AWS Resources Created:
- **Lambda Functions**:
  - `ClinicalApiFunction` - Main API handler
  - `Reminder24hFunction` - 24h appointment reminders
  - `EndOfDayFunction` - Daily agenda closing

- **DynamoDB Tables**:
  - `clinical-patients` - Patient information
  - `clinical-appointments` - Appointment management
  - `clinical-consents` - Consent documents
  - `clinical-users` - User authentication
  - `clinical-odontograms` - Dental charts
  - `clinical-treatment-plans` - Treatment plans

- **API Gateway**:
  - HTTP API (APIGatewayV2) for RESTful endpoints

- **EventBridge Rules**:
  - Every 15 minutes - Reminder checks
  - Daily schedule - End of day processing

### Environment Variables:
```yaml
ENVIRONMENT: prod
APPOINTMENT_TABLE: clinical-appointments
PATIENT_TABLE: clinical-patients
CONSENT_TABLE: clinical-consents
USER_TABLE: clinical-users
ODONTOGRAM_TABLE: clinical-odontograms
TREATMENT_PLAN_TABLE: clinical-treatment-plans
SEND_SMS: "true"
SEND_EMAIL: "true"
USE_DYNAMODB: "true"
```

## 🔍 Monitoring and Logs

### View CloudWatch Logs:
```bash
# Get Lambda function name
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `clinical-backend-ClinicalApiFunction`)].FunctionName' \
  --output text \
  --profile aski \
  --region us-east-1

# Tail logs
aws logs tail "/aws/lambda/<FUNCTION_NAME>" \
  --since 1m \
  --profile aski \
  --region us-east-1
```

### Check DynamoDB Tables:
```bash
aws dynamodb list-tables --region us-east-1 --profile aski
```

## 🧪 Testing the Deployment

### 1. Health Check:
```bash
curl -X GET "<API_URL>/health"
# Expected: {"message":"Clinical API is running","status":"ok"}
```

### 2. Create Test Patient:
```bash
curl -X POST "<API_URL>/patients/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "doc-123",
    "firstName": "Test",
    "lastName": "Patient",
    "email": "test@example.com",
    "phone": "+1234567890",
    "birthDate": "1990-01-01"
  }'
```

### 3. Register Test User:
```bash
curl -X POST "<API_URL>/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Doctor",
    "email": "doctor@example.com",
    "password": "SecurePass123!"
  }'
```

## 🔄 Update Deployment

### For Code Changes:
```bash
# Rebuild and redeploy
sam build && sam deploy --stack-name clinical-backend \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --profile aski \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset
```

### For Infrastructure Changes:
- Modify `template.yaml`
- Run the same deployment command
- SAM will create a changeset and apply updates

## 🗑️ Cleanup (Delete Stack)

```bash
# Delete the entire stack
sam delete --stack-name clinical-backend \
  --region us-east-1 \
  --profile aski \
  --no-prompts
```

**Warning**: This will delete all data in DynamoDB tables!

## ⚠️ Troubleshooting

### Common Issues:

1. **SSO Session Expired**:
   ```bash
   aws sso login --profile aski
   ```

2. **S3 Bucket Conflicts**:
   - SAM will create deployment buckets automatically
   - Use `--resolve-s3` flag to handle bucket creation

3. **IAM Permissions**:
   - Ensure your AWS profile has CloudFormation, Lambda, DynamoDB, and API Gateway permissions

4. **Region-Specific Resources**:
   - Deploy to `us-east-1` for consistency
   - Some AWS services have region dependencies

### Log Analysis:
- Check CloudWatch Logs for Lambda execution errors
- Review CloudFormation events for deployment issues
- Monitor DynamoDB metrics for performance issues

## 📈 Production Considerations

### Security:
- Enable API Gateway API Keys (currently disabled for testing)
- Configure VPC for Lambda functions if needed
- Enable DynamoDB encryption at rest
- Use AWS Secrets Manager for sensitive configuration

### Performance:
- Monitor Lambda cold starts
- Optimize DynamoDB read/write capacity
- Implement API Gateway caching if needed

### Backup:
- Enable DynamoDB Point-in-Time Recovery
- Set up automated CloudFormation template backups

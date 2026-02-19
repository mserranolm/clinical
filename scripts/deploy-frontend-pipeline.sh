#!/bin/bash

# Clinical Frontend CI/CD Pipeline Deployment Script
# Despliega el pipeline que auto-deploya a CloudFront cuando hay cambios en frontend/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Clinical Frontend CI/CD Pipeline Deployment${NC}"
echo "=================================================="

# Auto-detect GitHub owner from git remote
GITHUB_REMOTE=$(git remote get-url origin 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$GITHUB_REMOTE" ]; then
    echo -e "${RED}❌ Error: No git remote origin found${NC}"
    echo "Make sure you're in a git repository with GitHub remote configured"
    exit 1
fi

# Extract owner from GitHub URL (supports both HTTPS and SSH)
GITHUB_OWNER=""
if [[ "$GITHUB_REMOTE" =~ github\.com[:/]([^/]+)/([^/]+) ]]; then
    GITHUB_OWNER="${BASH_REMATCH[1]}"
    GITHUB_REPO="${BASH_REMATCH[2]%.git}"
else
    echo -e "${RED}❌ Error: Invalid GitHub remote URL: $GITHUB_REMOTE${NC}"
    echo "Expected format: git@github.com:owner/repo.git or https://github.com/owner/repo.git"
    exit 1
fi

echo -e "${GREEN}🔍 Auto-detected from git remote:${NC}"
echo "  • GitHub Owner: $GITHUB_OWNER"  
echo "  • GitHub Repo: $GITHUB_REPO"
echo ""
STACK_NAME="clinical-frontend-pipeline"
REGION="us-east-1"
PROFILE="aski"

echo -e "${YELLOW}📋 Pipeline Configuration:${NC}"
echo "  • Stack Name: $STACK_NAME"
echo "  • GitHub Owner: $GITHUB_OWNER"
echo "  • GitHub Repo: $GITHUB_REPO"
echo "  • Branch: main"
echo "  • Region: $REGION"
echo "  • AWS Profile: $PROFILE"
echo "  • CodeConnections: arn:aws:codeconnections:us-east-1:975738006503:connection/02b6f662-39a5-410a-892b-c5cde98708fc"
echo "  • Deployment: CloudFront + S3"
echo "  • Triggers: Changes to frontend/ folder only"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile $PROFILE > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS CLI not configured for profile '$PROFILE'${NC}"
    echo "Please run: aws sso login --profile $PROFILE"
    exit 1
fi

echo -e "${YELLOW}🔍 Checking AWS credentials...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query Account --output text)
echo "  • Account ID: $ACCOUNT_ID"
echo ""

# Deploy the pipeline
echo -e "${YELLOW}🏗️  Deploying Frontend CI/CD Pipeline...${NC}"
aws cloudformation deploy \
    --template-file infrastructure/frontend-pipeline.yaml \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        ProjectName=clinical-frontend \
        GitHubOwner=$GITHUB_OWNER \
        GitHubRepo=$GITHUB_REPO \
        DomainName=clinisense.aski-tech.net \
        CertificateArn=arn:aws:acm:us-east-1:975738006503:certificate/c6f19465-0bd5-486a-9e6a-9a53ee20a81e \
        BranchName=main \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Frontend Pipeline deployed successfully!${NC}"
    echo ""
    
    # Get pipeline details
    WEBSITE_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --profile $PROFILE \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
        --output text)
    
    PIPELINE_NAME=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --profile $PROFILE \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendPipelineName`].OutputValue' \
        --output text)
    
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --profile $PROFILE \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
        --output text)
    
    PIPELINE_URL="https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${PIPELINE_NAME}/view?region=${REGION}"
    
    echo -e "${BLUE}📊 Frontend Deployment Details:${NC}"
    echo "  • Website URL: $WEBSITE_URL"
    echo "  • CloudFront Distribution: $CLOUDFRONT_ID"
    echo "  • Pipeline Name: $PIPELINE_NAME"
    echo "  • Pipeline Console: $PIPELINE_URL"
    echo ""
    echo -e "${GREEN}🎯 Next Steps:${NC}"
    echo "  1. Pipeline is now active and monitoring frontend/ changes"
    echo "  2. Push changes to frontend/ folder to trigger deployment"
    echo "  3. Website will be available at: $WEBSITE_URL"
    echo "  4. CloudFront caching enabled for optimal performance"
    echo ""
    
else
    echo -e "${RED}❌ Failed to deploy frontend pipeline${NC}"
    exit 1
fi

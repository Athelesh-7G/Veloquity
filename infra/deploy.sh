#!/bin/bash
# =============================================================
# Veloquity MVP — One-command deploy script
# Usage: bash infra/deploy.sh [dev|staging|prod]
# =============================================================

set -euo pipefail

ENV=${1:-dev}
STACK_NAME="veloquity-${ENV}"
TEMPLATE="infra/cloudformation.yaml"
PARAMS="infra/parameters.json"
REGION=${AWS_REGION:-us-east-1}

echo "=================================================="
echo " Veloquity Deploy — ENV=${ENV}  REGION=${REGION}"
echo "=================================================="

# 1. Package Lambda code — zip each module
echo "[1/5] Packaging Lambda functions..."
mkdir -p .build

zip -r .build/ingestion.zip ingestion/ -x "*.pyc" -x "__pycache__/*"
zip -r .build/evidence.zip evidence/ -x "*.pyc" -x "__pycache__/*"
zip -r .build/reasoning.zip reasoning/ -x "*.pyc" -x "__pycache__/*"
zip -r .build/governance.zip governance/ -x "*.pyc" -x "__pycache__/*"

# 2. Upload Lambda zips to a deployment S3 bucket
DEPLOY_BUCKET="veloquity-deploy-${ENV}-$(aws sts get-caller-identity --query Account --output text)"

echo "[2/5] Uploading Lambda packages to s3://${DEPLOY_BUCKET}..."
aws s3 mb s3://${DEPLOY_BUCKET} --region ${REGION} 2>/dev/null || true
aws s3 cp .build/ingestion.zip  s3://${DEPLOY_BUCKET}/lambda/ingestion.zip
aws s3 cp .build/evidence.zip   s3://${DEPLOY_BUCKET}/lambda/evidence.zip
aws s3 cp .build/reasoning.zip  s3://${DEPLOY_BUCKET}/lambda/reasoning.zip
aws s3 cp .build/governance.zip s3://${DEPLOY_BUCKET}/lambda/governance.zip

# 3. Validate CloudFormation template
echo "[3/5] Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://${TEMPLATE} \
  --region ${REGION} > /dev/null

echo "  Template valid."

# 4. Deploy CloudFormation stack
echo "[4/5] Deploying CloudFormation stack: ${STACK_NAME}..."

# Convert parameters.json array to Key=Value pairs for `aws cloudformation deploy`
PARAM_OVERRIDES=$("/c/Program Files/Python311/python" -c "
import json, sys
params = json.load(open('${PARAMS}'))
print(' '.join(p['ParameterKey']+'='+p['ParameterValue'] for p in params))
")

aws cloudformation deploy \
  --stack-name ${STACK_NAME} \
  --template-file ${TEMPLATE} \
  --parameter-overrides ${PARAM_OVERRIDES} DeployBucket=${DEPLOY_BUCKET} \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ${REGION} \
  --tags Project=Veloquity Env=${ENV}

echo "  Stack deployed."

# 5. Run DB migrations
echo "[5/5] Running database migrations..."

DB_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query "Stacks[0].Outputs[?OutputKey=='DBSecretArn'].OutputValue" \
  --output text \
  --region ${REGION})

DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" \
  --output text \
  --region ${REGION})

DB_CREDS=$(aws secretsmanager get-secret-value \
  --secret-id ${DB_SECRET_ARN} \
  --query SecretString \
  --output text \
  --region ${REGION})

DB_USER=$(echo $DB_CREDS | "/c/Program Files/Python311/python" -c "import sys,json; print(json.load(sys.stdin)['username'])")
DB_PASS=$(echo $DB_CREDS | "/c/Program Files/Python311/python" -c "import sys,json; print(json.load(sys.stdin)['password'])")
DB_NAME="veloquity"

export PGPASSWORD=${DB_PASS}

for migration in db/migrations/*.sql; do
  echo "  Applying: ${migration}"
  psql -h ${DB_ENDPOINT} -U ${DB_USER} -d ${DB_NAME} -f ${migration}
done

echo ""
echo "=================================================="
echo " Veloquity deploy complete!"
echo ""

REPORT_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query "Stacks[0].Outputs[?OutputKey=='ReportBucketWebsiteURL'].OutputValue" \
  --output text \
  --region ${REGION})

echo "  Report URL : ${REPORT_URL}"
echo "  DB Endpoint: ${DB_ENDPOINT}"
echo "  Stack Name : ${STACK_NAME}"
echo "=================================================="
